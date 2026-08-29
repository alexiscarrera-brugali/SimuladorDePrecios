"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, ArrowUpDown, BarChart3, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  FileSpreadsheet, FlaskConical, LogOut, Menu, Rows2, Rows3, RefreshCw,
  Search, ShieldAlert, Tag, TrendingDown, Upload, X,
} from "lucide-react";
import type { AnalysisResponse, AnalysisRow, PreviewResult, PriceList, QualityIssue } from "@/lib/types";
import type { SimulationPayload } from "@/lib/contracts";
import { formatMoney, formatPercent } from "@/lib/simulation";
import { warningLabels } from "@/lib/labels";
import { bucketGaps, matchesException, portfolioSummary, type ExceptionKey } from "@/lib/portfolio";
import { createSupabaseBrowserClient } from "@/lib/client/supabase";
import { isAllowedXlsxMime, XLSX_MAX_BYTES } from "@/lib/config/upload";
import { SimulatorPanel } from "@/components/simulations/SimulatorPanel";
import { SimulationHistory } from "@/components/simulations/SimulationHistory";
import { MarginDistribution } from "@/components/analysis/MarginDistribution";
import { ExceptionClusters } from "@/components/analysis/ExceptionClusters";
import { BatchSimulator } from "@/components/analysis/BatchSimulator";
import { Sparkline } from "@/components/analysis/Sparkline";
import { CapabilityGate } from "@/components/common/CapabilityGate";
import { CommandPalette, type Command } from "@/components/common/CommandPalette";

const today = new Date().toISOString().slice(0, 10);

/** Nombre para mostrar: usa el nombre del perfil o lo deriva del email. */
function displayName(user: { name: string; email: string }): string {
  const n = (user.name ?? "").trim();
  if (n && !n.includes("@")) return n;
  const local = (user.email.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
  return local.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) || user.email;
}

type ActiveView = "panel" | "precios" | "escenarios" | "importar" | "observaciones";
type SortField = "product" | "cost" | "price" | "ideal" | "margin";
type SortDir = "asc" | "desc";

export function Dashboard({ user, initialPriceLists }: { user: { name: string; role: string; email: string }; initialPriceLists: PriceList[] }) {
  const router = useRouter();
  const [lists, setLists] = useState(initialPriceLists);
  const [selectedList, setSelectedList] = useState(initialPriceLists[0]?.code ?? "");
  const [queryDate, setQueryDate] = useState(today);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>(initialPriceLists.length ? "panel" : "importar");
  const [exception, setException] = useState<ExceptionKey | null>(null);
  const [selectedRow, setSelectedRow] = useState<AnalysisRow | null>(null);
  const [simulations, setSimulations] = useState<Record<string, SimulationPayload>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dense, setDense] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Se lee la preferencia después de montar para no romper la hidratación
    // (el HTML del servidor no conoce localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setDense(localStorage.getItem("brugali:dense") === "1"); } catch { /* almacenamiento no disponible */ }
  }, []);

  function toggleDense() {
    setDense(prev => {
      const next = !prev;
      try { localStorage.setItem("brugali:dense", next ? "1" : "0"); } catch { /* ignorar */ }
      return next;
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openRow = useCallback((row: AnalysisRow) => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setSelectedRow(row);
  }, []);
  const closeSimulator = useCallback(() => {
    setSelectedRow(null);
    requestAnimationFrame(() => lastFocus.current?.focus?.());
  }, []);

  const loadAnalysis = useCallback(async () => {
    if (!selectedList) return;
    await Promise.resolve();
    setLoading(true); setError("");
    const params = new URLSearchParams({ date: queryDate, price_list: selectedList });
    const response = await fetch(`/api/analysis?${params}`);
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.detail ?? "No pudimos consultar el análisis");
    setAnalysis(data);
  }, [queryDate, selectedList]);

  const loadIssues = useCallback(async () => {
    await Promise.resolve();
    const response = await fetch("/api/quality/issues");
    if (response.ok) setIssues(await response.json());
  }, []);

  useEffect(() => {
    if (activeView !== "panel" && activeView !== "precios") return;
    const timer = window.setTimeout(() => void loadAnalysis(), 0);
    return () => window.clearTimeout(timer);
  }, [activeView, loadAnalysis]);
  useEffect(() => {
    if (activeView !== "observaciones") return;
    const timer = window.setTimeout(() => void loadIssues(), 0);
    return () => window.clearTimeout(timer);
  }, [activeView, loadIssues]);

  async function logout() {
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function refreshLists() {
    const response = await fetch("/api/price-lists");
    if (response.ok) {
      const nextLists: PriceList[] = await response.json();
      setLists(nextLists); setSelectedList(nextLists[0]?.code ?? ""); setActiveView("panel");
    }
  }

  async function exportWorkbook() {
    const response = await fetch("/api/exports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query_date: queryDate, price_list_code: selectedList, simulations }),
    });
    if (!response.ok) return setError("No pudimos generar la exportación");
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? "brugali_costos.xlsx";
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
  }

  const viewTitles: Record<ActiveView, string> = {
    panel: "Panel de cartera",
    precios: "Precios vigentes",
    escenarios: "Escenarios y simulaciones",
    importar: "Nueva importación",
    observaciones: "Observaciones de datos",
  };

  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [
      { id: "view-panel", label: "Ir a Panel", group: "Vistas", run: () => setActiveView("panel") },
      { id: "view-precios", label: "Ir a Precios", group: "Vistas", run: () => setActiveView("precios") },
      { id: "view-escenarios", label: "Ir a Escenarios", group: "Vistas", run: () => setActiveView("escenarios") },
      { id: "view-observaciones", label: "Ir a Observaciones", group: "Vistas", run: () => setActiveView("observaciones") },
      { id: "view-importar", label: "Ir a Importar base", group: "Vistas", run: () => setActiveView("importar") },
      { id: "toggle-dense", label: dense ? "Desactivar modo denso" : "Activar modo denso", group: "Vistas", run: toggleDense },
    ];
    for (const list of lists) {
      cmds.push({ id: `list-${list.code}`, label: `Lista ${list.code} · ${list.description}`, hint: "Cambiar lista", group: "Listas de precio", run: () => { setSelectedList(list.code); setActiveView("precios"); } });
    }
    for (const row of analysis?.rows ?? []) {
      cmds.push({
        id: `prod-${row.branch_code}-${row.product_code}`,
        label: `${row.product_code} · ${row.description ?? "Sin descripción"}`,
        hint: "Abrir simulador",
        group: "Productos",
        run: () => { setActiveView("precios"); setSelectedRow(row); },
      });
    }
    return cmds;
  }, [lists, analysis, dense]);

  return (
    <main className={`appShell ${dense ? "dense" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <button className="mobileClose" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X /></button>
        <div className="sidebarBrand"><Image src="/brand/brugali-logo.jpg" alt="Brugali" width={136} height={136} priority /></div>
        <nav>
          <button className={activeView === "panel" ? "active" : ""} onClick={() => { setActiveView("panel"); setMobileOpen(false); }}><BarChart3 />Panel</button>
          <button className={activeView === "precios" ? "active" : ""} onClick={() => { setActiveView("precios"); setMobileOpen(false); }}><Tag />Precios</button>
          <button className={activeView === "escenarios" ? "active" : ""} onClick={() => { setActiveView("escenarios"); setMobileOpen(false); }}><FlaskConical />Escenarios</button>
          <span className="navGroupLabel">Datos</span>
          <button className={`navSecondary ${activeView === "importar" ? "active" : ""}`} onClick={() => { setActiveView("importar"); setMobileOpen(false); }}><Upload size={16} />Importar base</button>
          <button className={`navSecondary ${activeView === "observaciones" ? "active" : ""}`} onClick={() => { setActiveView("observaciones"); setMobileOpen(false); }}><ShieldAlert size={16} />Observaciones{issues.length > 0 && <span>{issues.length}</span>}</button>
        </nav>
        <div className="userCard"><div className="avatar">{displayName(user).split(" ").map(part => part[0]).slice(0, 2).join("")}</div><div><strong>{displayName(user)}</strong><small>{user.role.replace("_", " ")}</small></div><button onClick={logout} aria-label="Cerrar sesión"><LogOut size={17} /></button></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobileMenu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu /></button>
          <div><span className="eyebrow">Hola, {displayName(user).split(" ")[0]}</span><h1>{viewTitles[activeView]}</h1></div>
          <div className="topActions">
            <button className="iconButton densityToggle" onClick={toggleDense} aria-pressed={dense} title={dense ? "Vista cómoda" : "Vista densa"} aria-label={dense ? "Vista cómoda" : "Vista densa"}>
              {dense ? <Rows2 size={17} /> : <Rows3 size={17} />}
            </button>
            <button className="iconButton paletteTrigger" onClick={() => setPaletteOpen(true)} aria-label="Abrir paleta de comandos" title="Buscar (Ctrl/Cmd + K)">
              <Search size={16} /><kbd>⌘K</kbd>
            </button>
            {activeView === "precios" && <button className="secondaryButton" onClick={exportWorkbook}><ArrowDownToLine size={17} />Exportar Excel</button>}
          </div>
        </header>

        {error && <div className="pageError"><AlertTriangle />{error}<button onClick={() => setError("")}><X size={16} /></button></div>}
        {activeView === "importar" && <ImportView onCommitted={refreshLists} />}
        {activeView === "observaciones" && <IssuesView issues={issues} loading={loading} />}
        {activeView === "escenarios" && <SimulationHistory />}
        {(activeView === "panel" || activeView === "precios") && (
          <>
            <section className="filterBar">
              <label>Lista<select value={selectedList} onChange={event => setSelectedList(event.target.value)}>{lists.map(list => <option key={list.code} value={list.code}>{list.code} · {list.description}</option>)}</select></label>
              <label>Fecha de consulta<input type="date" value={queryDate} onChange={event => setQueryDate(event.target.value)} /></label>
              <button className="iconButton" onClick={loadAnalysis} aria-label="Actualizar"><RefreshCw className={loading ? "spin" : ""} /></button>
            </section>
            {!lists.length ? (
              <EmptyState onImport={() => setActiveView("importar")} />
            ) : analysis && activeView === "panel" ? (
              <PanelContent analysis={analysis} loading={loading} exception={exception} onException={(key) => { setException(key); setActiveView("precios"); }} />
            ) : analysis && activeView === "precios" ? (
              <PreciosContent analysis={analysis} loading={loading} onSelect={openRow} simulations={simulations} exception={exception} setException={setException} canPublish={user.role === "admin_importer"} onPublished={() => void loadAnalysis()} />
            ) : null}
          </>
        )}
      </section>
      {selectedRow && <SimulatorPanel row={selectedRow} queryDate={queryDate} canPublish={user.role === "admin_importer"} onClose={closeSimulator} onChange={payload => setSimulations(current => ({ ...current, [payload.product_code]: payload }))} onPublished={() => { closeSimulator(); void loadAnalysis(); }} />}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} commands={commands} />}
    </main>
  );
}

function SortTh({ label, field, sortField, sortDir, onSort }: { label: string; field: SortField; sortField: SortField | null; sortDir: SortDir; onSort: (f: SortField) => void }) {
  const active = sortField === field;
  return (
    <th className="sortable" onClick={() => onSort(field)} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <span className="thSort">
        <span>{label}</span>
        {active ? (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ArrowUpDown size={12} className="sortIcon" />}
      </span>
    </th>
  );
}

function PanelContent({ analysis, loading, exception, onException }: { analysis: AnalysisResponse; loading: boolean; exception: ExceptionKey | null; onException: (key: ExceptionKey | null) => void }) {
  const summary = useMemo(() => portfolioSummary(analysis.rows), [analysis.rows]);
  const histogram = useMemo(() => bucketGaps(analysis.rows), [analysis.rows]);

  return (
    <div className={loading ? "content loading" : "content"}>
      <section className="portfolioStrip">
        <div className="vizCard">
          <div className="vizHeading">
            <span className="eyebrow">Salud de cartera</span>
            <h2>¿Qué tan lejos está la cartera de su objetivo?</h2>
          </div>
          <MarginDistribution histogram={histogram} summary={summary} />
          <p className="portfolioNote">
            {summary.evaluated.toLocaleString("es-AR")} evaluados
            {summary.withoutTarget > 0 && <> · {summary.withoutTarget.toLocaleString("es-AR")} sin objetivo</>}
            {summary.worstGapPoints !== null && summary.worstGapPoints < -0.5 && (
              <> · peor brecha {summary.worstGapPoints.toFixed(2)} pp</>
            )}
          </p>
        </div>
      </section>

      <ExceptionClusters summary={summary} active={exception} onToggle={onException} />

      <section className="capRow">
        <CapabilityGate
          enabled={analysis.capabilities.has_volume}
          title="Margen ponderado por ingreso"
          unlocks="Pondera la salud de la cartera por lo que cada producto factura y habilita el análisis ABC/Pareto."
          requirement="volumen de ventas"
        />
        <CapabilityGate
          enabled={analysis.capabilities.has_category}
          title="Segmentación por rubro"
          unlocks="Agrupa y compara los márgenes por familia o rubro de producto."
          requirement="categoría/rubro"
        />
      </section>
    </div>
  );
}

function PreciosContent({ analysis, loading, onSelect, simulations, exception, setException, canPublish, onPublished }: { analysis: AnalysisResponse; loading: boolean; onSelect: (row: AnalysisRow) => void; simulations: Record<string, SimulationPayload>; exception: ExceptionKey | null; setException: (key: ExceptionKey | null) => void; canPublish: boolean; onPublished: () => void }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);

  function toggleSelected(code: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const [trends, setTrends] = useState<Record<string, number[]>>({});
  useEffect(() => {
    let alive = true;
    fetch(`/api/analysis/trends?date=${analysis.query_date}&price_list=${encodeURIComponent(analysis.price_list.code)}`)
      .then(r => (r.ok ? r.json() : { prices: {} }))
      .then(d => { if (alive) setTrends(d.prices ?? {}); })
      .catch(() => { /* la sparkline degrada a vacío */ });
    return () => { alive = false; };
  }, [analysis.query_date, analysis.price_list.code]);

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = analysis.rows.filter(r => {
      if (exception && !matchesException(r, exception)) return false;
      if (!q) return true;
      return r.product_code.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
    });

    if (sortField) {
      result = result.sort((a, b) => {
        let va: number | string = 0;
        let vb: number | string = 0;
        switch (sortField) {
          case "product": va = a.product_code; vb = b.product_code; break;
          case "cost": va = Number(a.cost.value ?? 0); vb = Number(b.cost.value ?? 0); break;
          case "price": va = Number(a.price.value ?? 0); vb = Number(b.price.value ?? 0); break;
          case "ideal": va = Number(a.ideal_percent ?? 0); vb = Number(b.ideal_percent ?? 0); break;
          case "margin": va = Number(a.actual_gain_percent ?? 0); vb = Number(b.actual_gain_percent ?? 0); break;
        }
        if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
        return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
      });
    }
    return result;
  }, [analysis.rows, search, sortField, sortDir, exception]);

  const filterLabel = exception === "below_target" ? "Bajo objetivo"
    : exception === "without_cost" ? "Sin costo"
    : exception === "conflict" ? "Conflictos" : null;

  return (
    <div className={loading ? "content loading" : "content"}>
      <section className="tableCard">
        <div className="cardHeading">
          <div>
            <span className="eyebrow">{analysis.price_list.description}</span>
            <h2>Lista de precios vigentes</h2>
            {filterLabel && (
              <button className="activeFilterChip" onClick={() => setException(null)}>
                {filterLabel} · {rows.length} <X size={13} />
              </button>
            )}
          </div>
          <label className="searchBox">
            <Search size={17} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar producto"
              aria-label="Buscar producto"
            />
            {search && <button className="clearSearch" onClick={() => setSearch("")} aria-label="Limpiar búsqueda"><X size={14} /></button>}
          </label>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th className="selectCol">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los visibles"
                    checked={rows.length > 0 && rows.every(r => selected.has(r.product_code))}
                    ref={el => { if (el) el.indeterminate = rows.some(r => selected.has(r.product_code)) && !rows.every(r => selected.has(r.product_code)); }}
                    onChange={e => {
                      setSelected(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) rows.forEach(r => next.add(r.product_code));
                        else rows.forEach(r => next.delete(r.product_code));
                        return next;
                      });
                    }}
                  />
                </th>
                <SortTh label="Producto" field="product" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Costo" field="cost" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Precio" field="price" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Objetivo" field="ideal" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Margen actual" field="margin" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <th>Precio (tend.)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isBelow = matchesException(row, "below_target");
                const hasSim = Boolean(simulations[row.product_code]);
                return (
                  <tr key={`${row.branch_code}-${row.product_code}`} onClick={() => onSelect(row)} className={`${hasSim ? "hasSim" : ""} ${selected.has(row.product_code) ? "rowSelected" : ""}`}>
                    <td className="selectCol" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${row.product_code}`}
                        checked={selected.has(row.product_code)}
                        onChange={() => toggleSelected(row.product_code)}
                      />
                    </td>
                    <td>
                      <strong><StatusDot status={row.data_status} warnings={row.warnings} />{row.product_code}</strong>
                      <span>{row.description ?? "Sin descripción"}</span>
                      {hasSim && <span className="simBadge">Simulado</span>}
                    </td>
                    <td>
                      {formatMoney(row.cost.value)}
                      <small>{row.cost.valid_from ?? "Sin vigencia"}</small>
                    </td>
                    <td>
                      {formatMoney(row.price.value)}
                      {row.price.origin === "manual" && <span className="manualPill">Establecido</span>}
                      <small>{row.price.valid_from ?? "Sin vigencia"}</small>
                    </td>
                    <td>{formatPercent(row.ideal_percent)}</td>
                    <td className={isBelow ? "marginBelow" : ""}>
                      {formatPercent(row.actual_gain_percent)}
                      {isBelow && <TrendingDown size={13} className="marginBelowIcon" aria-label="Por debajo del objetivo" />}
                      <small>{formatMoney(row.actual_gain_amount)}</small>
                    </td>
                    <td><Sparkline values={trends[row.product_code]} /></td>
                    <td><button aria-label={`Abrir ${row.product_code}`}><ChevronRight /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="emptyTable">
            {search || exception ? "No hay productos que coincidan con el filtro activo." : "Sin productos para mostrar."}
          </div>
        )}
      </section>

      {selected.size > 0 && (
        <div className="batchBar" role="region" aria-label="Acciones por lote">
          <span className="batchBarCount"><strong>{selected.size}</strong> seleccionado{selected.size === 1 ? "" : "s"}</span>
          <div className="batchBarActions">
            <button className="textButton" onClick={() => setSelected(new Set())}>Limpiar</button>
            <button className="primaryButton" onClick={() => setBatchOpen(true)}><FlaskConical size={16} />Simular en lote</button>
          </div>
        </div>
      )}

      {batchOpen && (
        <BatchSimulator
          productCodes={[...selected]}
          priceListCode={analysis.price_list.code}
          queryDate={analysis.query_date}
          canPublish={canPublish}
          onClose={() => setBatchOpen(false)}
          onSaved={() => { /* el escenario queda en Escenarios */ }}
          onPublished={() => { setBatchOpen(false); setSelected(new Set()); onPublished(); }}
        />
      )}
    </div>
  );
}

function StatusDot({ status, warnings }: { status: string; warnings: string[] }) {
  const label = status === "ok" ? "Correcto" : status === "conflict" ? "Conflicto" : "Revisar";
  const detail = warnings.map(item => warningLabels[item] ?? item).join(" · ");
  return (
    <span className={`statusDot ${status}`} title={detail ? `${label} · ${detail}` : label} aria-label={label} />
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <section className="emptyState">
      <div className="emptyGlyph"><FileSpreadsheet /></div>
      <span className="eyebrow">Punto de partida</span>
      <h2>Cargá la base para comenzar</h2>
      <p>Antes de guardar nada vas a ver una vista previa con ceros, estados desconocidos y claves duplicadas.</p>
      <button className="primaryButton" onClick={onImport}><Upload size={18} />Seleccionar Excel</button>
    </section>
  );
}

function IssuesView({ issues }: { issues: QualityIssue[]; loading: boolean }) {
  const [filter, setFilter] = useState<"all" | "warning" | "conflict">("all");
  const visible = filter === "all" ? issues : issues.filter(issue => issue.severity === filter);
  return (
    <section className="issuesPage">
      <div className="explainBand">
        <div className="explainIcon"><ShieldAlert /></div>
        <div>
          <h2>La falla se muestra, no se tapa.</h2>
          <p>Cada observación explica qué ocurrió, dónde está y si impide calcular. Las filas originales permanecen trazables.</p>
        </div>
      </div>
      <div className="issueTabs">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas <span>{issues.length}</span></button>
        <button className={filter === "warning" ? "active" : ""} onClick={() => setFilter("warning")}>Advertencias <span>{issues.filter(i => i.severity === "warning").length}</span></button>
        <button className={filter === "conflict" ? "active" : ""} onClick={() => setFilter("conflict")}>Conflictos <span>{issues.filter(i => i.severity === "conflict").length}</span></button>
      </div>
      <div className="issueList">
        {visible.map((issue, index) => (
          <article key={`${issue.business_key}-${issue.issue_type}-${index}`} className={issue.severity}>
            <div className="issueMark">{issue.severity === "conflict" ? <ShieldAlert /> : <AlertTriangle />}</div>
            <div>
              <div className="issueMeta">
                <span>{warningLabels[issue.issue_type] ?? issue.issue_type}</span>
                <small>{issue.sheet_name} · filas {issue.source_rows.join(", ")}</small>
              </div>
              <h3>{issue.explanation}</h3>
              <code>{issue.business_key}</code>
              {issue.values.length > 0 && <p>Valores: {issue.values.join(" / ")}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ImportView({ onCommitted }: { onCommitted: () => Promise<void> }) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function inspect() {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const contentType = file.type || "application/octet-stream";
      if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Seleccioná un archivo .xlsx válido");
      if (file.size <= 0 || file.size > XLSX_MAX_BYTES) throw new Error("El archivo debe pesar entre 1 byte y 25 MB");
      if (!isAllowedXlsxMime(contentType)) throw new Error("El tipo de archivo no está permitido");
      const signed = await fetch("/api/imports/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: file.size, contentType }),
      });
      const signedData = await signed.json();
      if (!signed.ok) throw new Error(signedData.detail ?? "No se pudo preparar la subida");
      const supabase = createSupabaseBrowserClient();
      const upload = await supabase.storage.from(signedData.bucket).uploadToSignedUrl(signedData.path, signedData.token, file);
      if (upload.error) throw new Error("No se pudo subir el archivo");
      const response = await fetch("/api/imports/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: signedData.path }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "No se pudo leer el archivo");
      setPreview(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview) return;
    setBusy(true);
    const response = await fetch("/api/imports/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: preview.path }) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setError(data.detail ?? "No se pudo confirmar el lote");
    await onCommitted();
  }

  return (
    <section className="importPage">
      <div className="importIntro">
        <span className="eyebrow">Carga controlada</span>
        <h2>Primero revisamos.<br />Después confirmamos.</h2>
        <p>La planilla sigue siendo la fuente. El sistema valida su estructura y explica los problemas antes de incorporarla al análisis.</p>
        <ol>
          <li><span>01</span>Seleccionar archivo</li>
          <li><span>02</span>Revisar observaciones</li>
          <li><span>03</span>Confirmar lote</li>
        </ol>
      </div>
      <div className="uploadCard">
        {!preview ? (
          <>
            <div className="dropVisual"><FileSpreadsheet /><i /></div>
            <label className="filePicker">
              <input type="file" accept=".xlsx" onChange={event => setFile(event.target.files?.[0] ?? null)} />
              <span>{file ? file.name : "Elegir archivo .xlsx"}</span>
              <Upload />
            </label>
            <p>Máximo 25 MB. El archivo no se modifica.</p>
            <button className="primaryButton" disabled={!file || busy} onClick={inspect}>{busy ? "Analizando…" : "Crear vista previa"}<ChevronRight /></button>
          </>
        ) : (
          <PreviewCard preview={preview} busy={busy} onCommit={commit} onReset={() => { setPreview(null); setFile(null); }} />
        )}
        {error && <div className="formError" role="alert">{error}</div>}
      </div>
    </section>
  );
}

function PreviewCard({ preview, busy, onCommit, onReset }: { preview: PreviewResult; busy: boolean; onCommit: () => void; onReset: () => void }) {
  return (
    <div className="previewCard">
      <div className="previewSuccess"><CheckCircle2 /><div><span>Archivo leído</span><strong>{preview.filename}</strong></div></div>
      <div className="previewMetrics">
        <div><strong>{preview.summary.price_rows}</strong><span>precios</span></div>
        <div><strong>{preview.summary.cost_rows}</strong><span>costos</span></div>
        <div><strong>{preview.summary.warnings}</strong><span>advertencias</span></div>
        <div className="danger"><strong>{preview.summary.conflicts}</strong><span>conflictos</span></div>
      </div>
      <div className="previewNote"><AlertTriangle /><p>Los conflictos seguirán visibles y bloquearán únicamente la fila afectada.</p></div>
      <div className="buttonRow">
        <button className="textButton" onClick={onReset}>Elegir otro</button>
        <button className="primaryButton" disabled={busy} onClick={onCommit}>{busy ? "Confirmando…" : "Confirmar lote"}<ChevronRight /></button>
      </div>
    </div>
  );
}

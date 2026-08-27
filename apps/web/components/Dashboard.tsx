"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, ArrowUpDown, BarChart3, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  FileSpreadsheet, FlaskConical, LogOut, Menu, RefreshCw,
  Search, ShieldAlert, TrendingDown, Upload, X,
} from "lucide-react";
import type { AnalysisResponse, AnalysisRow, PreviewResult, PriceList, QualityIssue } from "@/lib/types";
import type { SimulationPayload } from "@/lib/contracts";
import { formatMoney, formatPercent } from "@/lib/simulation";
import { warningLabels } from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SimulatorPanel } from "./SimulatorPanel";
import { SimulationHistory } from "./SimulationHistory";

const today = new Date().toISOString().slice(0, 10);

type ActiveView = "analysis" | "issues" | "import" | "simulations";
type SortField = "product" | "cost" | "price" | "ideal" | "margin";
type SortDir = "asc" | "desc";

export function Dashboard({ user, initialPriceLists }: { user: { name: string; role: string; email: string }; initialPriceLists: PriceList[] }) {
  const [lists, setLists] = useState(initialPriceLists);
  const [selectedList, setSelectedList] = useState(initialPriceLists[0]?.code ?? "");
  const [queryDate, setQueryDate] = useState(today);
  const [status, setStatus] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>(initialPriceLists.length ? "analysis" : "import");
  const [selectedRow, setSelectedRow] = useState<AnalysisRow | null>(null);
  const [simulations, setSimulations] = useState<Record<string, SimulationPayload>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);

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
    setLoading(true); setError("");
    const params = new URLSearchParams({ date: queryDate, price_list: selectedList });
    if (status) params.set("status", status);
    const response = await fetch(`/api/analysis?${params}`);
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.detail ?? "No pudimos consultar el análisis");
    setAnalysis(data);
  }, [queryDate, selectedList, status]);

  const loadIssues = useCallback(async () => {
    const response = await fetch("/api/quality/issues");
    if (response.ok) setIssues(await response.json());
  }, []);

  useEffect(() => { if (activeView === "analysis") void loadAnalysis(); }, [activeView, loadAnalysis]);
  useEffect(() => { if (activeView === "issues") void loadIssues(); }, [activeView, loadIssues]);

  async function logout() {
    await createSupabaseBrowserClient().auth.signOut();
    window.location.href = "/login";
  }

  async function refreshLists() {
    const response = await fetch("/api/price-lists");
    if (response.ok) {
      const nextLists: PriceList[] = await response.json();
      setLists(nextLists); setSelectedList(nextLists[0]?.code ?? ""); setActiveView("analysis");
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
    analysis: "Análisis comercial",
    issues: "Observaciones de datos",
    import: "Nueva importación",
    simulations: "Historial de simulaciones",
  };

  return (
    <main className="appShell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <button className="mobileClose" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X /></button>
        <div className="sidebarBrand"><Image src="/brand/brugali-logo.jpg" alt="Brugali" width={136} height={136} priority /></div>
        <nav>
          <button className={activeView === "analysis" ? "active" : ""} onClick={() => { setActiveView("analysis"); setMobileOpen(false); }}><BarChart3 />Análisis</button>
          <button className={activeView === "issues" ? "active" : ""} onClick={() => { setActiveView("issues"); setMobileOpen(false); }}><ShieldAlert />Observaciones{issues.length > 0 && <span>{issues.length}</span>}</button>
          <button className={activeView === "simulations" ? "active" : ""} onClick={() => { setActiveView("simulations"); setMobileOpen(false); }}><FlaskConical />Simulaciones</button>
          <button className={activeView === "import" ? "active" : ""} onClick={() => { setActiveView("import"); setMobileOpen(false); }}><Upload />Importar base</button>
        </nav>
        <div className="sidebarNote"><i /><div><strong>Entorno privado</strong><small>Validación local · MVP</small></div></div>
        <div className="userCard"><div className="avatar">{user.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</div><div><strong>{user.name}</strong><small>{user.role.replace("_", " ")}</small></div><button onClick={logout} aria-label="Cerrar sesión"><LogOut size={17} /></button></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobileMenu" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu /></button>
          <div><span className="eyebrow">Tablero de costos y precios</span><h1>{viewTitles[activeView]}</h1></div>
          <div className="topActions">
            <span className="dataPulse"><i />Datos privados</span>
            {activeView === "analysis" && <button className="secondaryButton" onClick={exportWorkbook}><ArrowDownToLine size={17} />Exportar Excel</button>}
          </div>
        </header>

        {error && <div className="pageError"><AlertTriangle />{error}<button onClick={() => setError("")}><X size={16} /></button></div>}
        {activeView === "import" && <ImportView onCommitted={refreshLists} />}
        {activeView === "issues" && <IssuesView issues={issues} loading={loading} />}
        {activeView === "simulations" && <SimulationHistory />}
        {activeView === "analysis" && (
          <>
            <section className="filterBar">
              <label>Lista<select value={selectedList} onChange={event => setSelectedList(event.target.value)}>{lists.map(list => <option key={list.code} value={list.code}>{list.code} · {list.description}</option>)}</select></label>
              <label>Fecha de consulta<input type="date" value={queryDate} onChange={event => setQueryDate(event.target.value)} /></label>
              <label>Estado<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos, sin ocultar</option><option value="ok">Correctos</option><option value="warning">Con advertencias</option><option value="conflict">Conflictos</option></select></label>
              <button className="iconButton" onClick={loadAnalysis} aria-label="Actualizar"><RefreshCw className={loading ? "spin" : ""} /></button>
            </section>
            {!lists.length ? <EmptyState onImport={() => setActiveView("import")} /> : analysis && <AnalysisContent analysis={analysis} loading={loading} onSelect={openRow} simulations={simulations} />}
          </>
        )}
      </section>
      {selectedRow && <SimulatorPanel row={selectedRow} queryDate={queryDate} onClose={closeSimulator} onChange={payload => setSimulations(current => ({ ...current, [payload.product_code]: payload }))} />}
    </main>
  );
}

function SortTh({ label, field, sortField, sortDir, onSort }: { label: string; field: SortField; sortField: SortField | null; sortDir: SortDir; onSort: (f: SortField) => void }) {
  const active = sortField === field;
  return (
    <th className="sortable" onClick={() => onSort(field)} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <span>{label}</span>
      {active ? (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ArrowUpDown size={12} className="sortIcon" />}
    </th>
  );
}

function AnalysisContent({ analysis, loading, onSelect, simulations }: { analysis: AnalysisResponse; loading: boolean; onSelect: (row: AnalysisRow) => void; simulations: Record<string, SimulationPayload> }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const belowTarget = useMemo(() =>
    analysis.rows.filter(r => {
      const actual = r.actual_gain_percent !== null ? Number(r.actual_gain_percent) : null;
      const ideal = r.ideal_percent !== null ? Number(r.ideal_percent) : null;
      return actual !== null && ideal !== null && actual < ideal;
    }).length,
    [analysis.rows],
  );

  const rows = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = q
      ? analysis.rows.filter(r =>
          r.product_code.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q)
        )
      : [...analysis.rows];

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
  }, [analysis.rows, search, sortField, sortDir]);

  return (
    <div className={loading ? "content loading" : "content"}>
      <section className="metricGrid">
        <Metric label="Productos visibles" value={analysis.counts.total} tone="ink" caption="Ninguna falla se oculta" />
        <Metric label="Datos consistentes" value={analysis.counts.ok} tone="teal" caption="Listos para analizar" />
        <Metric label="Advertencias" value={analysis.counts.warning} tone="yellow" caption="Requieren revisión" />
        <Metric label="Conflictos" value={analysis.counts.conflict} tone="red" caption="Bloquean sólo su fila" />
        <Metric label="Bajo objetivo" value={belowTarget} tone="orange" caption="Margen actual < objetivo" />
      </section>
      <section className="tableCard">
        <div className="cardHeading">
          <div><span className="eyebrow">{analysis.price_list.description}</span><h2>Precio, costo y objetivo vigentes</h2></div>
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
                <SortTh label="Producto" field="product" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Costo" field="cost" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Precio" field="price" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Objetivo" field="ideal" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Margen actual" field="margin" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const actualN = row.actual_gain_percent !== null ? Number(row.actual_gain_percent) : null;
                const idealN = row.ideal_percent !== null ? Number(row.ideal_percent) : null;
                const isBelow = actualN !== null && idealN !== null && actualN < idealN;
                const hasSim = Boolean(simulations[row.product_code]);
                return (
                  <tr key={`${row.branch_code}-${row.product_code}`} onClick={() => onSelect(row)} className={hasSim ? "hasSim" : ""}>
                    <td>
                      <strong>{row.product_code}</strong>
                      <span>{row.description ?? "Sin descripción"}</span>
                      {hasSim && <span className="simBadge">Simulado</span>}
                    </td>
                    <td>
                      {formatMoney(row.cost.value)}
                      <small>{row.cost.valid_from ?? "Sin vigencia"}</small>
                    </td>
                    <td>
                      {formatMoney(row.price.value)}
                      <small>{row.price.valid_from ?? "Sin vigencia"}</small>
                    </td>
                    <td>{formatPercent(row.ideal_percent)}</td>
                    <td className={isBelow ? "marginBelow" : ""}>
                      {formatPercent(row.actual_gain_percent)}
                      {isBelow && <TrendingDown size={13} className="marginBelowIcon" aria-label="Por debajo del objetivo" />}
                      <small>{formatMoney(row.actual_gain_amount)}</small>
                    </td>
                    <td><StatusBadge status={row.data_status} warnings={row.warnings} /></td>
                    <td><button aria-label={`Abrir ${row.product_code}`}><ChevronRight /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="emptyTable">
            {search ? "No hay productos que coincidan con la búsqueda." : "Sin productos para mostrar."}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, tone, caption }: { label: string; value: number; tone: string; caption: string }) {
  return <article className={`metric ${tone}`}><span>{label}</span><strong>{value.toLocaleString("es-AR")}</strong><small>{caption}</small><i /></article>;
}

function StatusBadge({ status, warnings }: { status: string; warnings: string[] }) {
  const label = status === "ok" ? "Correcto" : status === "conflict" ? "Conflicto" : "Revisar";
  return (
    <div className={`statusBadge ${status}`} title={warnings.map(item => warningLabels[item] ?? item).join(" · ")}>
      {status === "ok" ? <CheckCircle2 /> : <AlertTriangle />}
      <span>{label}</span>
    </div>
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
      const signed = await fetch("/api/imports/sign-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name }) });
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
        {error && <div className="formError">{error}</div>}
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

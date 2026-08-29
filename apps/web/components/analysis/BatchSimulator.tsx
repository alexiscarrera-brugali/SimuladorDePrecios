"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Save, X } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/simulation";

type RuleKind = "to_target" | "price_delta_pct" | "cost_shock_pct";

interface BatchItem {
  product_code: string;
  branch_code: string;
  before_price: string | null;
  after_price: string | null;
  before_gain_percent: string | null;
  after_gain_percent: string | null;
  thermometer: "green" | "red" | "neutral";
  crossed_into_target: boolean;
  fell_below_target: boolean;
  skipped: boolean;
  reason: string | null;
}
interface BatchAggregate {
  selected: number;
  evaluated: number;
  skipped: number;
  crossedIntoTarget: number;
  fellBelowTarget: number;
  belowTargetBefore: number;
  belowTargetAfter: number;
  meanGainBefore: string | null;
  meanGainAfter: string | null;
  weighting: "count" | "revenue";
}
interface BatchResponse {
  aggregate: BatchAggregate;
  items: BatchItem[];
  scenario_id?: string;
  saved?: number;
}

const RULES: { key: RuleKind; label: string; needsValue: boolean; hint: string }[] = [
  { key: "to_target", label: "Llevar al objetivo", needsValue: false, hint: "Fija el precio de cada producto en su margen objetivo." },
  { key: "price_delta_pct", label: "Ajustar precio %", needsValue: true, hint: "Aplica un porcentaje sobre el precio vigente." },
  { key: "cost_shock_pct", label: "Shock de costo %", needsValue: true, hint: "Sube el costo y mantiene el precio: mide la erosión de margen." },
];

export function BatchSimulator({
  productCodes,
  priceListCode,
  queryDate,
  canPublish,
  onClose,
  onSaved,
  onPublished,
}: {
  productCodes: string[];
  priceListCode: string;
  queryDate: string;
  canPublish: boolean;
  onClose: () => void;
  onSaved: () => void;
  onPublished: () => void;
}) {
  const [ruleKind, setRuleKind] = useState<RuleKind>("to_target");
  const [ruleValue, setRuleValue] = useState("10");
  const [preview, setPreview] = useState<BatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const rule = RULES.find((r) => r.key === ruleKind)!;

  const runPreview = useCallback(async () => {
    setError("");
    setSavedId(null);
    setLoading(true);
    const res = await fetch("/api/simulations/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_list_code: priceListCode,
        query_date: queryDate,
        rule_kind: ruleKind,
        rule_value: rule.needsValue ? ruleValue : null,
        product_codes: productCodes,
        save: false,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.detail ?? "No se pudo calcular el escenario");
    setPreview(data);
  }, [priceListCode, queryDate, ruleKind, ruleValue, rule.needsValue, productCodes]);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Preview con debounce ante cambios de regla o valor.
  useEffect(() => {
    const t = window.setTimeout(() => void runPreview(), 250);
    return () => window.clearTimeout(t);
  }, [runPreview]);

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/simulations/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_list_code: priceListCode,
        query_date: queryDate,
        rule_kind: ruleKind,
        rule_value: rule.needsValue ? ruleValue : null,
        product_codes: productCodes,
        note: note || undefined,
        save: true,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.detail ?? "No se pudo guardar el escenario");
    setSavedId(data.scenario_id ?? null);
    onSaved();
  }

  async function publishAll() {
    const items = (preview?.items ?? [])
      .filter((i) => !i.skipped && i.after_price !== null)
      .map((i) => ({ product_code: i.product_code, branch_code: i.branch_code, price: i.after_price as string }));
    if (items.length === 0) { setError("No hay precios simulados para establecer."); return; }
    setPublishing(true);
    setError("");
    const res = await fetch("/api/prices/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price_list_code: priceListCode, query_date: queryDate, items }),
    });
    const data = await res.json();
    setPublishing(false);
    if (!res.ok) return setError(data.detail ?? "No se pudo establecer la lista vigente");
    onPublished();
  }

  const agg = preview?.aggregate ?? null;

  return (
    <div className="simulatorOverlay" onClick={onClose}>
      <aside className="simulatorPanel batchPanel" role="dialog" aria-modal="true" aria-labelledby="batchTitle" onClick={(e) => e.stopPropagation()}>
        <header className="simHeader">
          <div>
            <span className="eyebrow">What-if de cartera</span>
            <h2 id="batchTitle">{productCodes.length} producto{productCodes.length === 1 ? "" : "s"} seleccionado{productCodes.length === 1 ? "" : "s"}</h2>
            <p>Aplicá una regla y mirá el impacto agregado antes de guardar el escenario.</p>
          </div>
          <button ref={closeRef} className="iconButton" onClick={onClose} aria-label="Cerrar"><X /></button>
        </header>

        <section className="simDriver">
          <span className="fieldLabel">Regla</span>
          <div className="segmented" role="group" aria-label="Regla">
            {RULES.map((r) => (
              <button key={r.key} className={ruleKind === r.key ? "active" : ""} aria-pressed={ruleKind === r.key} onClick={() => setRuleKind(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <p className="ruleHint">{rule.hint}</p>
        </section>

        {rule.needsValue && (
          <section className="simInput">
            <label htmlFor="ruleValue" className="fieldLabel">Porcentaje (%)</label>
            <input id="ruleValue" type="number" inputMode="decimal" value={ruleValue} onChange={(e) => setRuleValue(e.target.value)} />
          </section>
        )}

        {error && <div className="formError" role="alert"><AlertTriangle size={16} />{error}</div>}

        {agg && (
          <section className="batchAggregate" aria-live="polite">
            <div className="batchMeanRow">
              <div className="batchMean">
                <span>Margen medio</span>
                <div className="batchMeanValues">
                  <strong>{agg.meanGainBefore === null ? "—" : `${agg.meanGainBefore}%`}</strong>
                  <ArrowRight size={16} />
                  <strong className={compareTone(agg.meanGainBefore, agg.meanGainAfter)}>
                    {agg.meanGainAfter === null ? "—" : `${agg.meanGainAfter}%`}
                  </strong>
                </div>
                <small>ponderado por conteo</small>
              </div>
            </div>
            <div className="batchChips">
              <span className="batchChip green"><Check size={13} />{agg.crossedIntoTarget} cruzan al objetivo</span>
              <span className="batchChip red"><AlertTriangle size={13} />{agg.fellBelowTarget} caen bajo objetivo</span>
              <span className="batchChip neutral">Bajo objetivo {agg.belowTargetBefore} → {agg.belowTargetAfter}</span>
              {agg.skipped > 0 && <span className="batchChip muted">{agg.skipped} omitidos</span>}
            </div>
          </section>
        )}

        {preview && (
          <section className="batchItems">
            <div className="tableWrap">
              <table>
                <thead>
                  <tr><th>Producto</th><th>Precio</th><th>Margen</th><th>Efecto</th></tr>
                </thead>
                <tbody>
                  {preview.items.map((item) => (
                    <tr key={`${item.branch_code}-${item.product_code}`} className={item.skipped ? "skippedRow" : ""}>
                      <td><strong>{item.product_code}</strong></td>
                      <td>{item.skipped ? "—" : <>{formatMoney(item.before_price)} <ArrowRight size={11} /> {formatMoney(item.after_price)}</>}</td>
                      <td>{item.skipped ? "—" : <>{formatPercent(item.before_gain_percent)} <ArrowRight size={11} /> <span className={item.thermometer === "red" ? "marginBelow" : ""}>{formatPercent(item.after_gain_percent)}</span></>}</td>
                      <td>
                        {item.skipped ? <small className="skipReason">Omitido · {item.reason}</small>
                          : item.crossed_into_target ? <span className="effGood">Cruza al objetivo</span>
                          : item.fell_below_target ? <span className="effBad">Cae bajo objetivo</span>
                          : <span className="effNone">Sin cambio de estado</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="simInput">
          <label htmlFor="batchNote" className="fieldLabel">Nota (opcional)</label>
          <input id="batchNote" type="text" maxLength={500} value={note} placeholder="Motivo o contexto del escenario" onChange={(e) => setNote(e.target.value)} />
        </section>

        {savedId && <p className="simSaved" role="status">Escenario guardado como propuesta. No cambia los precios vigentes.</p>}

        <div className="simActions column">
          <p className="actionHint">
            <strong>Guardar escenario</strong> registra la propuesta.{" "}
            {canPublish ? <><strong>Establecer como lista vigente</strong> aplica los precios simulados a la lista (nueva vigencia de hoy).</> : "Establecer la lista vigente requiere rol de importador."}
          </p>
          <div className="simActionsRow">
            <button className="textButton" onClick={onClose}>Cerrar</button>
            <button className="secondaryButton" onClick={save} disabled={saving || publishing || loading || !agg || agg.evaluated === 0}>
              <Save size={16} />{saving ? "Guardando…" : "Guardar escenario"}
            </button>
            {canPublish && (
              <button className="primaryButton" onClick={publishAll} disabled={publishing || saving || loading || !agg || agg.evaluated === 0}>
                {publishing ? "Estableciendo…" : "Establecer como lista vigente"}
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function compareTone(before: string | null, after: string | null): string {
  if (before === null || after === null) return "";
  const b = Number(before), a = Number(after);
  if (a > b) return "up";
  if (a < b) return "down";
  return "";
}

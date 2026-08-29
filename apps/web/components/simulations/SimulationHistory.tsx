"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type { SavedSimulation } from "@/lib/types";
import { formatMoney, formatPercent } from "@/lib/simulation";

const driverLabel: Record<string, string> = {
  price: "Precio",
  gain_amount: "Ganancia $",
  gain_percent: "Ganancia %",
};

const ruleLabel: Record<string, string> = {
  to_target: "Llevar al objetivo",
  price_delta_pct: "Ajustar precio %",
  cost_shock_pct: "Shock de costo %",
};

interface ScenarioAggregate {
  selected: number;
  evaluated: number;
  skipped: number;
  crossedIntoTarget: number;
  fellBelowTarget: number;
  meanGainBefore: string | null;
  meanGainAfter: string | null;
}
interface Scenario {
  id: string;
  price_list_code: string;
  query_date: string;
  rule_kind: string;
  rule_value: number | null;
  note: string | null;
  aggregate: ScenarioAggregate;
  created_at: string;
  item_count: number;
}

function ThermometerDot({ t }: { t: string }) {
  const color = t === "green" ? "#379b8c" : t === "red" ? "#e43023" : "#6a6558";
  return (
    <span
      style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, marginRight: 6 }}
      aria-hidden="true"
    />
  );
}

export function SimulationHistory() {
  const [rows, setRows] = useState<SavedSimulation[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError("");
    try {
      const [histRes, scenRes] = await Promise.all([
        fetch("/api/simulations/history"),
        fetch("/api/scenarios"),
      ]);
      if (!histRes.ok) throw new Error("request_failed");
      setRows(await histRes.json());
      setScenarios(scenRes.ok ? await scenRes.json() : []);
    } catch {
      setError("No se pudo cargar el historial de simulaciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <section className="historyPage">
      <div className="historyPageHeader">
        <div>
          <span className="eyebrow">Registro interno</span>
          <h2>Simulaciones guardadas</h2>
          <p>Comparativa entre los datos originales y cada simulación registrada.</p>
        </div>
        <button className="iconButton" onClick={load} aria-label="Actualizar">
          <RefreshCw className={loading ? "spin" : ""} size={17} />
        </button>
      </div>

      {error && (
        <div className="formError" role="alert">
          <AlertTriangle size={16} />{error}
        </div>
      )}

      {scenarios.length > 0 && (
        <div className="scenarioList">
          <h3 className="scenarioListTitle">Escenarios de cartera</h3>
          <div className="scenarioGrid">
            {scenarios.map((s) => {
              const before = s.aggregate?.meanGainBefore;
              const after = s.aggregate?.meanGainAfter;
              return (
                <article key={s.id} className="scenarioCard">
                  <div className="scenarioHead">
                    <span className="scenarioRule">{ruleLabel[s.rule_kind] ?? s.rule_kind}{s.rule_value !== null ? ` · ${s.rule_value}%` : ""}</span>
                    <span className="scenarioMeta">Lista {s.price_list_code} · {s.item_count} producto{s.item_count === 1 ? "" : "s"}</span>
                  </div>
                  <div className="scenarioMean">
                    <span className="scenarioMeanValues">
                      <strong>{before ?? "—"}%</strong>
                      <span className="scenarioArrow">→</span>
                      <strong className={after && before && Number(after) < Number(before) ? "down" : after && before && Number(after) > Number(before) ? "up" : ""}>{after ?? "—"}%</strong>
                    </span>
                    <small>margen medio</small>
                  </div>
                  <div className="scenarioChips">
                    {s.aggregate?.crossedIntoTarget > 0 && <span className="scenarioChip green">{s.aggregate.crossedIntoTarget} cruzan</span>}
                    {s.aggregate?.fellBelowTarget > 0 && <span className="scenarioChip red">{s.aggregate.fellBelowTarget} caen</span>}
                    {s.aggregate?.skipped > 0 && <span className="scenarioChip muted">{s.aggregate.skipped} omitidos</span>}
                  </div>
                  {s.note && <p className="scenarioNote">{s.note}</p>}
                  <small className="scenarioDate">{new Date(s.created_at).toLocaleDateString("es-AR")} · {new Date(s.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !error && rows.length === 0 && scenarios.length === 0 && (
        <div className="emptyState" style={{ marginTop: 24 }}>
          <div className="emptyGlyph"><CheckCircle2 /></div>
          <h2>Sin simulaciones guardadas</h2>
          <p>Cuando guardes una simulación o un escenario, aparecerá acá.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="simSavedList">
          <h3 className="scenarioListTitle">Simulaciones por producto</h3>
          <div className="scenarioGrid">
            {rows.map((row) => (
              <article key={row.id} className="scenarioCard">
                <div className="scenarioHead">
                  <span className="scenarioRule">{row.product_code}</span>
                  <span className="scenarioMeta">Lista {row.price_list_code} · {driverLabel[row.driver] ?? row.driver}</span>
                </div>
                <div className="simSavedPrice">
                  <strong>{formatMoney(row.simulated_price)}</strong>
                  <span className="simSavedGain">{formatPercent(row.simulated_gain_percent)}</span>
                </div>
                <div className="scenarioChips">
                  <span className={`scenarioChip ${row.thermometer === "green" ? "green" : row.thermometer === "red" ? "red" : "muted"}`}>
                    <ThermometerDot t={row.thermometer} />
                    {row.thermometer === "green" ? "Sobre objetivo" : row.thermometer === "red" ? "Bajo objetivo" : "Sin objetivo"}
                  </span>
                </div>
                <small className="scenarioDate">
                  {row.actor_email} · {new Date(row.created_at).toLocaleDateString("es-AR")} {new Date(row.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </small>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

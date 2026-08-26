"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ShieldAlert, ThermometerSun, X } from "lucide-react";
import type { AnalysisRow, Driver } from "@/lib/types";
import type { SimulationPayload } from "@/lib/contracts";
import { simulationSchema } from "@/lib/contracts";
import { calculateSimulation, formatMoney, formatPercent } from "@/lib/simulation";
import { explain } from "@/lib/labels";
import { HistoryChart } from "./HistoryChart";

type SimulatorPanelProps = {
  row: AnalysisRow;
  queryDate: string;
  onClose: () => void;
  onChange: (simulation: SimulationPayload) => void;
};

type ServerResult = {
  price: string | null;
  gain_amount: string | null;
  gain_percent: string | null;
  thermometer: string;
  warnings: string[];
};

const driverLabels: Record<Driver, string> = {
  price: "Precio",
  gain_amount: "Ganancia $",
  gain_percent: "Ganancia %",
};

const num = (value: string | null): number => (value === null || value.trim() === "" ? 0 : Number(value));

function sliderConfig(driver: Driver, costNum: number, priceNum: number) {
  if (driver === "gain_percent") return { min: -100, max: 300, step: 0.5 };
  if (driver === "gain_amount") {
    const max = Math.max(costNum * 3, priceNum, 100);
    return { min: -Math.max(costNum, 100), max, step: Math.max(Number((max / 200).toFixed(2)), 0.01) };
  }
  const max = Math.max(costNum * 3, priceNum * 1.6, 100);
  return { min: 0, max, step: Math.max(Number((max / 200).toFixed(2)), 0.01) };
}

function defaultValue(driver: Driver, row: AnalysisRow, costNum: number, priceNum: number): string {
  if (driver === "gain_amount") return String(priceNum - costNum);
  if (driver === "gain_percent") return row.actual_gain_percent ?? row.ideal_percent ?? "0";
  return row.price.value ?? String(priceNum);
}

export function SimulatorPanel({ row, queryDate, onClose, onChange }: SimulatorPanelProps) {
  const costNum = num(row.cost.value);
  const priceNum = num(row.price.value);
  const blocked = row.simulation_blocked;

  const [driver, setDriver] = useState<Driver>("price");
  const [driverValue, setDriverValue] = useState<string>(() => row.price.value ?? String(priceNum));
  const [serverResult, setServerResult] = useState<ServerResult | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sourceWarnings = useMemo(
    () => row.warnings.filter((w) => w === "inactive_source" || w === "unknown_source_status"),
    [row.warnings],
  );

  const { sim, calcError } = useMemo(() => {
    try {
      return {
        sim: calculateSimulation(row.cost.value, row.ideal_percent, driver, driverValue || "0", sourceWarnings),
        calcError: "",
      };
    } catch (error) {
      return { sim: null, calcError: (error as Error).message };
    }
  }, [row.cost.value, row.ideal_percent, driver, driverValue, sourceWarnings]);

  const config = sliderConfig(driver, costNum, priceNum);

  function changeDriver(next: Driver) {
    setDriver(next);
    setDriverValue(defaultValue(next, row, costNum, priceNum));
    setServerResult(null);
    setSaveError("");
  }

  const warningKeys = Array.from(new Set([...row.warnings, ...(sim?.warnings ?? [])]));

  async function save() {
    setSaveError("");
    const payload: SimulationPayload = {
      product_code: row.product_code,
      price_list_code: row.price_list_code,
      query_date: queryDate,
      cost: row.cost.value,
      ideal_percent: row.ideal_percent,
      driver,
      driver_value: driverValue || "0",
      source_inactive: row.warnings.includes("inactive_source"),
      source_unknown: row.warnings.includes("unknown_source_status"),
    };
    const parsed = simulationSchema.safeParse(payload);
    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Revisá los datos de la simulación");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/simulations/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setSaveError(data.detail ?? "No pudimos guardar la simulación");
      return;
    }
    setServerResult(data);
    onChange(payload);
  }

  const thermometer = serverResult?.thermometer ?? sim?.thermometer ?? "neutral";
  const thermometerLabel =
    thermometer === "green" ? "Por encima del objetivo" : thermometer === "red" ? "Por debajo del objetivo" : "Sin objetivo de referencia";

  return (
    <div className="simulatorOverlay" onClick={onClose}>
      <aside
        className="simulatorPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulatorTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="simHeader">
          <div>
            <span className="eyebrow">{row.price_list_name}</span>
            <h2 id="simulatorTitle">{row.product_code}</h2>
            <p>{row.description ?? "Sin descripción"}</p>
          </div>
          <button ref={closeRef} className="iconButton" onClick={onClose} aria-label="Cerrar simulador">
            <X />
          </button>
        </header>

        <div className="simContext">
          <div><span>Costo vigente</span><strong>{formatMoney(row.cost.value)}</strong><small>{row.cost.valid_from ?? "Sin vigencia"}</small></div>
          <div><span>Precio actual</span><strong>{formatMoney(row.price.value)}</strong><small>{row.price.valid_from ?? "Sin vigencia"}</small></div>
          <div><span>Objetivo</span><strong>{formatPercent(row.ideal_percent)}</strong><small>{row.ideal_percent ? "Ganancia sobre costo" : "Sin objetivo exacto"}</small></div>
        </div>

        {blocked ? (
          <div className="simBlocked" role="alert">
            <ShieldAlert />
            <div>
              <strong>Simulación bloqueada</strong>
              <p>{explain("conflicting_duplicate")}</p>
            </div>
          </div>
        ) : (
          <>
            <section className="simDriver">
              <span className="fieldLabel" id="driverLabel">Conductor</span>
              <div className="segmented" role="group" aria-labelledby="driverLabel">
                {(Object.keys(driverLabels) as Driver[]).map((key) => (
                  <button key={key} className={driver === key ? "active" : ""} aria-pressed={driver === key} onClick={() => changeDriver(key)}>
                    {driverLabels[key]}
                  </button>
                ))}
              </div>
            </section>

            <section className="simInput">
              <label htmlFor="driverValue" className="fieldLabel">
                {driverLabels[driver]} {driver === "gain_percent" ? "(%)" : "($)"}
              </label>
              <input
                id="driverValue"
                type="number"
                inputMode="decimal"
                value={driverValue}
                step={config.step}
                onChange={(event) => { setDriverValue(event.target.value); setServerResult(null); }}
              />
              <input
                className="simSlider"
                type="range"
                min={config.min}
                max={config.max}
                step={config.step}
                value={Number(driverValue || 0)}
                aria-label={`${driverLabels[driver]} (deslizador)`}
                onChange={(event) => { setDriverValue(event.target.value); setServerResult(null); }}
              />
              <p className="simSliderValue" aria-live="polite">
                Valor actual: {driver === "gain_percent" ? `${driverValue || 0}%` : formatMoney(driverValue || "0")}
              </p>
            </section>

            {calcError && <div className="formError" role="alert"><AlertTriangle size={16} />{calcError}</div>}

            <section className="simResults" aria-live="polite">
              <div><span>Precio simulado</span><strong>{formatMoney(serverResult?.price ?? sim?.price ?? null)}</strong></div>
              <div><span>Ganancia $</span><strong>{formatMoney(serverResult?.gain_amount ?? sim?.gainAmount ?? null)}</strong></div>
              <div><span>Ganancia %</span><strong>{formatPercent(serverResult?.gain_percent ?? sim?.gainPercent ?? null)}</strong></div>
              <div><span>Precio objetivo</span><strong>{formatMoney(sim?.idealPrice ?? null)}</strong></div>
            </section>

            <section className={`simThermometer ${thermometer}`}>
              <div className="thermoHead"><ThermometerSun size={18} /><span>{thermometerLabel}</span></div>
              <div className="thermoTrack"><i /></div>
              <div className="thermoDiffs">
                <span>Diferencia $ <strong>{formatMoney(sim?.gapAmount ?? null)}</strong></span>
                <span>Diferencia p.p. <strong>{sim?.gapPoints ? `${sim.gapPoints.toFixed(2)} pp` : "—"}</strong></span>
              </div>
            </section>

            {warningKeys.length > 0 && (
              <section className="simWarnings">
                <span className="fieldLabel">Advertencias</span>
                <ul>
                  {warningKeys.map((key) => (
                    <li key={key}><AlertTriangle size={15} />{explain(key)}</li>
                  ))}
                </ul>
              </section>
            )}

            {saveError && <div className="formError" role="alert"><AlertTriangle size={16} />{saveError}</div>}
            {serverResult && <p className="simSaved" role="status">Simulación guardada. El servidor recalculó y su resultado prevalece.</p>}

            <div className="simActions">
              <button className="textButton" onClick={onClose}>Cerrar</button>
              <button className="primaryButton" onClick={save} disabled={saving || !!calcError}>
                {saving ? "Guardando…" : "Guardar simulación"}
              </button>
            </div>
          </>
        )}

        <section className="simHistory">
          <span className="fieldLabel">Histórico de precio y costo</span>
          <HistoryChart productCode={row.product_code} priceListCode={row.price_list_code} />
        </section>
      </aside>
    </div>
  );
}

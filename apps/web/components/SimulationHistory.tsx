"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type { SavedSimulation } from "@/lib/types";
import { formatMoney, formatPercent } from "@/lib/simulation";

const driverLabel: Record<string, string> = {
  price: "Precio",
  gain_amount: "Ganancia $",
  gain_percent: "Ganancia %",
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/simulations/history");
    if (!res.ok) {
      setError("No se pudo cargar el historial de simulaciones.");
      setLoading(false);
      return;
    }
    setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

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

      {!loading && !error && rows.length === 0 && (
        <div className="emptyState" style={{ marginTop: 24 }}>
          <div className="emptyGlyph"><CheckCircle2 /></div>
          <h2>Sin simulaciones guardadas</h2>
          <p>Cuando guardes una simulación desde el panel de producto, aparecerá aquí.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="tableCard" style={{ marginTop: 24 }}>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Lista</th>
                  <th>Fecha consulta</th>
                  <th>Costo original</th>
                  <th>Conductor</th>
                  <th>Precio simulado</th>
                  <th>Ganancia %</th>
                  <th>Resultado</th>
                  <th>Registrado por</th>
                  <th>Fecha registro</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.product_code}</strong></td>
                    <td><span>{row.price_list_code}</span></td>
                    <td><span>{row.query_date}</span></td>
                    <td>
                      {formatMoney(row.original_cost)}
                      {row.original_ideal_percent && (
                        <small>Obj. {formatPercent(row.original_ideal_percent)}</small>
                      )}
                    </td>
                    <td><span>{driverLabel[row.driver] ?? row.driver}</span></td>
                    <td><strong>{formatMoney(row.simulated_price)}</strong></td>
                    <td>
                      {formatPercent(row.simulated_gain_percent)}
                      <small>{formatMoney(row.simulated_gain_amount)}</small>
                    </td>
                    <td>
                      <ThermometerDot t={row.thermometer} />
                      <span style={{ fontSize: 12 }}>
                        {row.thermometer === "green" ? "Sobre objetivo" : row.thermometer === "red" ? "Bajo objetivo" : "Sin objetivo"}
                      </span>
                    </td>
                    <td><span>{row.actor_email}</span></td>
                    <td>
                      <span>{new Date(row.created_at).toLocaleDateString("es-AR")}</span>
                      <small>{new Date(row.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

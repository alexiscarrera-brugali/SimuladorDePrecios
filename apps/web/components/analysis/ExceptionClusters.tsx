"use client";

import { AlertTriangle, LayoutGrid, ShieldAlert, TrendingDown } from "lucide-react";
import type { ExceptionKey, PortfolioSummary } from "@/lib/portfolio";

const CLUSTERS: { key: ExceptionKey; label: string; caption: string; tone: string; icon: typeof TrendingDown }[] = [
  { key: "below_target", label: "Bajo objetivo", caption: "Margen actual < objetivo", tone: "orange", icon: TrendingDown },
  { key: "without_cost", label: "Sin costo", caption: "No hay costo vigente", tone: "yellow", icon: AlertTriangle },
  { key: "conflict", label: "Conflictos", caption: "Bloquean sólo su fila", tone: "red", icon: ShieldAlert },
];

export function ExceptionClusters({
  summary,
  active,
  onToggle,
}: {
  summary: PortfolioSummary;
  active: ExceptionKey | null;
  onToggle: (key: ExceptionKey | null) => void;
}) {
  const counts: Record<ExceptionKey, number> = {
    below_target: summary.belowTarget,
    without_cost: summary.withoutCost,
    conflict: summary.conflict,
  };

  return (
    <div className="exceptionRow" role="group" aria-label="Filtrar por excepción">
      <button
        className={`exceptionChip all ${active === null ? "active" : ""}`}
        aria-pressed={active === null}
        onClick={() => onToggle(null)}
      >
        <span className="exIcon"><LayoutGrid size={16} /></span>
        <span className="exText">
          <strong>{summary.total.toLocaleString("es-AR")}</strong>
          <span>Todos</span>
          <small>Ninguna falla se oculta</small>
        </span>
      </button>

      {CLUSTERS.map(({ key, label, caption, tone, icon: Icon }) => {
        const count = counts[key];
        const isActive = active === key;
        return (
          <button
            key={key}
            className={`exceptionChip ${tone} ${isActive ? "active" : ""} ${count === 0 ? "empty" : ""}`}
            aria-pressed={isActive}
            disabled={count === 0}
            onClick={() => onToggle(isActive ? null : key)}
          >
            <span className="exIcon"><Icon size={16} /></span>
            <span className="exText">
              <strong>{count.toLocaleString("es-AR")}</strong>
              <span>{label}</span>
              <small>{caption}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

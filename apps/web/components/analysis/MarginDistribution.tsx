"use client";

import { useId, useState } from "react";
import type { GapHistogram, PortfolioSummary } from "@/lib/portfolio";

// Lienzo interno fijo; el SVG escala a 100% del contenedor.
const W = 720;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 34, left: 16 };
const PLOT_H = H - PAD.top - PAD.bottom;

function fmtEdge(v: number): string {
  const rounded = Number(v.toFixed(2));
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toString();
  return rounded > 0 ? `+${body}` : body;
}

export function MarginDistribution({
  histogram,
  summary,
}: {
  histogram: GapHistogram;
  summary: PortfolioSummary;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();

  if (histogram.buckets.length === 0 || histogram.maxCount === 0) {
    return (
      <div className="vizEmpty">
        <p>Sin productos evaluables todavía: cargá objetivo y costo para ver la distribución.</p>
      </div>
    );
  }

  const n = histogram.buckets.length;
  const plotW = W - PAD.left - PAD.right;
  const gap = 2; // separación entre barras (px del lienzo)
  const barW = plotW / n - gap;
  const baselineY = PAD.top + PLOT_H;
  const zeroIdx = histogram.buckets.findIndex((b) => b.from >= 0);
  const zeroX = zeroIdx >= 0 ? PAD.left + zeroIdx * (plotW / n) : null;

  const active = hover !== null ? histogram.buckets[hover] : null;

  return (
    <figure className="viz" aria-labelledby={titleId}>
      <figcaption id={titleId} className="vizCaption">
        Distribución de la brecha contra el objetivo · {summary.evaluated} productos evaluados
      </figcaption>

      <div className="vizLegend" aria-hidden="true">
        <span><i className="vizSwatch below" />Bajo objetivo</span>
        <span><i className="vizSwatch above" />En o sobre objetivo</span>
      </div>

      <div className="vizPlot">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" preserveAspectRatio="none"
          aria-label={`Histograma de la brecha de margen en puntos porcentuales. ${summary.belowTarget} productos por debajo del objetivo, ${summary.atOrAboveTarget} en o por encima.`}>
          {/* línea base */}
          <line x1={PAD.left} y1={baselineY} x2={W - PAD.right} y2={baselineY} className="vizBaseline" />

          {/* línea de objetivo (0 pp) */}
          {zeroX !== null && (
            <g>
              <line x1={zeroX} y1={PAD.top - 4} x2={zeroX} y2={baselineY} className="vizTarget" />
              <text x={zeroX + 4} y={PAD.top + 6} className="vizTargetLabel">Objetivo</text>
            </g>
          )}

          {histogram.buckets.map((b, i) => {
            const h = b.count === 0 ? 0 : Math.max(3, (b.count / histogram.maxCount) * PLOT_H);
            const x = PAD.left + i * (plotW / n) + gap / 2;
            const y = baselineY - h;
            return (
              <g key={`${b.from}-${b.to}`}>
                <rect
                  x={x} y={y} width={Math.max(1, barW)} height={h} rx={3}
                  className={`vizBar ${b.below ? "below" : "above"} ${hover === i ? "hot" : ""}`}
                />
                {/* zona de captura de hover, ancho completo de la columna */}
                <rect
                  x={PAD.left + i * (plotW / n)} y={PAD.top} width={plotW / n} height={PLOT_H}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
                >
                  <title>{`${fmtEdge(b.from)} a ${fmtEdge(b.to)} pp · ${b.count} producto${b.count === 1 ? "" : "s"}`}</title>
                </rect>
              </g>
            );
          })}

          {/* etiquetas de eje: extremos y cero */}
          <text x={PAD.left} y={H - 12} className="vizAxis">{fmtEdge(histogram.buckets[0].from)} pp</text>
          <text x={W - PAD.right} y={H - 12} className="vizAxis end">{fmtEdge(histogram.buckets[n - 1].to)} pp</text>
        </svg>

        {active && (
          <div className="vizTip" role="status">
            <strong>{fmtEdge(active.from)} a {fmtEdge(active.to)} pp</strong>
            <span>{active.count} producto{active.count === 1 ? "" : "s"}</span>
            <small>{active.below ? "Por debajo del objetivo" : "En o por encima del objetivo"}</small>
          </div>
        )}
      </div>
    </figure>
  );
}

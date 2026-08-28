"use client";

import { formatMoney } from "@/lib/simulation";

// Cascada costo → precio: muestra cómo se compone el precio (costo + ganancia)
// y dónde queda el precio objetivo. Visual nativa de finanzas para leer la
// brecha de un vistazo. Todo con tokens de tema; sin dependencias externas.

const W = 560;
const ROW_H = 34;
const GAP = 14;
const PAD_L = 90;
const PAD_R = 16;
const PLOT_W = W - PAD_L - PAD_R;

const toNum = (v: string | null): number | null => (v === null || v.trim() === "" ? null : Number(v));

export function MarginBridge({
  cost,
  price,
  idealPrice,
  thermometer,
}: {
  cost: string | null;
  price: string | null;
  idealPrice: string | null;
  thermometer: "green" | "red" | "neutral";
}) {
  const c = toNum(cost);
  const p = toNum(price);
  const ideal = toNum(idealPrice);

  if (c === null || p === null) {
    return <p className="bridgeEmpty">Cargá costo y precio para ver la composición.</p>;
  }

  const max = Math.max(p, ideal ?? 0, c) * 1.08 || 1;
  const x = (v: number) => PAD_L + (Math.max(0, v) / max) * PLOT_W;
  const gainClass = thermometer === "red" ? "gainDown" : thermometer === "green" ? "gainUp" : "gainNeutral";

  const rows = [
    { key: "cost", label: "Costo", y: 0 },
    { key: "sim", label: "Precio", y: ROW_H + GAP },
  ];
  const H = rows.length * ROW_H + (rows.length - 1) * GAP + 26;
  const idealX = ideal !== null ? x(ideal) : null;

  return (
    <svg className="bridge" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={`Composición del precio: costo ${formatMoney(cost)}, precio ${formatMoney(price)}${ideal !== null ? `, precio objetivo ${formatMoney(idealPrice)}` : ""}.`}>
      {/* Costo */}
      <text x={PAD_L - 10} y={rows[0].y + ROW_H / 2 + 4} className="bridgeLabel">Costo</text>
      <rect x={x(0)} y={rows[0].y} width={x(c) - x(0)} height={ROW_H} rx={4} className="bridgeCost" />
      <text x={x(c) + 6} y={rows[0].y + ROW_H / 2 + 4} className="bridgeValue">{formatMoney(cost)}</text>

      {/* Precio simulado: costo (base) + ganancia */}
      <text x={PAD_L - 10} y={rows[1].y + ROW_H / 2 + 4} className="bridgeLabel">Precio</text>
      <rect x={x(0)} y={rows[1].y} width={x(c) - x(0)} height={ROW_H} rx={4} className="bridgeBase" />
      {p > c && (
        <rect x={x(c)} y={rows[1].y} width={x(p) - x(c)} height={ROW_H} rx={4} className={`bridgeGain ${gainClass}`} />
      )}
      {p < c && (
        <rect x={x(p)} y={rows[1].y} width={x(c) - x(p)} height={ROW_H} rx={4} className="bridgeLoss" />
      )}
      <text x={x(Math.max(p, c)) + 6} y={rows[1].y + ROW_H / 2 + 4} className="bridgeValue">{formatMoney(price)}</text>

      {/* Marca de precio objetivo */}
      {idealX !== null && (
        <g>
          <line x1={idealX} y1={-2} x2={idealX} y2={rows[1].y + ROW_H + 4} className="bridgeTarget" />
          <text x={idealX} y={H - 6} textAnchor="middle" className="bridgeTargetLabel">Objetivo {formatMoney(idealPrice)}</text>
        </g>
      )}
    </svg>
  );
}

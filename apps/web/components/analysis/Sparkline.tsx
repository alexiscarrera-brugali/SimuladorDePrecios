"use client";

// Sparkline mínima de la serie de precio de un producto. Con dos vigencias es un
// segmento que muestra la última variación; se enriquece sola al acumular fechas.

const W = 56;
const H = 18;

export function Sparkline({ values }: { values: number[] | undefined }) {
  if (!values || values.length === 0) return <span className="sparkEmpty" aria-hidden="true">—</span>;

  const last = values[values.length - 1];
  const first = values[0];
  const delta = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const dir = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
  const label = values.length < 2 ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(0)}%`;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? W / (values.length - 1) : W;
  const points = values.map((v, i) => {
    const x = values.length > 1 ? i * stepX : W / 2;
    const y = H - 2 - ((v - min) / span) * (H - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <span className="spark">
      <svg className="sparkSvg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {values.length > 1 && <polyline className="sparkLine" points={points.join(" ")} />}
        {(() => {
          const [x, y] = points[points.length - 1].split(",");
          return <circle className="sparkDot" cx={x} cy={y} r={2} />;
        })()}
      </svg>
      <span className={`sparkDelta ${dir}`} aria-label={`Variación ${label}`}>{label}</span>
    </span>
  );
}

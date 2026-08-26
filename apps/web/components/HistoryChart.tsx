"use client";

import { useEffect, useMemo, useState } from "react";
import type { HistoryResult } from "@/lib/types";
import { formatMoney } from "@/lib/simulation";

type Point = { date: string; value: number | null };

const WIDTH = 520;
const HEIGHT = 180;
const PAD = { top: 16, right: 16, bottom: 26, left: 8 };

function toPoints(series: { date: string; value: string | null }[]): Point[] {
  return [...series]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({ date: date10(item.date), value: item.value === null ? null : Number(item.value) }));
}

function date10(value: string): string {
  return value.slice(0, 10);
}

// Genera segmentos de escalón; corta la línea donde el valor es nulo (conflicto/vacío).
function steppedSegments(points: Point[], x: (i: number) => number, y: (v: number) => number): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length) segments.push(current.join(" "));
      current = [];
      return;
    }
    const px = x(index);
    const py = y(point.value);
    if (!current.length) {
      current.push(`M ${px} ${py}`);
    } else {
      current.push(`H ${px}`, `V ${py}`);
    }
  });
  if (current.length) segments.push(current.join(" "));
  return segments;
}

export function HistoryChart({ productCode, priceListCode }: { productCode: string; priceListCode: string }) {
  const [data, setData] = useState<HistoryResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    const params = new URLSearchParams({ price_list: priceListCode });
    fetch(`/api/products/${encodeURIComponent(productCode)}/history?${params}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((json: HistoryResult) => active && setData(json))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [productCode, priceListCode]);

  const chart = useMemo(() => {
    if (!data) return null;
    const prices = toPoints(data.prices);
    const costs = toPoints(data.costs);
    const dates = Array.from(new Set([...prices, ...costs].map((p) => p.date))).sort();
    const values = [...prices, ...costs].map((p) => p.value).filter((v): v is number => v !== null);
    if (!dates.length || !values.length) return { empty: true } as const;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.abs(max) || 1;
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const xFor = (date: string) => {
      const i = dates.indexOf(date);
      return PAD.left + (dates.length === 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
    };
    const yFor = (v: number) => PAD.top + innerH - ((v - min) / span) * innerH;

    const indexer = (points: Point[]) => (i: number) => xFor(points[i].date);
    const priceSeg = steppedSegments(prices, indexer(prices), yFor);
    const costSeg = steppedSegments(costs, indexer(costs), yFor);

    return {
      empty: false as const,
      priceSeg,
      costSeg,
      pricePoints: prices.map((p) => ({ ...p, cx: xFor(p.date), cy: p.value === null ? null : yFor(p.value) })),
      costPoints: costs.map((p) => ({ ...p, cx: xFor(p.date), cy: p.value === null ? null : yFor(p.value) })),
      min,
      max,
    };
  }, [data]);

  if (error) return <p className="historyEmpty">No pudimos cargar el histórico.</p>;
  if (!data) return <p className="historyEmpty">Cargando histórico…</p>;
  if (!chart || chart.empty) return <p className="historyEmpty">Sin histórico para este producto.</p>;

  return (
    <figure className="historyChart">
      <figcaption>
        <span className="legendItem price"><i />Precio</span>
        <span className="legendItem cost"><i />Costo</span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Histórico escalonado de precio y costo">
        <path className="historyLine cost" d={chart.costSeg.join(" ")} fill="none" />
        <path className="historyLine price" d={chart.priceSeg.join(" ")} fill="none" />
        {chart.costPoints.map((p, i) =>
          p.cy === null ? null : <circle key={`c-${i}`} className="historyDot cost" cx={p.cx} cy={p.cy} r={2.6} />,
        )}
        {chart.pricePoints.map((p, i) =>
          p.cy === null ? null : <circle key={`p-${i}`} className="historyDot price" cx={p.cx} cy={p.cy} r={2.6} />,
        )}
      </svg>
      <div className="historyRange">
        <span>mín {formatMoney(String(chart.min))}</span>
        <span>máx {formatMoney(String(chart.max))}</span>
      </div>
    </figure>
  );
}

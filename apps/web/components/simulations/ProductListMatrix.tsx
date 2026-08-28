"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatPercent } from "@/lib/simulation";

interface MatrixCell {
  code: string;
  description: string;
  price: string | null;
  ideal_percent: string | null;
  gain_percent: string | null;
  gap_points: number | null;
  thermometer: "green" | "red" | "neutral";
  has_price: boolean;
}
interface MatrixResponse {
  product_code: string;
  cost: string | null;
  lists: MatrixCell[];
}

export function ProductListMatrix({ productCode, queryDate, currentListCode }: { productCode: string; queryDate: string; currentListCode: string }) {
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // Reinicia el estado de carga cuando cambia el producto consultado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/products/${encodeURIComponent(productCode)}/by-list?date=${queryDate}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [productCode, queryDate]);

  if (loading) return <p className="matrixEmpty">Cargando márgenes por lista…</p>;
  if (!data || data.lists.length === 0) return <p className="matrixEmpty">Sin datos de otras listas.</p>;

  const priced = data.lists.filter((l) => l.has_price).length;

  return (
    <div className="listMatrix">
      <p className="matrixLead">Margen del producto en cada lista de precio · {priced} con precio vigente</p>
      <div className="matrixGrid">
        {data.lists.map((cell) => (
          <div
            key={cell.code}
            className={`matrixCell ${cell.has_price ? cell.thermometer : "empty"} ${cell.code === currentListCode ? "current" : ""}`}
            title={cell.has_price
              ? `${cell.description}: margen ${formatPercent(cell.gain_percent)}${cell.gap_points !== null ? ` (${cell.gap_points > 0 ? "+" : ""}${cell.gap_points} pp vs objetivo)` : ""}`
              : `${cell.description}: sin precio vigente`}
          >
            <span className="matrixListName">{cell.description}</span>
            {cell.has_price ? (
              <>
                <strong className="matrixMargin">{formatPercent(cell.gain_percent)}</strong>
                <small className="matrixPrice">{formatMoney(cell.price)}</small>
                {cell.gap_points !== null && (
                  <span className="matrixGap">{cell.gap_points > 0 ? "+" : ""}{cell.gap_points} pp</span>
                )}
              </>
            ) : (
              <span className="matrixNoPrice">Sin precio</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

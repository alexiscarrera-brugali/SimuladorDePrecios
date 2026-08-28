// Agregados de cartera para el cockpit del analista. Funciones puras sobre las
// filas del contrato de UI (snake_case). El histograma mide la BRECHA de cada
// producto contra su propio objetivo (margen actual − objetivo, en puntos
// porcentuales): el punto neutro es 0 (en objetivo), lo que permite leer de un
// vistazo si la cartera está sesgada por debajo o por encima del objetivo.
import Decimal from "decimal.js";
import type { AnalysisRow } from "./types";

/**
 * Tolerancia (en puntos porcentuales) para considerar un producto "bajo
 * objetivo". Por debajo de este umbral la diferencia es ruido de redondeo del
 * precio contra el objetivo exacto y no debe generar una alarma accionable.
 */
export const TARGET_TOLERANCE_PP = 0.5;

export type ExceptionKey = "below_target" | "without_cost" | "conflict";

export interface PortfolioSummary {
  total: number; // filas visibles
  evaluated: number; // con brecha calculable (margen actual y objetivo presentes)
  belowTarget: number; // margen actual < objetivo
  atOrAboveTarget: number; // margen actual ≥ objetivo
  withoutTarget: number; // sin objetivo de referencia
  withoutCost: number; // sin costo vigente
  conflict: number; // fila en conflicto (simulación bloqueada)
  worstGapPoints: number | null; // brecha más negativa, en pp
}

export interface GapBucket {
  from: number; // límite inferior de la brecha (pp), inclusive
  to: number; // límite superior de la brecha (pp), exclusive
  count: number;
  below: boolean; // el bucket cae íntegramente por debajo del objetivo
}

export interface GapHistogram {
  buckets: GapBucket[];
  evaluated: number;
  maxCount: number; // pico, para escalar el eslabón visual
}

const num = (value: string | null): number | null =>
  value === null || value.trim() === "" ? null : Number(value);

/** Brecha en pp (margen actual − objetivo) usando aritmética decimal para el signo. */
function gapPoints(row: AnalysisRow): number | null {
  if (row.actual_gain_percent === null || row.ideal_percent === null) return null;
  if (row.actual_gain_percent.trim() === "" || row.ideal_percent.trim() === "") return null;
  return new Decimal(row.actual_gain_percent).minus(row.ideal_percent).toNumber();
}

export function portfolioSummary(rows: AnalysisRow[]): PortfolioSummary {
  const summary: PortfolioSummary = {
    total: rows.length,
    evaluated: 0,
    belowTarget: 0,
    atOrAboveTarget: 0,
    withoutTarget: 0,
    withoutCost: 0,
    conflict: 0,
    worstGapPoints: null,
  };

  for (const row of rows) {
    if (row.data_status === "conflict") summary.conflict += 1;
    if (num(row.cost.value) === null) summary.withoutCost += 1;
    if (row.ideal_percent === null || row.ideal_percent.trim() === "") summary.withoutTarget += 1;

    const gap = gapPoints(row);
    if (gap === null) continue;
    summary.evaluated += 1;
    // Sólo cuenta como "bajo objetivo" si supera la tolerancia; lo de adentro
    // es redondeo y se considera en objetivo.
    if (gap < -TARGET_TOLERANCE_PP) summary.belowTarget += 1;
    else summary.atOrAboveTarget += 1;
    if (summary.worstGapPoints === null || gap < summary.worstGapPoints) summary.worstGapPoints = gap;
  }

  return summary;
}

/** Paso "redondo" para ~10 bins según el rango; 0 siempre cae en un borde. */
export function niceBinSize(range: number, targetBins = 10): number {
  if (!(range > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(range / targetBins)));
  for (const mult of [1, 2, 2.5, 5, 10]) {
    if (range / (mult * pow) <= targetBins * 1.5) return mult * pow;
  }
  return 10 * pow;
}

/**
 * Distribución de la brecha con 0 siempre en un borde (por eso ningún bin cruza
 * el objetivo). Cada brecha cae en exactamente un bin. Si no se pasa `binSize`,
 * se elige un paso redondo acorde al rango real de los datos.
 */
export function bucketGaps(rows: AnalysisRow[], binSize?: number): GapHistogram {
  const gaps: number[] = [];
  for (const row of rows) {
    const gap = gapPoints(row);
    if (gap !== null) gaps.push(gap);
  }
  if (gaps.length === 0) return { buckets: [], evaluated: 0, maxCount: 0 };

  const lo = Math.min(...gaps);
  const hi = Math.max(...gaps);
  const step = binSize ?? niceBinSize(hi - lo);
  const start = Math.min(Math.floor(lo / step) * step, 0);
  const end = Math.max(Math.ceil((hi + step) / step) * step, step);
  const nbins = Math.max(1, Math.round((end - start) / step));

  const counts = new Array<number>(nbins).fill(0);
  for (const gap of gaps) {
    let idx = Math.floor((gap - start) / step);
    if (idx < 0) idx = 0;
    if (idx >= nbins) idx = nbins - 1;
    counts[idx] += 1;
  }

  const round = (v: number) => Number(v.toFixed(4));
  const buckets: GapBucket[] = counts.map((count, idx) => {
    const from = round(start + idx * step);
    const to = round(from + step);
    return { from, to, count, below: to <= 0 };
  });

  return { buckets, evaluated: gaps.length, maxCount: Math.max(...counts) };
}

/** Predicado reutilizable por los clusters de excepción (filtro de la tabla). */
export function matchesException(row: AnalysisRow, key: ExceptionKey): boolean {
  switch (key) {
    case "conflict":
      return row.data_status === "conflict";
    case "without_cost":
      return num(row.cost.value) === null;
    case "below_target": {
      const gap = gapPoints(row);
      return gap !== null && gap < -TARGET_TOLERANCE_PP;
    }
  }
}

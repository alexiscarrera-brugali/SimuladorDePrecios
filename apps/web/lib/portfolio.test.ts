import { describe, expect, it } from "vitest";
import { bucketGaps, matchesException, niceBinSize, portfolioSummary } from "./portfolio";
import type { AnalysisRow } from "./types";

function row(over: Partial<Omit<AnalysisRow, "cost">> & { actual?: string | null; ideal?: string | null; cost?: string | null }): AnalysisRow {
  const { actual, ideal, cost, ...rest } = over;
  return {
    product_code: "P1",
    description: null,
    branch_code: "1",
    price_list_code: "L1",
    price_list_name: "Lista 1",
    price: { value: "100", valid_from: null, status: "ok", warnings: [] },
    cost: { value: cost === undefined ? "80" : cost, valid_from: null, status: "ok", warnings: [] },
    ideal_percent: ideal === undefined ? "25" : ideal,
    actual_gain_amount: null,
    actual_gain_percent: actual === undefined ? "25" : actual,
    data_status: "ok",
    warnings: [],
    simulation_blocked: false,
    ...rest,
  };
}

describe("portfolioSummary", () => {
  it("cartera vacía → todo en cero", () => {
    const s = portfolioSummary([]);
    expect(s).toMatchObject({ total: 0, evaluated: 0, belowTarget: 0, atOrAboveTarget: 0, worstGapPoints: null });
  });

  it("clasifica bajo/sobre objetivo con el límite exacto contando como sobre", () => {
    const s = portfolioSummary([
      row({ actual: "20", ideal: "25" }), // −5 → bajo
      row({ actual: "25", ideal: "25" }), // 0 → sobre (≥)
      row({ actual: "30", ideal: "25" }), // +5 → sobre
    ]);
    expect(s.evaluated).toBe(3);
    expect(s.belowTarget).toBe(1);
    expect(s.atOrAboveTarget).toBe(2);
    expect(s.worstGapPoints).toBe(-5);
  });

  it("una brecha dentro de la tolerancia es ruido de redondeo, no cuenta como bajo objetivo", () => {
    const s = portfolioSummary([
      row({ actual: "24.97", ideal: "25" }), // −0.03 → dentro de tolerancia
      row({ actual: "23", ideal: "25" }), // −2 → bajo de verdad
    ]);
    expect(s.belowTarget).toBe(1);
    expect(s.atOrAboveTarget).toBe(1);
  });

  it("cuenta sin objetivo, sin costo y conflicto sin romper la evaluación", () => {
    const s = portfolioSummary([
      row({ actual: null, ideal: null, cost: null }), // sin costo y sin objetivo
      row({ ideal: "", actual: "10" }), // sin objetivo (vacío)
      row({ data_status: "conflict", actual: "5", ideal: "25" }),
    ]);
    expect(s.withoutCost).toBe(1);
    expect(s.withoutTarget).toBe(2);
    expect(s.conflict).toBe(1);
    expect(s.evaluated).toBe(1); // solo la fila en conflicto tiene ambos datos
  });
});

describe("bucketGaps", () => {
  it("sin datos evaluables → histograma vacío", () => {
    const h = bucketGaps([row({ actual: null, ideal: null })]);
    expect(h).toEqual({ buckets: [], evaluated: 0, maxCount: 0 });
  });

  it("0 siempre es un borde: ningún bin cruza el objetivo", () => {
    const h = bucketGaps([
      row({ actual: "20", ideal: "25" }), // −5
      row({ actual: "30", ideal: "25" }), // +5
    ], 5);
    for (const b of h.buckets) {
      expect(b.from < 0 && b.to > 0).toBe(false);
      if (b.to <= 0) expect(b.below).toBe(true);
      if (b.from >= 0) expect(b.below).toBe(false);
    }
  });

  it("cada brecha cae en exactamente un bin y los conteos suman el total evaluado", () => {
    const rows = [
      row({ actual: "10", ideal: "25" }), // −15
      row({ actual: "23", ideal: "25" }), // −2
      row({ actual: "25", ideal: "25" }), // 0
      row({ actual: "40", ideal: "25" }), // +15
    ];
    const h = bucketGaps(rows, 5);
    expect(h.evaluated).toBe(4);
    expect(h.buckets.reduce((acc, b) => acc + b.count, 0)).toBe(4);
    expect(h.maxCount).toBeGreaterThanOrEqual(1);
  });
});

describe("niceBinSize", () => {
  it("elige un paso fino para rangos angostos y grueso para amplios", () => {
    expect(niceBinSize(0.08)).toBeLessThanOrEqual(0.01);
    expect(niceBinSize(60)).toBeGreaterThanOrEqual(5);
  });

  it("con datos que abrazan el objetivo el histograma no colapsa en una sola barra", () => {
    const rows = [
      row({ actual: "24.96", ideal: "25" }), // −0.04
      row({ actual: "24.99", ideal: "25" }), // −0.01
      row({ actual: "25.02", ideal: "25" }), // +0.02
    ];
    const h = bucketGaps(rows); // paso dinámico
    expect(h.buckets.length).toBeGreaterThan(1);
    expect(h.buckets.reduce((a, b) => a + b.count, 0)).toBe(3);
  });
});

describe("matchesException", () => {
  it("below_target sólo cuando la brecha es negativa", () => {
    expect(matchesException(row({ actual: "20", ideal: "25" }), "below_target")).toBe(true);
    expect(matchesException(row({ actual: "25", ideal: "25" }), "below_target")).toBe(false);
    expect(matchesException(row({ actual: null, ideal: "25" }), "below_target")).toBe(false);
  });

  it("without_cost y conflict", () => {
    expect(matchesException(row({ cost: null }), "without_cost")).toBe(true);
    expect(matchesException(row({ cost: "80" }), "without_cost")).toBe(false);
    expect(matchesException(row({ data_status: "conflict" }), "conflict")).toBe(true);
  });
});

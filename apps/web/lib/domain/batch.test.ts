import { describe, expect, it } from "vitest";
import { Decimal } from "./decimal";
import { applyBatch, type BatchInputRow } from "./batch";

const D = (s: string) => new Decimal(s);

function inputRow(over: Partial<BatchInputRow> = {}): BatchInputRow {
  return {
    productCode: "P1",
    branchCode: "1",
    cost: D("100"),
    price: D("120"), // 20% de margen
    idealPercent: D("25"),
    actualGainPercent: D("20"),
    ...over,
  };
}

describe("applyBatch — regla to_target", () => {
  it("lleva cada producto al objetivo: precio pasa a costo·(1+obj) y el margen queda en el objetivo", () => {
    const out = applyBatch([inputRow()], { kind: "to_target" });
    const item = out.items[0];
    expect(item.skipped).toBe(false);
    expect(item.afterPrice?.toFixed()).toBe("125"); // 100 + 25%
    expect(item.afterGainPercent?.toFixed()).toBe("25");
    expect(item.crossedIntoTarget).toBe(true);
    expect(out.aggregate.crossedIntoTarget).toBe(1);
    expect(out.aggregate.belowTargetBefore).toBe(1);
    expect(out.aggregate.belowTargetAfter).toBe(0);
  });

  it("omite productos sin objetivo con un motivo claro", () => {
    const out = applyBatch([inputRow({ idealPercent: null })], { kind: "to_target" });
    expect(out.items[0].skipped).toBe(true);
    expect(out.items[0].reason).toBe("sin objetivo de referencia");
    expect(out.aggregate.evaluated).toBe(0);
    expect(out.aggregate.skipped).toBe(1);
  });
});

describe("applyBatch — regla price_delta_pct", () => {
  it("+10% al precio sube el margen y puede cruzar el objetivo", () => {
    const out = applyBatch([inputRow()], { kind: "price_delta_pct", value: D("10") });
    const item = out.items[0];
    expect(item.afterPrice?.toFixed()).toBe("132"); // 120 * 1.10
    expect(item.afterGainPercent?.toFixed()).toBe("32"); // (132-100)/100
    expect(item.crossedIntoTarget).toBe(true);
  });

  it("omite si no hay precio vigente", () => {
    const out = applyBatch([inputRow({ price: null })], { kind: "price_delta_pct", value: D("10") });
    expect(out.items[0].skipped).toBe(true);
    expect(out.items[0].reason).toBe("sin precio vigente");
  });
});

describe("applyBatch — regla cost_shock_pct", () => {
  it("un shock de costo erosiona el margen a precio constante y puede caer bajo objetivo", () => {
    // Parte en el objetivo (precio 125, costo 100 → 25%). Un +10% de costo lo baja.
    const out = applyBatch(
      [inputRow({ price: D("125"), actualGainPercent: D("25") })],
      { kind: "cost_shock_pct", value: D("10") },
    );
    const item = out.items[0];
    expect(item.beforePrice?.toFixed()).toBe("125");
    expect(item.afterPrice?.toFixed()).toBe("125"); // el precio no cambia
    // margen = (125 - 110) / 110 = 13.63...%
    expect(Number(item.afterGainPercent?.toFixed(2))).toBeCloseTo(13.64, 1);
    expect(item.fellBelowTarget).toBe(true);
    expect(out.aggregate.fellBelowTarget).toBe(1);
    expect(out.aggregate.belowTargetAfter).toBe(1);
  });
});

describe("applyBatch — agregado", () => {
  it("promedia el margen antes y después sobre las filas evaluables", () => {
    const rows = [
      inputRow({ productCode: "A", actualGainPercent: D("20") }),
      inputRow({ productCode: "B", actualGainPercent: D("10") }),
    ];
    const out = applyBatch(rows, { kind: "to_target" });
    expect(out.aggregate.selected).toBe(2);
    expect(out.aggregate.evaluated).toBe(2);
    expect(out.aggregate.meanGainBefore).toBe("15.00"); // (20 + 10) / 2
    expect(out.aggregate.meanGainAfter).toBe("25.00"); // ambos al objetivo
    expect(out.aggregate.weighting).toBe("count");
  });
});

import { describe, expect, it } from "vitest";
import { Decimal } from "./decimal";
import { analyze, type AnalyzeInput, type ProductRef } from "./analysis";
import type { CostRecord, MarginRecord, PriceRecord } from "./importer";
import type { SourceStatus } from "./types";

const LIST = { code: "1", description: "Franquicias Cordoba" };
const DATE = "2026-08-01";
const V = "2026-07-20";

function price(product: string, value: string | null, opts: { branch?: string; date?: string; status?: SourceStatus; row?: number } = {}): PriceRecord {
  return {
    branchCode: opts.branch ?? "101",
    priceListCode: "1",
    productCode: product,
    value: value === null ? null : new Decimal(value),
    validFrom: opts.date ?? V,
    sourceStatus: opts.status ?? "active",
    sourceRow: opts.row ?? 1,
  };
}

function cost(product: string, value: string | null, opts: { branch?: string; date?: string; status?: SourceStatus; row?: number } = {}): CostRecord {
  return {
    branchCode: opts.branch ?? "1",
    productCode: product,
    description: "desc",
    value: value === null ? null : new Decimal(value),
    validFrom: opts.date ?? V,
    sourceStatus: opts.status ?? "active",
    sourceRow: opts.row ?? 1,
  };
}

function margin(product: string, percentage: string, ambiguous = false): MarginRecord {
  return { priceListName: LIST.description, productCode: product, percentage: new Decimal(percentage), isAmbiguous: ambiguous, sourceRow: 1 };
}

function input(over: Partial<AnalyzeInput>): AnalyzeInput {
  const products = new Map<string, ProductRef>([["P1", { code: "P1", description: "Producto uno" }]]);
  return { queryDate: DATE, priceList: LIST, prices: [], costs: [], margins: [], products, ...over };
}

describe("analyze", () => {
  it("resuelve precio/costo vigentes y margen actual (con fallback de sucursal)", () => {
    const res = analyze(input({ prices: [price("P1", "1000")], costs: [cost("P1", "800")], margins: [margin("P1", "25")] }));
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0];
    expect(row.cost.value).toBe("800"); // costo de sucursal 1 vía fallback
    expect(row.price.value).toBe("1000");
    expect(row.idealPercent).toBe("25");
    expect(row.actualGainPercent).toBe("25");
    expect(row.dataStatus).toBe("ok");
    expect(row.simulationBlocked).toBe(false);
  });

  it("conflicto de precio bloquea la fila", () => {
    const res = analyze(input({
      prices: [price("P1", "700", { row: 1 }), price("P1", "900", { row: 2 })],
      costs: [cost("P1", "800")],
      margins: [margin("P1", "25")],
    }));
    const row = res.rows[0];
    expect(row.dataStatus).toBe("conflict");
    expect(row.simulationBlocked).toBe(true);
    expect(row.actualGainPercent).toBeNull();
    expect(res.counts.conflict).toBe(1);
  });

  it("sin objetivo exacto → advertencia missing_ideal_margin", () => {
    const res = analyze(input({ prices: [price("P1", "1000")], costs: [cost("P1", "800")], margins: [] }));
    const row = res.rows[0];
    expect(row.warnings).toContain("missing_ideal_margin");
    expect(row.dataStatus).toBe("warning");
  });

  it("precio cero con costo válido → −100% y valor visible", () => {
    const res = analyze(input({ prices: [price("P1", "0")], costs: [cost("P1", "800")], margins: [margin("P1", "25")] }));
    const row = res.rows[0];
    expect(row.actualGainPercent).toBe("-100");
    expect(row.warnings).toContain("zero_value");
    expect(row.dataStatus).toBe("warning");
  });

  it("objetivo ambiguo no se aplica", () => {
    const res = analyze(input({ prices: [price("P1", "1000")], costs: [cost("P1", "800")], margins: [margin("P1", "25", true)] }));
    expect(res.rows[0].idealPercent).toBeNull();
    expect(res.rows[0].warnings).toContain("missing_ideal_margin");
  });

  it("agrega conteos por estado", () => {
    const res = analyze(input({
      prices: [price("P1", "1000"), price("P2", "0")],
      costs: [cost("P1", "800"), cost("P2", "500")],
      margins: [margin("P1", "25")],
      products: new Map([["P1", { code: "P1", description: "uno" }], ["P2", { code: "P2", description: "dos" }]]),
    }));
    expect(res.counts.total).toBe(2);
    expect(res.counts.ok).toBe(1); // P1 ok
    expect(res.counts.warning).toBe(1); // P2 precio cero
  });
});

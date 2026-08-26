import { describe, expect, it } from "vitest";
import { Decimal } from "./decimal";
import { simulate } from "./simulation";
import { EngineError, type Driver } from "./types";

const D = (s: string) => new Decimal(s);

function run(driver: Driver, driverValue: string, opts: { cost?: string | null; ideal?: string | null; inactive?: boolean; unknown?: boolean } = {}) {
  return simulate({
    cost: opts.cost === undefined ? D("100") : opts.cost === null ? null : D(opts.cost),
    driver,
    driverValue: D(driverValue),
    idealPercent: opts.ideal == null ? null : D(opts.ideal),
    sourceInactive: opts.inactive,
    sourceUnknown: opts.unknown,
  });
}

describe("simulate — doble vía", () => {
  it("costo 100 + 25% → ganancia 25, precio 125", () => {
    const r = run("gain_percent", "25");
    expect(r.gainAmount?.toFixed()).toBe("25");
    expect(r.price?.toFixed()).toBe("125");
    expect(r.gainPercent?.toFixed()).toBe("25");
  });

  it("costo 100 + precio 130 → ganancia 30, 30%", () => {
    const r = run("price", "130");
    expect(r.gainAmount?.toFixed()).toBe("30");
    expect(r.gainPercent?.toFixed()).toBe("30");
  });

  it("costo 100 + ganancia 40 → precio 140, 40%", () => {
    const r = run("gain_amount", "40");
    expect(r.price?.toFixed()).toBe("140");
    expect(r.gainPercent?.toFixed()).toBe("40");
  });

  it("ideal 25 vs simulado 20 → rojo, −5, −5pp", () => {
    const r = run("gain_percent", "20", { ideal: "25" });
    expect(r.thermometer).toBe("red");
    expect(r.gapAmount?.toFixed()).toBe("-5");
    expect(r.gapPercentagePoints?.toFixed()).toBe("-5");
  });

  it("ideal 25 vs simulado 30 → verde, +5, +5pp", () => {
    const r = run("gain_percent", "30", { ideal: "25" });
    expect(r.thermometer).toBe("green");
    expect(r.gapAmount?.toFixed()).toBe("5");
    expect(r.gapPercentagePoints?.toFixed()).toBe("5");
  });
});

describe("simulate — costo cero y vacío", () => {
  it("costo cero con precio nunca divide", () => {
    const r = run("price", "500", { cost: "0" });
    expect(r.price?.toFixed()).toBe("500");
    expect(r.gainAmount?.toFixed()).toBe("500");
    expect(r.gainPercent).toBeNull();
    expect(r.warnings).toContain("zero_cost");
  });

  it("costo cero con % → no calculable", () => {
    const r = run("gain_percent", "25", { cost: "0" });
    expect(r.gainPercent).toBeNull();
    expect(r.warnings).toContain("percentage_not_calculable");
  });

  it("costo vacío sólo permite precio", () => {
    const price = run("price", "120", { cost: null });
    expect(price.price?.toFixed()).toBe("120");
    expect(price.warnings).toContain("missing_cost");

    const blocked = run("gain_percent", "10", { cost: null });
    expect(blocked.price).toBeNull();
    expect(blocked.warnings).toContain("driver_requires_cost");
  });
});

describe("simulate — límites y estados", () => {
  it("precio cero con costo válido = −100%", () => {
    const r = run("price", "0");
    expect(r.gainPercent?.toFixed()).toBe("-100");
  });

  it("porcentaje < −100 se rechaza", () => {
    expect(() => run("gain_percent", "-150")).toThrow(EngineError);
  });

  it("precio negativo se rechaza", () => {
    expect(() => run("price", "-1")).toThrow(EngineError);
  });

  it("ganancia que produce precio negativo se rechaza", () => {
    expect(() => run("gain_amount", "-150")).toThrow(EngineError);
  });

  it("sin objetivo → termómetro neutro", () => {
    const r = run("price", "130");
    expect(r.thermometer).toBe("neutral");
    expect(r.warnings).toContain("missing_ideal_margin");
  });

  it("inactivo y desconocido advierten pero permiten", () => {
    const r = run("price", "130", { inactive: true, unknown: true });
    expect(r.price?.toFixed()).toBe("130");
    expect(r.warnings).toContain("inactive_source");
    expect(r.warnings).toContain("unknown_source_status");
  });

  it("precisión decimal sin redondeo comercial", () => {
    const r = run("gain_percent", "33.333");
    expect(r.gainAmount?.toFixed()).toBe("33.333");
    expect(r.price?.toFixed()).toBe("133.333");
  });
});

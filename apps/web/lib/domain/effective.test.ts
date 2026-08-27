import { describe, expect, it } from "vitest";
import { Decimal } from "./decimal";
import { resolveEffective } from "./effective";
import type { EffectiveCandidate, SourceStatus } from "./types";

function cand(value: string | null, day: number, row = 1, status: SourceStatus = "active"): EffectiveCandidate {
  const dd = String(day).padStart(2, "0");
  return {
    value: value === null ? null : new Decimal(value),
    validFrom: `2026-01-${dd}`,
    sourceRow: row,
    sourceStatus: status,
  };
}

describe("resolveEffective — vigencias", () => {
  const series = [cand("100", 1), cand("120", 10), cand("140", 20)];

  it("elige la mayor vigencia ≤ fecha (antes/en/después)", () => {
    expect(resolveEffective(series, "2026-01-05").value?.toFixed()).toBe("100");
    expect(resolveEffective(series, "2026-01-10").value?.toFixed()).toBe("120");
    expect(resolveEffective(series, "2026-01-25").value?.toFixed()).toBe("140");
  });

  it("sin candidato elegible → missing", () => {
    const r = resolveEffective([cand("100", 10)], "2026-01-05");
    expect(r.status).toBe("missing");
    expect(r.value).toBeNull();
  });
});

describe("resolveEffective — duplicados y estados", () => {
  it("duplicado idéntico consolida y advierte", () => {
    const r = resolveEffective([cand("100", 10, 2), cand("100", 10, 5)], "2026-01-15");
    expect(r.value?.toFixed()).toBe("100");
    expect(r.status).toBe("warning");
    expect(r.warnings).toContain("identical_duplicate");
  });

  it("duplicado conflictivo bloquea", () => {
    const r = resolveEffective([cand("100", 10, 2), cand("130", 10, 5)], "2026-01-15");
    expect(r.status).toBe("conflict");
    expect(r.value).toBeNull();
    expect(r.warnings).toContain("conflicting_duplicate");
  });

  it("valor cero es visible y advertido", () => {
    const r = resolveEffective([cand("0", 10)], "2026-01-15");
    expect(r.value?.toFixed()).toBe("0");
    expect(r.warnings).toContain("zero_value");
  });

  it("estado inactivo y desconocido advierten", () => {
    const inactive = resolveEffective([cand("100", 10, 1, "inactive")], "2026-01-15");
    expect(inactive.warnings).toContain("inactive_source");
    const unknown = resolveEffective([cand("100", 10, 1, "unknown")], "2026-01-15");
    expect(unknown.warnings).toContain("unknown_source_status");
  });
});

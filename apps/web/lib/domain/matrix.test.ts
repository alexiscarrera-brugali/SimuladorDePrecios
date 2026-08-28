import { describe, expect, it } from "vitest";
import { Decimal } from "./decimal";
import { buildListMatrix, type ListMatrixInput } from "./matrix";

const D = (s: string) => new Decimal(s);

describe("buildListMatrix", () => {
  it("calcula el margen por lista y marca el termómetro contra el objetivo de cada una", () => {
    const cost = D("100");
    const lists: ListMatrixInput[] = [
      { code: "1", description: "Franquicias", price: D("125"), idealPercent: D("25") }, // 25% = objetivo → verde
      { code: "2", description: "Minorista", price: D("110"), idealPercent: D("25") }, // 10% < 25 → rojo
      { code: "3", description: "Sin precio", price: null, idealPercent: D("25") },
    ];
    const cells = buildListMatrix(cost, lists);

    expect(cells[0]).toMatchObject({ gain_percent: "25", thermometer: "green", gap_points: 0, has_price: true });
    expect(cells[1]).toMatchObject({ thermometer: "red", has_price: true });
    expect(cells[1].gap_points).toBeCloseTo(-15, 5);
    expect(cells[2]).toMatchObject({ has_price: false, price: null, gain_percent: null, thermometer: "neutral" });
  });

  it("sin objetivo el termómetro queda neutro pero calcula el margen", () => {
    const cells = buildListMatrix(D("100"), [{ code: "1", description: "X", price: D("140"), idealPercent: null }]);
    expect(cells[0]).toMatchObject({ gain_percent: "40", thermometer: "neutral", gap_points: null });
  });
});

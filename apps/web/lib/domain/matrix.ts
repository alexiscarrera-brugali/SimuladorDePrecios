// Matriz de margen de un producto a través de las listas de precio. El costo es
// del producto (una sucursal); el precio y el objetivo varían por lista. Pura y
// testeable sobre el motor simulate(). Reemplaza al heatmap sucursal×lista: en
// esta base sólo hay una sucursal, y la dimensión con variación real es la lista.
import { Decimal, toStr } from "./decimal";
import { simulate } from "./simulation";
import type { Thermometer } from "./types";

export interface ListMatrixInput {
  code: string;
  description: string;
  price: Decimal | null; // precio efectivo del producto en esa lista
  idealPercent: Decimal | null;
}

export interface ListMatrixCell {
  code: string;
  description: string;
  price: string | null;
  ideal_percent: string | null;
  gain_percent: string | null;
  gap_points: number | null; // margen actual − objetivo, en pp
  thermometer: Thermometer;
  has_price: boolean;
}

export function buildListMatrix(cost: Decimal | null, lists: ListMatrixInput[]): ListMatrixCell[] {
  return lists.map((list) => {
    if (list.price === null) {
      return {
        code: list.code,
        description: list.description,
        price: null,
        ideal_percent: toStr(list.idealPercent),
        gain_percent: null,
        gap_points: null,
        thermometer: "neutral" as Thermometer,
        has_price: false,
      };
    }
    const sim = simulate({ cost, driver: "price", driverValue: list.price, idealPercent: list.idealPercent });
    return {
      code: list.code,
      description: list.description,
      price: toStr(list.price),
      ideal_percent: toStr(list.idealPercent),
      gain_percent: toStr(sim.gainPercent),
      gap_points: sim.gapPercentagePoints ? sim.gapPercentagePoints.toDecimalPlaces(2).toNumber() : null,
      thermometer: sim.thermometer,
      has_price: true,
    };
  });
}

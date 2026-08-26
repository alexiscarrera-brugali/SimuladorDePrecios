import Decimal from "decimal.js";
import type { Driver } from "./types";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface LocalSimulation {
  price: Decimal | null;
  gainAmount: Decimal | null;
  gainPercent: Decimal | null;
  idealAmount: Decimal | null;
  idealPrice: Decimal | null;
  gapAmount: Decimal | null;
  gapPoints: Decimal | null;
  thermometer: "green" | "red" | "neutral";
  warnings: string[];
}

const valueOrNull = (value: string | null): Decimal | null =>
  value === null || value.trim() === "" ? null : new Decimal(value);

export function calculateSimulation(
  costValue: string | null,
  idealValue: string | null,
  driver: Driver,
  driverValue: string,
  sourceWarnings: string[],
): LocalSimulation {
  const cost = valueOrNull(costValue);
  const ideal = valueOrNull(idealValue);
  const input = valueOrNull(driverValue) ?? new Decimal(0);
  const warnings = [...sourceWarnings];
  let price: Decimal | null = null;
  let gainAmount: Decimal | null = null;
  let gainPercent: Decimal | null = null;

  if (driver === "price" && input.isNegative()) throw new Error("El precio no puede ser negativo");
  if (cost === null) {
    warnings.push("missing_cost");
    if (driver === "price") price = input;
    else warnings.push("driver_requires_cost");
  } else if (cost.isZero()) {
    warnings.push("zero_cost");
    if (driver === "price") {
      price = input;
      gainAmount = input;
    } else if (driver === "gain_amount") {
      if (input.isNegative()) throw new Error("El resultado no puede producir un precio negativo");
      gainAmount = input;
      price = input;
    } else warnings.push("percentage_not_calculable");
  } else if (driver === "price") {
    price = input;
    gainAmount = price.minus(cost);
    gainPercent = gainAmount.div(cost).times(100);
  } else if (driver === "gain_amount") {
    gainAmount = input;
    price = cost.plus(gainAmount);
    if (price.isNegative()) throw new Error("El resultado no puede producir un precio negativo");
    gainPercent = gainAmount.div(cost).times(100);
  } else {
    if (input.lessThan(-100)) throw new Error("El porcentaje no puede ser menor a −100%");
    gainPercent = input;
    gainAmount = cost.times(input).div(100);
    price = cost.plus(gainAmount);
  }

  let idealAmount: Decimal | null = null;
  let idealPrice: Decimal | null = null;
  let gapAmount: Decimal | null = null;
  let gapPoints: Decimal | null = null;
  let thermometer: LocalSimulation["thermometer"] = "neutral";
  if (ideal === null) warnings.push("missing_ideal_margin");
  else if (cost === null || cost.isZero()) warnings.push("ideal_not_calculable");
  else {
    idealAmount = cost.times(ideal).div(100);
    idealPrice = cost.plus(idealAmount);
    if (gainAmount) gapAmount = gainAmount.minus(idealAmount);
    if (gainPercent) {
      gapPoints = gainPercent.minus(ideal);
      thermometer = gapPoints.greaterThanOrEqualTo(0) ? "green" : "red";
    }
  }
  return {
    price, gainAmount, gainPercent, idealAmount, idealPrice, gapAmount, gapPoints,
    thermometer, warnings: [...new Set(warnings)],
  };
}

export const formatMoney = (value: Decimal | string | null) => {
  if (value === null) return "—";
  const decimal = typeof value === "string" ? new Decimal(value) : value;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(decimal.toNumber());
};

export const formatPercent = (value: Decimal | string | null) => {
  if (value === null) return "—";
  const decimal = typeof value === "string" ? new Decimal(value) : value;
  return `${decimal.toFixed(2)}%`;
};


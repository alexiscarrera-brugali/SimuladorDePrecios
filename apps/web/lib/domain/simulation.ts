// Motor de simulación comercial — autoridad de servidor.
// Puerto fiel de la lógica de dominio: doble vía, estados y termómetro.
// Reglas bloqueadas (AGENTS.md): % sobre costo, sin redondeo, sin float.
import { Decimal, HUNDRED } from "./decimal";
import { EngineError, type SimulationInput, type SimulationResult } from "./types";

const ZERO = new Decimal(0);

/** Elimina duplicados conservando el orden de aparición. */
function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

export function simulate(input: SimulationInput): SimulationResult {
  const { cost, driver, driverValue } = input;
  const idealPercent = input.idealPercent ?? null;
  const warnings: string[] = [];

  if (input.sourceInactive) warnings.push("inactive_source");
  if (input.sourceUnknown) warnings.push("unknown_source_status");

  if (driver === "price" && driverValue.lessThan(0)) {
    throw new EngineError("price_negative");
  }

  let price: Decimal | null = null;
  let gainAmount: Decimal | null = null;
  let gainPercent: Decimal | null = null;

  if (cost === null) {
    warnings.push("missing_cost");
    if (driver === "price") {
      price = driverValue;
    } else {
      warnings.push("driver_requires_cost");
    }
  } else if (cost.isZero()) {
    warnings.push("zero_cost");
    if (driver === "price") {
      price = driverValue;
      gainAmount = price;
    } else if (driver === "gain_amount") {
      gainAmount = driverValue;
      if (gainAmount.lessThan(0)) throw new EngineError("gain_amount_negative_price");
      price = gainAmount;
    } else {
      warnings.push("percentage_not_calculable");
    }
  } else if (driver === "price") {
    price = driverValue;
    gainAmount = price.minus(cost);
    gainPercent = gainAmount.div(cost).times(HUNDRED);
  } else if (driver === "gain_amount") {
    gainAmount = driverValue;
    price = cost.plus(gainAmount);
    if (price.lessThan(0)) throw new EngineError("gain_amount_negative_price");
    gainPercent = gainAmount.div(cost).times(HUNDRED);
  } else {
    if (driverValue.lessThan(HUNDRED.negated())) throw new EngineError("percent_below_minus_100");
    gainPercent = driverValue;
    gainAmount = cost.times(gainPercent).div(HUNDRED);
    price = cost.plus(gainAmount);
  }

  let idealAmount: Decimal | null = null;
  let idealPrice: Decimal | null = null;
  let gapAmount: Decimal | null = null;
  let gapPercentagePoints: Decimal | null = null;
  let thermometer: SimulationResult["thermometer"] = "neutral";

  if (idealPercent === null) {
    warnings.push("missing_ideal_margin");
  } else if (cost === null || cost.isZero()) {
    warnings.push("ideal_not_calculable");
  } else {
    idealAmount = cost.times(idealPercent).div(HUNDRED);
    idealPrice = cost.plus(idealAmount);
    if (gainAmount !== null) gapAmount = gainAmount.minus(idealAmount);
    if (gainPercent !== null) {
      gapPercentagePoints = gainPercent.minus(idealPercent);
      thermometer = gapPercentagePoints.greaterThanOrEqualTo(ZERO) ? "green" : "red";
    }
  }

  return {
    price,
    gainAmount,
    gainPercent,
    idealAmount,
    idealPrice,
    gapAmount,
    gapPercentagePoints,
    thermometer,
    warnings: unique(warnings),
  };
}

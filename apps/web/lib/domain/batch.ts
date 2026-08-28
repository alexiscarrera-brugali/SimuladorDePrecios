// What-if de cartera: aplica una regla de repricing a un conjunto de productos y
// devuelve el resultado por producto más un agregado. Función pura sobre el motor
// server-authoritative `simulate()`; la ruta recalcula con esto y su resultado
// prevalece. Sin float ni redondeo comercial (AGENTS.md).
import { Decimal, HUNDRED } from "./decimal";
import { simulate } from "./simulation";
import type { Thermometer } from "./types";

export type BatchRuleKind = "to_target" | "price_delta_pct" | "cost_shock_pct";

export interface BatchRule {
  kind: BatchRuleKind;
  /** Porcentaje para price_delta_pct y cost_shock_pct; ignorado en to_target. */
  value?: Decimal | null;
}

export interface BatchInputRow {
  productCode: string;
  branchCode: string;
  cost: Decimal | null;
  price: Decimal | null; // precio vigente
  idealPercent: Decimal | null;
  actualGainPercent: Decimal | null; // margen actual, para comparar el "antes"
}

export interface BatchItemResult {
  productCode: string;
  branchCode: string;
  beforePrice: Decimal | null;
  afterPrice: Decimal | null;
  beforeGainPercent: Decimal | null;
  afterGainPercent: Decimal | null;
  thermometer: Thermometer;
  crossedIntoTarget: boolean;
  fellBelowTarget: boolean;
  skipped: boolean; // la regla no aplica a esta fila
  reason: string | null; // por qué se omitió
  warnings: string[];
}

export interface BatchAggregate {
  selected: number;
  evaluated: number;
  skipped: number;
  crossedIntoTarget: number;
  fellBelowTarget: number;
  belowTargetBefore: number;
  belowTargetAfter: number;
  meanGainBefore: string | null;
  meanGainAfter: string | null;
  /** Base de ponderación del promedio: hoy por conteo; por ingreso al haber volumen. */
  weighting: "count" | "revenue";
}

export interface BatchOutcome {
  items: BatchItemResult[];
  aggregate: BatchAggregate;
}

const EMPTY_ITEM = (row: BatchInputRow, reason: string): BatchItemResult => ({
  productCode: row.productCode,
  branchCode: row.branchCode,
  beforePrice: row.price,
  afterPrice: null,
  beforeGainPercent: row.actualGainPercent,
  afterGainPercent: null,
  thermometer: "neutral",
  crossedIntoTarget: false,
  fellBelowTarget: false,
  skipped: true,
  reason,
  warnings: [],
});

function applyRow(row: BatchInputRow, rule: BatchRule): BatchItemResult {
  const ideal = row.idealPercent;

  let driver: "price" | "gain_percent";
  let driverValue: Decimal;

  if (rule.kind === "to_target") {
    if (ideal === null) return EMPTY_ITEM(row, "sin objetivo de referencia");
    driver = "gain_percent";
    driverValue = ideal;
  } else if (rule.kind === "price_delta_pct") {
    if (row.price === null) return EMPTY_ITEM(row, "sin precio vigente");
    const factor = HUNDRED.plus(rule.value ?? new Decimal(0)).div(HUNDRED);
    driver = "price";
    driverValue = row.price.times(factor);
  } else {
    // cost_shock_pct: sube el costo y mantiene el precio → mide la erosión de margen.
    if (row.cost === null || row.price === null) return EMPTY_ITEM(row, "requiere costo y precio");
    const factor = HUNDRED.plus(rule.value ?? new Decimal(0)).div(HUNDRED);
    const shockedCost = row.cost.times(factor);
    const sim = simulate({ cost: shockedCost, driver: "price", driverValue: row.price, idealPercent: ideal });
    return finish(row, sim.price, sim.gainPercent, sim.thermometer, sim.warnings);
  }

  const sim = simulate({ cost: row.cost, driver, driverValue, idealPercent: ideal });
  return finish(row, sim.price, sim.gainPercent, sim.thermometer, sim.warnings);
}

function finish(
  row: BatchInputRow,
  afterPrice: Decimal | null,
  afterGain: Decimal | null,
  thermometer: Thermometer,
  warnings: string[],
): BatchItemResult {
  const ideal = row.idealPercent;
  const before = row.actualGainPercent;
  let crossedIntoTarget = false;
  let fellBelowTarget = false;
  if (ideal !== null && before !== null && afterGain !== null) {
    const wasBelow = before.lessThan(ideal);
    const isBelow = afterGain.lessThan(ideal);
    crossedIntoTarget = wasBelow && !isBelow;
    fellBelowTarget = !wasBelow && isBelow;
  }
  return {
    productCode: row.productCode,
    branchCode: row.branchCode,
    beforePrice: row.price,
    afterPrice,
    beforeGainPercent: before,
    afterGainPercent: afterGain,
    thermometer,
    crossedIntoTarget,
    fellBelowTarget,
    skipped: false,
    reason: null,
    warnings,
  };
}

function mean(values: Decimal[]): Decimal | null {
  if (values.length === 0) return null;
  return values.reduce((acc, v) => acc.plus(v), new Decimal(0)).div(values.length);
}

export function applyBatch(rows: BatchInputRow[], rule: BatchRule): BatchOutcome {
  const items = rows.map((row) => applyRow(row, rule));

  // items[i] corresponde a rows[i] (items = rows.map(...)).
  const evaluatedItems = items.filter((i) => !i.skipped);
  const beforeGains = evaluatedItems.map((i) => i.beforeGainPercent).filter((v): v is Decimal => v !== null);
  const afterGains = evaluatedItems.map((i) => i.afterGainPercent).filter((v): v is Decimal => v !== null);

  let belowTargetBefore = 0;
  let belowTargetAfter = 0;
  rows.forEach((r, idx) => {
    const ideal = r.idealPercent;
    if (ideal === null) return;
    if (r.actualGainPercent !== null && r.actualGainPercent.lessThan(ideal)) belowTargetBefore += 1;
    const after = items[idx].afterGainPercent;
    if (!items[idx].skipped && after !== null && after.lessThan(ideal)) belowTargetAfter += 1;
  });

  const meanBefore = mean(beforeGains);
  const meanAfter = mean(afterGains);

  return {
    items,
    aggregate: {
      selected: rows.length,
      evaluated: evaluatedItems.length,
      skipped: items.length - evaluatedItems.length,
      crossedIntoTarget: items.filter((i) => i.crossedIntoTarget).length,
      fellBelowTarget: items.filter((i) => i.fellBelowTarget).length,
      belowTargetBefore,
      belowTargetAfter,
      meanGainBefore: meanBefore === null ? null : meanBefore.toFixed(2),
      meanGainAfter: meanAfter === null ? null : meanAfter.toFixed(2),
      weighting: "count",
    },
  };
}

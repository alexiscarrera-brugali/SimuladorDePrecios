// Análisis por lista y fecha: resuelve precio/costo vigentes, objetivo y estado
// de cada producto. Función pura (los datos se traen aparte) → autoridad de
// servidor y totalmente verificable. Port fiel de services/analysis.py.
import { Decimal, toStr } from "./decimal";
import { resolveEffective } from "./effective";
import { simulate } from "./simulation";
import type { EffectiveCandidate, EffectiveValue } from "./types";
import type { CostRecord, MarginRecord, PriceRecord } from "./importer";
import { NO_CAPABILITIES, type DataCapabilities } from "./capabilities";

export interface PriceListRef {
  code: string;
  description: string;
}

export interface ProductRef {
  code: string;
  description: string | null;
}

export interface EffectiveView {
  value: string | null;
  validFrom: string | null;
  status: string;
  warnings: string[];
}

export interface AnalysisRow {
  productCode: string;
  description: string | null;
  branchCode: string;
  priceListCode: string;
  priceListName: string;
  price: EffectiveView;
  cost: EffectiveView;
  idealPercent: string | null;
  actualGainAmount: string | null;
  actualGainPercent: string | null;
  dataStatus: "ok" | "warning" | "conflict";
  warnings: string[];
  simulationBlocked: boolean;
}

export interface AnalysisResponse {
  queryDate: string;
  priceList: PriceListRef;
  rows: AnalysisRow[];
  counts: { total: number; ok: number; warning: number; conflict: number };
  capabilities: DataCapabilities;
}

export interface AnalyzeInput {
  queryDate: string;
  priceList: PriceListRef;
  prices: PriceRecord[];
  costs: CostRecord[];
  margins: MarginRecord[];
  products: Map<string, ProductRef>;
  /** Capacidades de datos del lote; por defecto ninguna (volumen/rubro ausentes). */
  capabilities?: DataCapabilities;
}

function effView(value: EffectiveValue): EffectiveView {
  return {
    value: toStr(value.value),
    validFrom: value.validFrom,
    status: value.status,
    warnings: [...value.warnings],
  };
}

function toCandidate(item: { value: Decimal | null; validFrom: string; sourceRow: number; sourceStatus: EffectiveCandidate["sourceStatus"] }): EffectiveCandidate {
  return {
    value: item.value,
    validFrom: item.validFrom,
    sourceRow: item.sourceRow,
    sourceStatus: item.sourceStatus,
  };
}

export function analyze(input: AnalyzeInput): AnalysisResponse {
  const { queryDate, priceList, products } = input;

  const prices = input.prices.filter((p) => p.priceListCode === priceList.code);
  const costs = input.costs;
  const objectives = input.margins.filter(
    (m) => !m.isAmbiguous && m.priceListName === priceList.description,
  );

  const priceGroups = new Map<string, PriceRecord[]>();
  for (const item of prices) {
    const key = `${item.branchCode}|${item.productCode}`;
    (priceGroups.get(key) ?? priceGroups.set(key, []).get(key)!).push(item);
  }
  const costGroups = new Map<string, CostRecord[]>();
  for (const item of costs) {
    const key = `${item.branchCode}|${item.productCode}`;
    (costGroups.get(key) ?? costGroups.set(key, []).get(key)!).push(item);
  }

  const objectiveMap = new Map<string, Decimal | null>();
  for (const item of objectives) objectiveMap.set(item.productCode, item.percentage);

  const productCodes = new Set<string>([...prices.map((p) => p.productCode), ...objectiveMap.keys()]);

  const rows: AnalysisRow[] = [];
  for (const productCode of [...productCodes].sort()) {
    const branches = new Set<string>();
    for (const key of priceGroups.keys()) {
      const [branch, code] = key.split("|");
      if (code === productCode) branches.add(branch);
    }
    if (branches.size === 0) branches.add("1");

    for (const branchCode of [...branches].sort()) {
      const priceValue = resolveEffective(
        (priceGroups.get(`${branchCode}|${productCode}`) ?? []).map(toCandidate),
        queryDate,
      );

      let matchingCosts = costGroups.get(`${branchCode}|${productCode}`);
      if (!matchingCosts) {
        matchingCosts = costs.filter((c) => c.productCode === productCode);
      }
      const costValue = resolveEffective(matchingCosts.map(toCandidate), queryDate);

      const warnings = [...new Set([...priceValue.warnings, ...costValue.warnings])];
      const blocked = priceValue.status === "conflict" || costValue.status === "conflict";
      const idealPercent = objectiveMap.get(productCode) ?? null;

      let actualGainAmount: string | null = null;
      let actualGainPercent: string | null = null;
      if (!blocked && priceValue.value !== null) {
        const actual = simulate({
          cost: costValue.value,
          driver: "price",
          driverValue: priceValue.value,
          idealPercent,
          sourceInactive: warnings.includes("inactive_source"),
          sourceUnknown: warnings.includes("unknown_source_status"),
        });
        actualGainAmount = toStr(actual.gainAmount);
        actualGainPercent = toStr(actual.gainPercent);
        warnings.push(...actual.warnings);
      }
      if (idealPercent === null) warnings.push("missing_ideal_margin");
      const finalWarnings = [...new Set(warnings)];
      const dataStatus = blocked ? "conflict" : finalWarnings.length > 0 ? "warning" : "ok";

      rows.push({
        productCode,
        description: products.get(productCode)?.description ?? null,
        branchCode,
        priceListCode: priceList.code,
        priceListName: priceList.description,
        price: effView(priceValue),
        cost: effView(costValue),
        idealPercent: toStr(idealPercent),
        actualGainAmount,
        actualGainPercent,
        dataStatus,
        warnings: finalWarnings,
        simulationBlocked: blocked,
      });
    }
  }

  const counts = { total: rows.length, ok: 0, warning: 0, conflict: 0 };
  for (const row of rows) counts[row.dataStatus] += 1;

  return { queryDate, priceList, rows, counts, capabilities: input.capabilities ?? NO_CAPABILITIES };
}

// Serialización del motor (camelCase) al contrato JSON de la UI (snake_case).
import type { AnalysisResponse } from "@/lib/domain/analysis";
import type { ParsedIssue, ParsedWorkbook } from "@/lib/domain/importer";
import type { BatchOutcome } from "@/lib/domain/batch";
import { toStr } from "@/lib/domain/decimal";

export function issueToJSON(issue: ParsedIssue) {
  return {
    issue_type: issue.issueType,
    severity: issue.severity,
    sheet_name: issue.sheetName,
    business_key: issue.businessKey,
    explanation: issue.explanation,
    source_rows: issue.sourceRows,
    values: issue.values,
  };
}

export function summaryToJSON(summary: ParsedWorkbook["summary"]) {
  return {
    price_rows: summary.priceRows,
    cost_rows: summary.costRows,
    margin_rows: summary.marginRows,
    price_lists: summary.priceLists,
    warnings: summary.warnings,
    conflicts: summary.conflicts,
  };
}

export function analysisToJSON(res: AnalysisResponse) {
  return {
    query_date: res.queryDate,
    price_list: res.priceList,
    counts: res.counts,
    capabilities: {
      has_volume: res.capabilities.hasVolume,
      has_category: res.capabilities.hasCategory,
    },
    rows: res.rows.map((row) => ({
      product_code: row.productCode,
      description: row.description,
      branch_code: row.branchCode,
      price_list_code: row.priceListCode,
      price_list_name: row.priceListName,
      price: {
        value: row.price.value,
        valid_from: row.price.validFrom,
        status: row.price.status,
        warnings: row.price.warnings,
      },
      cost: {
        value: row.cost.value,
        valid_from: row.cost.validFrom,
        status: row.cost.status,
        warnings: row.cost.warnings,
      },
      ideal_percent: row.idealPercent,
      actual_gain_amount: row.actualGainAmount,
      actual_gain_percent: row.actualGainPercent,
      data_status: row.dataStatus,
      warnings: row.warnings,
      simulation_blocked: row.simulationBlocked,
    })),
  };
}

export function batchOutcomeToJSON(outcome: BatchOutcome) {
  return {
    aggregate: outcome.aggregate,
    items: outcome.items.map((i) => ({
      product_code: i.productCode,
      branch_code: i.branchCode,
      before_price: toStr(i.beforePrice),
      after_price: toStr(i.afterPrice),
      before_gain_percent: toStr(i.beforeGainPercent),
      after_gain_percent: toStr(i.afterGainPercent),
      thermometer: i.thermometer,
      crossed_into_target: i.crossedIntoTarget,
      fell_below_target: i.fellBelowTarget,
      skipped: i.skipped,
      reason: i.reason,
      warnings: i.warnings,
    })),
  };
}

export type DataStatus = "ok" | "warning" | "conflict";
export type Driver = "price" | "gain_amount" | "gain_percent";

export interface PriceList {
  code: string;
  description: string;
}

export interface EffectiveValue {
  value: string | null;
  valid_from: string | null;
  status: string;
  warnings: string[];
}

export interface AnalysisRow {
  product_code: string;
  description: string | null;
  branch_code: string;
  price_list_code: string;
  price_list_name: string;
  price: EffectiveValue;
  cost: EffectiveValue;
  ideal_percent: string | null;
  actual_gain_amount: string | null;
  actual_gain_percent: string | null;
  data_status: DataStatus;
  warnings: string[];
  simulation_blocked: boolean;
}

export interface AnalysisResponse {
  query_date: string;
  price_list: PriceList;
  rows: AnalysisRow[];
  counts: { total: number; ok: number; warning: number; conflict: number };
}

export interface QualityIssue {
  issue_type: string;
  severity: "warning" | "conflict";
  sheet_name: string;
  business_key: string;
  explanation: string;
  source_rows: number[];
  values: (string | null)[];
}

export interface PreviewResult {
  preview_id: string;
  filename: string;
  sha256: string;
  summary: Record<string, number>;
  issues: QualityIssue[];
}

export interface HistoryResult {
  product_code: string;
  price_list_code: string;
  prices: { date: string; value: string | null; source_row: number }[];
  costs: { date: string; value: string | null; source_row: number }[];
}


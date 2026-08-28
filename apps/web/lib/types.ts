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

export interface DataCapabilities {
  has_volume: boolean;
  has_category: boolean;
}

export interface AnalysisResponse {
  query_date: string;
  price_list: PriceList;
  rows: AnalysisRow[];
  counts: { total: number; ok: number; warning: number; conflict: number };
  capabilities: DataCapabilities;
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
  path: string;
  filename: string;
  sha256: string;
  summary: Record<string, number>;
  issues: QualityIssue[];
  issues_total?: number;
}

export interface HistoryResult {
  product_code: string;
  price_list_code: string;
  prices: { date: string; value: string | null; source_row: number }[];
  costs: { date: string; value: string | null; source_row: number }[];
}

export interface SavedSimulation {
  id: string;
  product_code: string;
  price_list_code: string;
  query_date: string;
  actor_email: string;
  created_at: string;
  original_cost: string | null;
  original_ideal_percent: string | null;
  driver: Driver;
  driver_value: string;
  simulated_price: string | null;
  simulated_gain_amount: string | null;
  simulated_gain_percent: string | null;
  thermometer: "green" | "red" | "neutral";
}

export interface ManualCorrection {
  field: "cost" | "ideal_percent";
  original_value: string | null;
  corrected_value: string | null;
}

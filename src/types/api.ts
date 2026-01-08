// API Types based on screenfish backend

export interface StatusResponse {
  today: string;
  cache_dir: string;
  sqlite_path: string;
  provider_default: string;
  max_daily_trade_date: string | null;
  max_update_log_trade_date: string | null;
  stocks: number;
  rows: number;
}

export interface UpdateRequest {
  provider: 'baostock' | 'tushare';
  start?: string | null;
  end?: string | null;
  repair_days?: number;
}

export interface UpdateResponse {
  ok: boolean;
  max_daily_trade_date: string | null;
  max_update_log_trade_date: string | null;
}

export interface UpdateWaitRequest {
  provider: 'baostock' | 'tushare';
  target_date?: string | null;
  repair_days?: number;
  interval_seconds?: number;
  timeout_seconds?: number;
}

export interface UpdateWaitResponse {
  ok: boolean;
  target_date: string;
  latest_trade_date: string | null;
  attempts: number;
  elapsed_seconds: number;
  message: string;
}

export interface ScreenRequest {
  date?: string;
  combo?: 'and' | 'or';
  lookback_days?: number;
  rules?: string | null;
  with_name?: boolean;
}

export interface ScreenHit {
  ts_code: string;
  name?: string;
  [key: string]: unknown;
}

export interface ScreenResponse {
  trade_date: string;
  hits: ScreenHit[];
}

export interface AvailabilityResponse {
  date: string;
  provider: string;
  available: boolean;
  detail: string;
}

export interface ExportEbkResponse {
  trade_date: string;
  ebk: string;
}

export interface HealthResponse {
  status: string;
}

export interface StockItem {
  ts_code: string;
  name: string | null;
}

export interface StockListResponse {
  total: number;
  stocks: StockItem[];
}

export interface DailyBar {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
}

export interface StockDailyResponse {
  ts_code: string;
  name: string | null;
  bars: DailyBar[];
}

// Formula types
export interface FormulaItem {
  id: number;
  name: string;
  formula: string;
  description: string | null;
  kind: 'screen' | 'indicator';
  timeframe: 'D' | 'W' | 'M' | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormulaListResponse {
  total: number;
  formulas: FormulaItem[];
}

export interface FormulaCreate {
  name: string;
  formula: string;
  description?: string | null;
  kind?: 'screen' | 'indicator';
  timeframe?: 'D' | 'W' | 'M' | null;
  enabled?: boolean;
}

export interface FormulaUpdate {
  name?: string;
  formula?: string;
  description?: string | null;
  kind?: 'screen' | 'indicator';
  timeframe?: 'D' | 'W' | 'M' | null;
  enabled?: boolean;
}

export interface FormulaValidateRequest {
  formula: string;
}

export interface FormulaValidateResponse {
  valid: boolean;
  message: string;
}

export interface IndicatorPoint {
  trade_date: string;
  value: number | null;
}

export interface IndicatorLine {
  name: string;
  points: IndicatorPoint[];
}

export interface IndicatorSeriesResponse {
  ts_code: string;
  formula_id: number;
  name: string;
  timeframe: 'D' | 'W' | 'M';
  points: IndicatorPoint[];
  lines?: IndicatorLine[];
}

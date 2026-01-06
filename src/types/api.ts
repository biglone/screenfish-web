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

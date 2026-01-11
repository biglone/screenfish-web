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

export type UpdateWaitJobStatus = 'running' | 'succeeded' | 'failed' | 'timeout' | 'canceled';

export interface UpdateWaitResponse {
  job_id: string;
  status: UpdateWaitJobStatus;
  ok: boolean;
  provider: 'baostock' | 'tushare';
  target_date: string;
  latest_trade_date: string | null;
  attempts: number;
  elapsed_seconds: number;
  message: string;
  last_error: string | null;
}

export interface AutoUpdateConfig {
  enabled: boolean;
  interval_seconds: number;
  provider: 'baostock' | 'tushare';
  repair_days: number;
}

export interface ScreenRequest {
  date?: string;
  combo?: 'and' | 'or';
  lookback_days?: number;
  rules?: string | null;
  with_name?: boolean;
  price_adjust?: 'none' | 'qfq' | 'hfq' | null;
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
  auth_enabled?: boolean;
  auth_signup_mode?: 'open' | 'email' | 'closed' | null;
  auth_bootstrap?: boolean;
}

export interface VersionResponse {
  name: string;
  version: string;
  git_sha?: string | null;
  git_describe?: string | null;
  build_time?: string | null;
}

export interface AuthUserResponse {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export interface AuthTokenResponse {
  token: string;
  expires_at: number;
  user: AuthUserResponse;
}

export interface AuthRegisterRequest {
  username: string;
  password: string;
}

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthEmailCodeRequest {
  email: string;
}

export interface AuthEmailCodeResponse {
  ok: boolean;
  expires_at: number;
  debug_code?: string | null;
}

export interface AuthEmailRegisterRequest {
  email: string;
  code: string;
  username: string;
  password: string;
}

export interface AccountResponse {
  id: string;
  username: string;
  email?: string | null;
  role: 'admin' | 'user';
}

export interface AccountUpdateRequest {
  email: string | null;
  current_password: string;
}

export interface AccountChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface AdminUserItem {
  id: string;
  username: string;
  email?: string | null;
  role: 'admin' | 'user';
  disabled: boolean;
  token_version: number;
  created_at: number;
  updated_at: number;
  last_login_at?: number | null;
  last_login_ip?: string | null;
}

export interface AdminUserListResponse {
  total: number;
  users: AdminUserItem[];
}

export interface AdminUserCreateRequest {
  username: string;
  password: string;
  email?: string | null;
  role?: 'admin' | 'user';
  disabled?: boolean;
}

export interface AdminUserUpdateRequest {
  username?: string;
  email?: string | null;
  role?: 'admin' | 'user';
  disabled?: boolean;
}

export interface AdminUserSetPasswordRequest {
  password: string;
}

export interface AdminUserTokenVersionResponse {
  ok: boolean;
  token_version: number;
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

export interface WatchlistItem {
  ts_code: string;
  name?: string | null;
}

export interface WatchlistGroup {
  id: string;
  name: string;
  items: WatchlistItem[];
  created_at: number;
  updated_at: number;
}

export interface WatchlistGroupMeta {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface WatchlistStateResponse {
  version: number;
  groups: WatchlistGroup[];
}

export interface WatchlistGroupCreate {
  name: string;
}

export interface WatchlistGroupUpdate {
  name: string;
}

export interface WatchlistItemsUpsertRequest {
  items: WatchlistItem[];
}

export interface WatchlistItemsRemoveRequest {
  ts_codes: string[];
}

export interface LogTailResponse {
  source: 'journald' | 'file' | 'none';
  unit?: string | null;
  path?: string | null;
  lines: string[];
}

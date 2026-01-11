import axios, { type AxiosInstance, type AxiosRequestHeaders } from 'axios';
import type {
  StatusResponse,
  UpdateRequest,
  UpdateResponse,
  UpdateWaitRequest,
  UpdateWaitResponse,
  AutoUpdateConfig,
  ScreenRequest,
  ScreenResponse,
  AvailabilityResponse,
  TradeDateListResponse,
  DataIntegrityResponse,
  ExportEbkResponse,
  HealthResponse,
  VersionResponse,
  AuthLoginRequest,
  AuthEmailCodeRequest,
  AuthEmailCodeResponse,
  AuthEmailRegisterRequest,
  AuthRegisterRequest,
  AuthTokenResponse,
  AuthUserResponse,
  AccountChangePasswordRequest,
  AccountResponse,
  AccountUpdateRequest,
  StockListResponse,
  StockDailyResponse,
  FormulaItem,
  FormulaListResponse,
  FormulaCreate,
  FormulaUpdate,
  FormulaValidateRequest,
  FormulaValidateResponse,
  IndicatorSeriesResponse,
  WatchlistGroupMeta,
  WatchlistItemsRemoveRequest,
  WatchlistItemsUpsertRequest,
  WatchlistStateResponse,
  LogTailResponse,
  AdminUserCreateRequest,
  AdminUserItem,
  AdminUserListResponse,
  AdminUserSetPasswordRequest,
  AdminUserTokenVersionResponse,
  AdminUserUpdateRequest,
} from '../types/api';

// Get API base URL from environment or use default
const getApiBaseUrl = () => {
  // In production, use environment variable or same origin
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Default: use /api proxy in dev, or same origin in production
  return '/api';
};

const AUTH_TOKEN_STORAGE_KEY = 'screenfish_auth_token';
const AUTH_TOKEN_CHANGED_EVENT = 'screenfish_auth_token_changed';

export function getStoredAuthToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setStoredAuthToken(token: string | null) {
  try {
    const t = (token ?? '').trim();
    if (t) localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, t);
    else localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
    }
  } catch {
    // ignore
  }
}

export function onAuthTokenChanged(handler: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handler);
  return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handler);
}

class StockScreenerApi {
  private client: AxiosInstance;

  constructor(baseURL: string = getApiBaseUrl(), apiKey?: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-API-Key': apiKey }),
      },
    });

    this.client.interceptors.request.use((config) => {
      const token = getStoredAuthToken();
      const headers = (config.headers ?? {}) as AxiosRequestHeaders;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else delete (headers as Record<string, unknown>)['Authorization'];
      config.headers = headers;
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        if (status === 401) {
          setStoredAuthToken(null);
        }
        const detail = error?.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim()) {
          error.message = detail;
        }
        return Promise.reject(error);
      }
    );
  }

  setApiKey(apiKey: string) {
    this.client.defaults.headers['X-API-Key'] = apiKey;
  }

  setAuthToken(token: string | null) {
    setStoredAuthToken(token);
  }

  async health(): Promise<HealthResponse> {
    const { data } = await this.client.get<HealthResponse>('/v1/health');
    return data;
  }

  async version(): Promise<VersionResponse> {
    const { data } = await this.client.get<VersionResponse>('/v1/version');
    return data;
  }

  async register(request: AuthRegisterRequest): Promise<AuthTokenResponse> {
    const { data } = await this.client.post<AuthTokenResponse>('/v1/auth/register', request);
    return data;
  }

  async requestEmailCode(request: AuthEmailCodeRequest): Promise<AuthEmailCodeResponse> {
    const { data } = await this.client.post<AuthEmailCodeResponse>('/v1/auth/email/request', request);
    return data;
  }

  async registerWithEmail(request: AuthEmailRegisterRequest): Promise<AuthTokenResponse> {
    const { data } = await this.client.post<AuthTokenResponse>('/v1/auth/register/email', request);
    return data;
  }

  async login(request: AuthLoginRequest): Promise<AuthTokenResponse> {
    const { data } = await this.client.post<AuthTokenResponse>('/v1/auth/login', request);
    return data;
  }

  async me(): Promise<AuthUserResponse> {
    const { data } = await this.client.get<AuthUserResponse>('/v1/auth/me');
    return data;
  }

  async account(): Promise<AccountResponse> {
    const { data } = await this.client.get<AccountResponse>('/v1/account');
    return data;
  }

  async updateAccount(request: AccountUpdateRequest): Promise<AccountResponse> {
    const { data } = await this.client.put<AccountResponse>('/v1/account', request);
    return data;
  }

  async changePassword(request: AccountChangePasswordRequest): Promise<AuthTokenResponse> {
    const { data } = await this.client.post<AuthTokenResponse>('/v1/account/change-password', request);
    return data;
  }

  async status(): Promise<StatusResponse> {
    const { data } = await this.client.get<StatusResponse>('/v1/status');
    return data;
  }

  async update(request: UpdateRequest): Promise<UpdateResponse> {
    const { data } = await this.client.post<UpdateResponse>('/v1/update', request);
    return data;
  }

  async updateWait(request: UpdateWaitRequest): Promise<UpdateWaitResponse> {
    const { data } = await this.client.post<UpdateWaitResponse>('/v1/update/wait', request);
    return data;
  }

  async getAutoUpdateConfig(): Promise<AutoUpdateConfig> {
    const { data } = await this.client.get<AutoUpdateConfig>('/auto-update-config');
    return data;
  }

  async updateAutoUpdateConfig(request: AutoUpdateConfig): Promise<AutoUpdateConfig> {
    const { data } = await this.client.put<AutoUpdateConfig>('/auto-update-config', request);
    return data;
  }

  async getUpdateWaitJob(jobId: string): Promise<UpdateWaitResponse> {
    const { data } = await this.client.get<UpdateWaitResponse>(
      `/v1/update/wait/${encodeURIComponent(jobId)}`
    );
    return data;
  }

  async cancelUpdateWaitJob(jobId: string): Promise<UpdateWaitResponse> {
    const { data } = await this.client.delete<UpdateWaitResponse>(
      `/v1/update/wait/${encodeURIComponent(jobId)}`
    );
    return data;
  }

  async screen(request: ScreenRequest): Promise<ScreenResponse> {
    const { data } = await this.client.post<ScreenResponse>('/v1/screen', request);
    return data;
  }

  async availability(
    date: string,
    provider: 'baostock' | 'tushare' = 'baostock'
  ): Promise<AvailabilityResponse> {
    const { data } = await this.client.get<AvailabilityResponse>('/v1/data/availability', {
      params: { date, provider },
    });
    return data;
  }

  async listTradeDates(params?: {
    limit?: number;
    offset?: number;
    order?: 'asc' | 'desc';
    price_adjust?: 'none' | 'qfq' | 'hfq';
  }): Promise<TradeDateListResponse> {
    const { data } = await this.client.get<TradeDateListResponse>('/v1/data/trade-dates', { params });
    return data;
  }

  async dataIntegrity(params?: {
    provider?: 'baostock' | 'tushare';
    date?: string;
    lookback_days?: number;
    suspicious_ratio?: number;
    price_adjust?: 'none' | 'qfq' | 'hfq';
  }): Promise<DataIntegrityResponse> {
    const { data } = await this.client.get<DataIntegrityResponse>('/v1/data/integrity', { params });
    return data;
  }

  async exportEbk(request: ScreenRequest): Promise<ExportEbkResponse> {
    const { data } = await this.client.post<ExportEbkResponse>('/v1/export/ebk', request);
    return data;
  }

  async listStocks(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<StockListResponse> {
    const { data } = await this.client.get<StockListResponse>('/v1/stocks', { params });
    return data;
  }

  async getStockDaily(
    tsCode: string,
    params?: { start?: string; end?: string; limit?: number; price_adjust?: 'none' | 'qfq' | 'hfq' }
  ): Promise<StockDailyResponse> {
    const { data } = await this.client.get<StockDailyResponse>(
      `/v1/stocks/${encodeURIComponent(tsCode)}/daily`,
      { params }
    );
    return data;
  }

  // Formula CRUD APIs
  async listFormulas(enabledOnly?: boolean): Promise<FormulaListResponse>;
  async listFormulas(arg?: {
    enabledOnly?: boolean;
    kind?: 'screen' | 'indicator';
  }): Promise<FormulaListResponse>;
  async listFormulas(
    arg: boolean | { enabledOnly?: boolean; kind?: 'screen' | 'indicator' } = false
  ): Promise<FormulaListResponse> {
    const enabledOnly = typeof arg === 'boolean' ? arg : (arg.enabledOnly ?? false);
    const kind = typeof arg === 'boolean' ? undefined : arg.kind;
    const { data } = await this.client.get<FormulaListResponse>('/v1/formulas', {
      params: {
        enabled_only: enabledOnly,
        ...(kind ? { kind } : {}),
      },
    });
    return data;
  }

  async createFormula(request: FormulaCreate): Promise<FormulaItem> {
    const { data } = await this.client.post<FormulaItem>('/v1/formulas', request);
    return data;
  }

  async getFormula(id: number): Promise<FormulaItem> {
    const { data } = await this.client.get<FormulaItem>(`/v1/formulas/${id}`);
    return data;
  }

  async updateFormula(id: number, request: FormulaUpdate): Promise<FormulaItem> {
    const { data } = await this.client.put<FormulaItem>(`/v1/formulas/${id}`, request);
    return data;
  }

  async deleteFormula(id: number): Promise<{ ok: boolean; deleted: number }> {
    const { data } = await this.client.delete<{ ok: boolean; deleted: number }>(
      `/v1/formulas/${id}`
    );
    return data;
  }

  async validateFormula(request: FormulaValidateRequest): Promise<FormulaValidateResponse> {
    const { data } = await this.client.post<FormulaValidateResponse>(
      '/v1/formulas/validate',
      request
    );
    return data;
  }

  async getIndicatorSeries(
    tsCode: string,
    formulaId: number,
    params?: { start?: string; end?: string; limit?: number; price_adjust?: 'none' | 'qfq' | 'hfq' }
  ): Promise<IndicatorSeriesResponse> {
    const { data } = await this.client.get<IndicatorSeriesResponse>(
      `/v1/stocks/${encodeURIComponent(tsCode)}/indicators/${formulaId}`,
      { params }
    );
    return data;
  }

  // Watchlist APIs
  async getWatchlist(): Promise<WatchlistStateResponse> {
    const { data } = await this.client.get<WatchlistStateResponse>('/v1/watchlist');
    return data;
  }

  async createWatchlistGroup(name: string): Promise<WatchlistGroupMeta> {
    const { data } = await this.client.post<WatchlistGroupMeta>('/v1/watchlist/groups', { name });
    return data;
  }

  async updateWatchlistGroup(groupId: string, name: string): Promise<WatchlistGroupMeta> {
    const { data } = await this.client.put<WatchlistGroupMeta>(
      `/v1/watchlist/groups/${encodeURIComponent(groupId)}`,
      { name }
    );
    return data;
  }

  async deleteWatchlistGroup(groupId: string): Promise<{ ok: boolean; deleted: string }> {
    const { data } = await this.client.delete<{ ok: boolean; deleted: string }>(
      `/v1/watchlist/groups/${encodeURIComponent(groupId)}`
    );
    return data;
  }

  async upsertWatchlistItems(
    groupId: string,
    request: WatchlistItemsUpsertRequest
  ): Promise<{
    ok: boolean;
    group_id: string;
    updated_at: number;
    total: number;
    unknown_total?: number;
    unknown?: string[];
  }> {
    const { data } = await this.client.post<{
      ok: boolean;
      group_id: string;
      updated_at: number;
      total: number;
      unknown_total?: number;
      unknown?: string[];
    }>(`/v1/watchlist/groups/${encodeURIComponent(groupId)}/items`, request);
    return data;
  }

  async removeWatchlistItems(
    groupId: string,
    request: WatchlistItemsRemoveRequest
  ): Promise<{ ok: boolean; group_id: string; updated_at: number; removed: number }> {
    const { data } = await this.client.post<{
      ok: boolean;
      group_id: string;
      updated_at: number;
      removed: number;
    }>(`/v1/watchlist/groups/${encodeURIComponent(groupId)}/items/remove`, request);
    return data;
  }

  // Admin user management
  async listAdminUsers(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminUserListResponse> {
    const { data } = await this.client.get<AdminUserListResponse>('/v1/admin/users', { params });
    return data;
  }

  async createAdminUser(request: AdminUserCreateRequest): Promise<AdminUserItem> {
    const { data } = await this.client.post<AdminUserItem>('/v1/admin/users', request);
    return data;
  }

  async updateAdminUser(userId: string, request: AdminUserUpdateRequest): Promise<AdminUserItem> {
    const { data } = await this.client.put<AdminUserItem>(
      `/v1/admin/users/${encodeURIComponent(userId)}`,
      request
    );
    return data;
  }

  async setAdminUserPassword(
    userId: string,
    request: AdminUserSetPasswordRequest
  ): Promise<AdminUserTokenVersionResponse> {
    const { data } = await this.client.post<AdminUserTokenVersionResponse>(
      `/v1/admin/users/${encodeURIComponent(userId)}/set-password`,
      request
    );
    return data;
  }

  async revokeAdminUserTokens(userId: string): Promise<AdminUserTokenVersionResponse> {
    const { data } = await this.client.post<AdminUserTokenVersionResponse>(
      `/v1/admin/users/${encodeURIComponent(userId)}/revoke-tokens`
    );
    return data;
  }

  async getBackendLogs(params: {
    lines?: number;
    adminToken?: string;
  }): Promise<LogTailResponse> {
    const { lines = 200, adminToken } = params;
    const { data } = await this.client.get<LogTailResponse>('/v1/admin/logs/backend', {
      params: { lines },
      ...(adminToken
        ? { headers: { 'X-Admin-Token': adminToken } }
        : {}),
    });
    return data;
  }
}

export const api = new StockScreenerApi(getApiBaseUrl(), import.meta.env.VITE_API_KEY);
export default api;

import axios, { type AxiosInstance } from 'axios';
import type {
  StatusResponse,
  UpdateRequest,
  UpdateResponse,
  UpdateWaitRequest,
  UpdateWaitResponse,
  ScreenRequest,
  ScreenResponse,
  AvailabilityResponse,
  ExportEbkResponse,
  HealthResponse,
  StockListResponse,
  StockDailyResponse,
  FormulaItem,
  FormulaListResponse,
  FormulaCreate,
  FormulaUpdate,
  FormulaValidateRequest,
  FormulaValidateResponse,
  IndicatorSeriesResponse,
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

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
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

  async health(): Promise<HealthResponse> {
    const { data } = await this.client.get<HealthResponse>('/v1/health');
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
    params?: { start?: string; end?: string; limit?: number }
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
    params?: { start?: string; end?: string; limit?: number }
  ): Promise<IndicatorSeriesResponse> {
    const { data } = await this.client.get<IndicatorSeriesResponse>(
      `/v1/stocks/${encodeURIComponent(tsCode)}/indicators/${formulaId}`,
      { params }
    );
    return data;
  }
}

export const api = new StockScreenerApi(getApiBaseUrl(), import.meta.env.VITE_API_KEY);
export default api;

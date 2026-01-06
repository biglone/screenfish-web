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
}

export const api = new StockScreenerApi();
export default api;

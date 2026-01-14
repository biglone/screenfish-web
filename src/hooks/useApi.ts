import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type {
  AutoUpdateConfig,
  AutoScreenConfig,
  AutoScreenConfigUpdate,
  AutoScreenRunRequest,
  AutoScreenRunResponse,
  DataIntegrityResponse,
  UpdateRequest,
  UpdateWaitRequest,
  UpdateWaitResponse,
  ScreenRequest,
} from '../types/api';

// Query Keys
export const queryKeys = {
  health: ['health'] as const,
  version: ['version'] as const,
  status: ['status'] as const,
  autoUpdateConfig: ['autoUpdateConfig'] as const,
  autoScreenConfig: ['autoScreenConfig'] as const,
  dataIntegrity: (params: {
    provider?: 'baostock' | 'tushare';
    date?: string;
    lookback_days?: number;
    suspicious_ratio?: number;
    price_adjust?: 'none' | 'qfq' | 'hfq';
  }) =>
    [
      'dataIntegrity',
      params.provider ?? 'baostock',
      params.date ?? 'latest',
      params.lookback_days ?? 60,
      params.suspicious_ratio ?? 0.8,
      params.price_adjust ?? null,
    ] as const,
  screen: (params: ScreenRequest) => ['screen', params] as const,
  availability: (date: string, provider: string) => ['availability', date, provider] as const,
  updateWaitJob: (jobId: string) => ['updateWaitJob', jobId] as const,
};

// Health Check
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.health(),
    retry: false,
  });
}

export function useVersion() {
  return useQuery({
    queryKey: queryKeys.version,
    queryFn: () => api.version(),
    retry: false,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Status
export function useStatus() {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: () => api.status(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

// Update Mutation
export function useUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateRequest) => api.update(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}

// Update Wait Mutation
export function useUpdateWait() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateWaitRequest) => api.updateWait(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}

export function useAutoUpdateConfig(enabled = true) {
  return useQuery({
    queryKey: queryKeys.autoUpdateConfig,
    queryFn: () => api.getAutoUpdateConfig(),
    enabled,
    retry: false,
    refetchInterval: (query) => {
      const runStatus = (query.state.data as AutoUpdateConfig | undefined)?.run_status;
      return runStatus === 'running' ? 5000 : 30000;
    },
  });
}

export function useUpdateAutoUpdateConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AutoUpdateConfig) => api.updateAutoUpdateConfig(request),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.autoUpdateConfig, data);
    },
  });
}

export function useAutoScreenConfig(enabled = true) {
  return useQuery({
    queryKey: queryKeys.autoScreenConfig,
    queryFn: () => api.getAutoScreenConfig(),
    enabled,
    retry: false,
  });
}

export function useUpdateAutoScreenConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AutoScreenConfigUpdate) => api.updateAutoScreenConfig(request),
    onSuccess: (data: AutoScreenConfig) => {
      queryClient.setQueryData(queryKeys.autoScreenConfig, data);
    },
  });
}

export function useRunAutoScreen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AutoScreenRunRequest) => api.runAutoScreen(request),
    onSuccess: (data: AutoScreenRunResponse) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoScreenConfig });
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
      return data;
    },
  });
}

export function useUpdateWaitJob(jobId: string | null, enabled = true) {
  return useQuery<UpdateWaitResponse>({
    queryKey: queryKeys.updateWaitJob(jobId ?? ''),
    queryFn: () => api.getUpdateWaitJob(jobId!),
    enabled: enabled && !!jobId,
    retry: false,
    refetchInterval: (query) => {
      const status = (query.state.data as UpdateWaitResponse | undefined)?.status;
      return status === 'running' ? 2000 : false;
    },
  });
}

export function useCancelUpdateWaitJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.cancelUpdateWaitJob(jobId),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.updateWaitJob(data.job_id), data);
    },
  });
}

// Screen Query
export function useScreen(request: ScreenRequest, enabled = true) {
  return useQuery({
    queryKey: queryKeys.screen(request),
    queryFn: () => api.screen(request),
    enabled,
  });
}

// Screen Mutation (for manual triggering)
export function useScreenMutation() {
  return useMutation({
    mutationFn: (request: ScreenRequest) => api.screen(request),
  });
}

// Availability Query
export function useAvailability(
  date: string,
  provider: 'baostock' | 'tushare' = 'baostock',
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.availability(date, provider),
    queryFn: () => api.availability(date, provider),
    enabled,
  });
}

export function useDataIntegrity(
  params: {
    provider?: 'baostock' | 'tushare';
    date?: string;
    lookback_days?: number;
    suspicious_ratio?: number;
    price_adjust?: 'none' | 'qfq' | 'hfq';
  },
  enabled = true
) {
  return useQuery<DataIntegrityResponse>({
    queryKey: queryKeys.dataIntegrity(params),
    queryFn: () => api.dataIntegrity(params),
    enabled,
    retry: false,
    refetchInterval: 60000,
  });
}

// Export EBK Mutation
export function useExportEbk() {
  return useMutation({
    mutationFn: (request: ScreenRequest) => api.exportEbk(request),
  });
}

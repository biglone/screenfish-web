import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type {
  UpdateRequest,
  UpdateWaitRequest,
  ScreenRequest,
} from '../types/api';

// Query Keys
export const queryKeys = {
  health: ['health'] as const,
  status: ['status'] as const,
  screen: (params: ScreenRequest) => ['screen', params] as const,
  availability: (date: string, provider: string) => ['availability', date, provider] as const,
};

// Health Check
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.health(),
    retry: false,
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

// Export EBK Mutation
export function useExportEbk() {
  return useMutation({
    mutationFn: (request: ScreenRequest) => api.exportEbk(request),
  });
}

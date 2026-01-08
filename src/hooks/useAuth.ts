import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import api, { getStoredAuthToken, setStoredAuthToken } from '../api/client';
import type {
  AuthEmailCodeRequest,
  AuthEmailRegisterRequest,
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthUserResponse,
} from '../types/api';

export const authQueryKeys = {
  me: ['auth', 'me'] as const,
};

export function hasAuthToken(): boolean {
  return getStoredAuthToken().trim().length > 0;
}

export function logout(queryClient?: QueryClient) {
  setStoredAuthToken(null);
  if (queryClient) queryClient.clear();
}

export function useMe(enabled: boolean) {
  return useQuery<AuthUserResponse>({
    queryKey: authQueryKeys.me,
    queryFn: () => api.me(),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: AuthLoginRequest) => api.login(req),
    onSuccess: (data) => {
      api.setAuthToken(data.token);
      queryClient.invalidateQueries();
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: AuthRegisterRequest) => api.register(req),
    onSuccess: (data) => {
      api.setAuthToken(data.token);
      queryClient.invalidateQueries();
    },
  });
}

export function useRequestEmailCode() {
  return useMutation({
    mutationFn: (req: AuthEmailCodeRequest) => api.requestEmailCode(req),
  });
}

export function useRegisterEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: AuthEmailRegisterRequest) => api.registerWithEmail(req),
    onSuccess: (data) => {
      api.setAuthToken(data.token);
      queryClient.invalidateQueries();
    },
  });
}

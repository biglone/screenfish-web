import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useHealth } from '../hooks/useApi';
import { hasAuthToken, logout, useMe } from '../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthTokenChanged } from '../api/client';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const health = useHealth();
  const [tokenVersion, setTokenVersion] = useState(0);

  const authEnabled = health.data?.auth_enabled === true;
  const tokenPresent = hasAuthToken();

  const me = useMe(authEnabled && tokenPresent);

  useEffect(() => {
    const err = me.error;
    if (!err) return;
    if (err instanceof AxiosError && err.response?.status === 401) {
      logout(queryClient);
    }
  }, [me.error, queryClient]);

  useEffect(() => onAuthTokenChanged(() => setTokenVersion((v) => v + 1)), []);

  if (health.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (health.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-8">
        <div className="max-w-md rounded-lg bg-white p-6 shadow">
          <div className="text-lg font-semibold text-gray-900">无法连接后端</div>
          <div className="mt-2 text-sm text-gray-600">
            {(health.error as Error).message}
          </div>
        </div>
      </div>
    );
  }

  // tokenVersion forces re-render when localStorage token changes in this tab.
  void tokenVersion;

  if (!authEnabled) return <>{children}</>;

  if (!tokenPresent) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (me.error) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

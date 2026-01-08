import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { useHealth } from '../hooks/useApi';
import { useMe } from '../hooks/useAuth';

const ADMIN_TOKEN_STORAGE_KEY = 'screenfish_admin_token';

function getInitialAdminToken(): string {
  try {
    return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function LogsPage() {
  const health = useHealth();
  const authEnabled = health.data?.auth_enabled === true;
  const me = useMe(authEnabled);
  const isAdmin = !authEnabled || me.data?.role === 'admin';

  const [adminToken, setAdminToken] = useState(getInitialAdminToken);
  const [tailLines, setTailLines] = useState(200);
  const [follow, setFollow] = useState(true);
  const [filter, setFilter] = useState('');

  const enabled = isAdmin && adminToken.trim().length > 0;

  const logsQuery = useQuery({
    queryKey: ['admin', 'logs', 'backend', tailLines, adminToken],
    queryFn: () => api.getBackendLogs({ lines: tailLines, adminToken }),
    enabled,
    refetchInterval: enabled && follow ? 2000 : false,
    retry: false,
  });

  const filteredLines = useMemo(() => {
    const lines = logsQuery.data?.lines ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => l.toLowerCase().includes(q));
  }, [filter, logsQuery.data?.lines]);

  const handleSaveToken = () => {
    const t = adminToken.trim();
    try {
      if (t) localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, t);
      else localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    void logsQuery.refetch();
  };

  const headerRight = (
    <button
      type="button"
      onClick={() => logsQuery.refetch()}
      disabled={!enabled || logsQuery.isFetching}
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
    >
      {logsQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      刷新
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">后端日志</h1>
        {headerRight}
      </div>

      {!isAdmin && (
        <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
          需要管理员权限（admin）才能查看日志页面。
        </div>
      )}

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <label className="block text-sm font-medium text-gray-700">管理 Token（X-Admin-Token）</label>
            <div className="mt-1 flex gap-2">
              <input
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="请输入后端设置的 STOCK_SCREENER_ADMIN_TOKEN"
                disabled={!isAdmin}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveToken}
                disabled={!isAdmin}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                保存
              </button>
            </div>
            {!enabled && isAdmin && (
              <div className="mt-2 text-xs text-gray-500">
                需要配置后端环境变量 `STOCK_SCREENER_ENABLE_LOGS_API=1` 和 `STOCK_SCREENER_ADMIN_TOKEN` 才能使用。
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700">尾部行数</label>
            <select
              value={tailLines}
              onChange={(e) => setTailLines(parseInt(e.target.value, 10))}
              disabled={!isAdmin}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700">自动刷新</label>
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
                disabled={!isAdmin}
                className="h-4 w-4 text-blue-600"
              />
              跟随
            </label>
            <div className="mt-1 text-xs text-gray-500">每 2 秒刷新一次</div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700">筛选</label>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="过滤关键字（本地）"
              disabled={!isAdmin}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {logsQuery.data && (
          <div className="mt-4 text-xs text-gray-500">
            来源: {logsQuery.data.source}
            {logsQuery.data.unit ? ` | unit: ${logsQuery.data.unit}` : ''}
            {logsQuery.data.path ? ` | file: ${logsQuery.data.path}` : ''}
            {' | '}显示 {filteredLines.length}/{logsQuery.data.lines.length} 行
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow">
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">日志内容</div>
        </div>
        <div className="p-4">
          {!enabled ? (
            <div className="text-sm text-gray-500">请先输入并保存管理 Token。</div>
          ) : logsQuery.error ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              读取日志失败：{(logsQuery.error as Error).message}
            </div>
          ) : logsQuery.isFetching && !logsQuery.data ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : (
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-900 p-4 text-xs text-gray-100">
              {filteredLines.length > 0 ? filteredLines.join('\n') : '（无日志）'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

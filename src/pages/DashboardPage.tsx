import { useStatus, useHealth } from '../hooks/useApi';
import {
  Database,
  Calendar,
  TrendingUp,
  Server,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

export function DashboardPage() {
  const { data: health, isLoading: healthLoading, error: healthError } = useHealth();
  const { data: status, isLoading: statusLoading, error: statusError } = useStatus();

  const isConnected = !healthLoading && !healthError && health?.status === 'ok';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
        <div className="flex items-center gap-2">
          {healthLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : isConnected ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
            {isConnected ? '服务已连接' : '服务未连接'}
          </span>
        </div>
      </div>

      {statusError && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          无法获取服务状态：{(statusError as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<TrendingUp className="h-6 w-6" />}
          title="股票数量"
          value={statusLoading ? '-' : status?.stocks?.toLocaleString() ?? '-'}
          color="blue"
        />
        <StatCard
          icon={<Database className="h-6 w-6" />}
          title="数据行数"
          value={statusLoading ? '-' : status?.rows?.toLocaleString() ?? '-'}
          color="green"
        />
        <StatCard
          icon={<Calendar className="h-6 w-6" />}
          title="最新交易日"
          value={statusLoading ? '-' : formatDate(status?.max_daily_trade_date) ?? '-'}
          color="purple"
        />
        <StatCard
          icon={<Server className="h-6 w-6" />}
          title="数据提供商"
          value={statusLoading ? '-' : status?.provider_default ?? '-'}
          color="orange"
        />
      </div>

      {status && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">系统信息</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow label="今日日期" value={formatDate(status.today)} />
            <InfoRow label="缓存目录" value={status.cache_dir} />
            <InfoRow label="数据库路径" value={status.sqlite_path} />
            <InfoRow
              label="最后更新日期"
              value={formatDate(status.max_update_log_trade_date)}
            />
          </dl>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{value ?? '-'}</dd>
    </div>
  );
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  if (date.length === 8) {
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  }
  return date;
}

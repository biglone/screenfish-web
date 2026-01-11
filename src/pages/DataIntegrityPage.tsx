import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataIntegrity } from '../hooks/useApi';
import { usePriceAdjust, type PriceAdjustMode } from '../hooks/usePriceAdjust';
import { CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

export function DataIntegrityPage() {
  const [priceAdjust, setPriceAdjust] = usePriceAdjust();
  const [provider, setProvider] = useState<'baostock' | 'tushare'>('baostock');
  const [date, setDate] = useState<string>('latest');
  const [lookbackDays, setLookbackDays] = useState<number>(60);
  const [suspiciousRatio, setSuspiciousRatio] = useState<number>(0.8);

  const params = useMemo(
    () => ({
      provider,
      date,
      lookback_days: lookbackDays,
      suspicious_ratio: suspiciousRatio,
      price_adjust: priceAdjust,
    }),
    [provider, date, lookbackDays, suspiciousRatio, priceAdjust]
  );

  const integrityQuery = useDataIntegrity(params, true);
  const data = integrityQuery.data;

  const marketOrder = ['SH', 'SZ', 'BJ'] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">数据完整性</h1>
        <button
          type="button"
          onClick={() => void integrityQuery.refetch()}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          disabled={integrityQuery.isFetching}
        >
          {integrityQuery.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          刷新
        </button>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">检查参数</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">数据提供商</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'baostock' | 'tushare')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
            >
              <option value="baostock">baostock</option>
              <option value="tushare">tushare</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">日期</label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="latest 或 YYYYMMDD"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">检查窗口（天）</label>
            <input
              type="number"
              min={0}
              max={3650}
              value={String(lookbackDays)}
              onChange={(e) => setLookbackDays(Math.max(0, Math.min(3650, Number(e.target.value || 0))))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">异常阈值（比例）</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={String(suspiciousRatio)}
              onChange={(e) => {
                const next = Number(e.target.value || 0);
                setSuspiciousRatio(Math.max(0, Math.min(1, Number.isFinite(next) ? next : 0)));
              }}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">复权模式</label>
            <select
              value={priceAdjust}
              onChange={(e) => setPriceAdjust(e.target.value as PriceAdjustMode)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
            >
              <option value="qfq">前复权（QFQ）</option>
              <option value="none">不复权</option>
              <option value="hfq">后复权（HFQ）</option>
            </select>
          </div>
        </div>
      </div>

      {integrityQuery.isLoading && (
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            检查中...
          </div>
        </div>
      )}

      {integrityQuery.error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          完整性检查失败：{(integrityQuery.error as Error).message}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div
            className={`rounded-lg p-4 ${
              data.ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-3">
              {data.ok ? (
                <CheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
              )}
              <div className="flex-1">
                <div className="text-sm font-semibold">
                  {data.ok ? '数据完整' : '数据可能不完整'}
                </div>
                <div className="mt-1 text-sm">
                  目标交易日：{formatDate(data.target_date)}（复权：{data.price_adjust}）
                  <span className="mx-2">|</span>
                  检查交易日数：{data.open_trade_dates}
                  <span className="mx-2">|</span>
                  缺失更新日志：{data.missing_update_log_count}
                  <span className="mx-2">|</span>
                  缺失日线：{data.missing_daily_count}
                </div>
                {!data.ok && (
                  <div className="mt-2 text-sm">
                    建议先到 <Link className="underline" to="/update">数据更新</Link> 补齐后再筛选。
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="最新日线日期" value={formatDate(data.max_daily_trade_date)} />
            <StatCard title="更新日志日期" value={formatDate(data.max_update_log_trade_date)} />
            <StatCard title="日线行数(中位/最小)" value={`${data.daily_rows_median ?? '-'} / ${data.daily_rows_min ?? '-'}`} />
            <StatCard title="异常日期数" value={`${data.suspicious_daily_count}`} />
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">市场覆盖（目标交易日）</h2>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      市场
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      stock_basic 数量
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      日线行数
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      缺失交易日数
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {marketOrder.map((m) => (
                    <tr key={m}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900">{m}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                        {data.market_stock_basic?.[m] ?? 0}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                        {data.market_daily_rows_on_target_date?.[m] ?? 0}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">
                        {data.missing_market_daily_count?.[m] ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.missing_update_log_count > 0 && (
            <DetailsCard
              title={`缺失更新日志日期（前 ${data.missing_update_log_dates.length} 条）`}
              items={data.missing_update_log_dates}
            />
          )}

          {data.missing_daily_count > 0 && (
            <DetailsCard
              title={`缺失日线数据日期（前 ${data.missing_daily_dates.length} 条）`}
              items={data.missing_daily_dates}
            />
          )}

          {data.suspicious_daily_count > 0 && (
            <DetailsCard
              title={`疑似异常（前 ${data.suspicious_daily_dates.length} 条）`}
              items={data.suspicious_daily_dates.map((x) => `${x.trade_date} (${x.rows})`)}
            />
          )}

          {marketOrder.some((m) => (data.missing_market_daily_count?.[m] ?? 0) > 0) && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">按市场缺失日期</h2>
              <div className="space-y-4">
                {marketOrder.map((m) => {
                  const missing = data.missing_market_daily_dates?.[m] ?? [];
                  if (missing.length === 0) return null;
                  return (
                    <div key={m} className="text-sm text-gray-700">
                      <div className="font-medium text-gray-900">{m}</div>
                      <div className="mt-1 font-mono text-xs text-gray-600">{missing.join(', ')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function DetailsCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
      {items.length === 0 ? (
        <div className="text-sm text-gray-500">无</div>
      ) : (
        <div className="font-mono text-xs text-gray-700">{items.join(', ')}</div>
      )}
    </div>
  );
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  const d = String(date);
  if (d.length === 8) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  return d;
}


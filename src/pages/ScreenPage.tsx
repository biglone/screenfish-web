import { useState } from 'react';
import { useScreenMutation, useExportEbk } from '../hooks/useApi';
import type { ScreenRequest, ScreenHit } from '../types/api';
import {
  Search,
  Download,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function ScreenPage() {
  const [formData, setFormData] = useState<ScreenRequest>({
    date: 'latest',
    combo: 'and',
    lookback_days: 200,
    rules: null,
    with_name: true,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const screenMutation = useScreenMutation();
  const exportMutation = useExportEbk();

  const handleScreen = () => {
    screenMutation.mutate(formData);
  };

  const handleExport = () => {
    exportMutation.mutate(formData, {
      onSuccess: (data) => {
        // Download as file
        const blob = new Blob([data.ebk], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `screen_${data.trade_date}.ebk`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">股票筛选</h1>
      </div>

      {/* Filter Form */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              筛选日期
            </label>
            <input
              type="text"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              placeholder="latest 或 YYYYMMDD"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              组合方式
            </label>
            <select
              value={formData.combo}
              onChange={(e) =>
                setFormData({ ...formData, combo: e.target.value as 'and' | 'or' })
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="and">AND（全部满足）</option>
              <option value="or">OR（任一满足）</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              筛选规则
            </label>
            <input
              type="text"
              value={formData.rules ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  rules: e.target.value || null,
                })
              }
              placeholder="留空使用默认规则"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Advanced Options */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mt-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          高级选项
        </button>

        {showAdvanced && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                回溯天数
              </label>
              <input
                type="number"
                value={formData.lookback_days}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lookback_days: parseInt(e.target.value) || 200,
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                id="withName"
                checked={formData.with_name}
                onChange={(e) =>
                  setFormData({ ...formData, with_name: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="withName" className="ml-2 text-sm text-gray-700">
                显示股票名称
              </label>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleScreen}
            disabled={screenMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-blue-400"
          >
            {screenMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            开始筛选
          </button>

          {screenMutation.data && screenMutation.data.hits.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              导出 EBK
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {screenMutation.error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          筛选失败：{(screenMutation.error as Error).message}
        </div>
      )}

      {/* Results */}
      {screenMutation.data && (
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                筛选结果
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Filter className="h-4 w-4" />
                交易日: {formatDate(screenMutation.data.trade_date)} |{' '}
                共 {screenMutation.data.hits.length} 只股票
              </div>
            </div>
          </div>

          {screenMutation.data.hits.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              没有符合条件的股票
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      序号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      代码
                    </th>
                    {formData.with_name && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        名称
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      其他信息
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {screenMutation.data.hits.map((hit: ScreenHit, index: number) => (
                    <tr key={hit.ts_code} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {index + 1}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {hit.ts_code}
                      </td>
                      {formData.with_name && (
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {hit.name ?? '-'}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatExtraFields(hit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
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

function formatExtraFields(hit: ScreenHit): string {
  const excludeKeys = ['ts_code', 'name'];
  const extra = Object.entries(hit)
    .filter(([key]) => !excludeKeys.includes(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  return extra || '-';
}

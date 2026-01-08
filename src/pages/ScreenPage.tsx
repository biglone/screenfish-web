import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useScreenMutation, useExportEbk } from '../hooks/useApi';
import api from '../api/client';
import type { ScreenRequest, ScreenHit } from '../types/api';
import {
  Search,
  Download,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function ScreenPage() {
  const [formData, setFormData] = useState<ScreenRequest>({
    date: 'latest',
    combo: 'and',
    lookback_days: 200,
    rules: null,
    with_name: true,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedFormulas, setSelectedFormulas] = useState<Set<string>>(new Set());

  // Fetch formulas
  const { data: formulasData, isLoading: formulasLoading } = useQuery({
    queryKey: ['formulas', 'screen', 'enabled'],
    queryFn: () => api.listFormulas({ enabledOnly: true, kind: 'screen' }),
  });

  const screenMutation = useScreenMutation();
  const exportMutation = useExportEbk();

  const enabledFormulas = formulasData?.formulas ?? [];

  const handleToggleFormula = (name: string) => {
    setSelectedFormulas((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedFormulas.size === enabledFormulas.length) {
      setSelectedFormulas(new Set());
    } else {
      setSelectedFormulas(new Set(enabledFormulas.map((f) => f.name)));
    }
  };

  const handleScreen = () => {
    // Build rules string from selected formulas
    const rules =
      selectedFormulas.size > 0
        ? Array.from(selectedFormulas).join(',')
        : null;
    screenMutation.mutate({ ...formData, rules });
  };

  const handleExport = () => {
    const rules =
      selectedFormulas.size > 0
        ? Array.from(selectedFormulas).join(',')
        : null;
    exportMutation.mutate(
      { ...formData, rules },
      {
        onSuccess: (data) => {
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
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">股票筛选</h1>
      </div>

      {/* Formula Selection */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">选择筛选公式</h2>
          <div className="flex items-center gap-4">
            {enabledFormulas.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedFormulas.size === enabledFormulas.length
                  ? '取消全选'
                  : '全选'}
              </button>
            )}
            <Link
              to="/formulas"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              管理公式
            </Link>
          </div>
        </div>

        {formulasLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : enabledFormulas.length === 0 ? (
          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
            暂无启用的公式。请先到{' '}
            <Link to="/formulas" className="font-medium text-yellow-900 underline">
              公式管理
            </Link>{' '}
            创建并启用公式。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enabledFormulas.map((formula) => (
              <label
                key={formula.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  selectedFormulas.has(formula.name)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleFormula(formula.name)}
                  className="mt-0.5 flex-shrink-0"
                >
                  {selectedFormulas.has(formula.name) ? (
                    <CheckSquare className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Square className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{formula.name}</div>
                  {formula.description && (
                    <div className="mt-1 truncate text-sm text-gray-500">
                      {formula.description}
                    </div>
                  )}
                  <div className="mt-1 truncate font-mono text-xs text-gray-400">
                    {formula.formula.length > 50
                      ? formula.formula.slice(0, 50) + '...'
                      : formula.formula}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {selectedFormulas.size > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            已选择 {selectedFormulas.size} 个公式
          </div>
        )}
      </div>

      {/* Filter Options */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">筛选选项</h2>
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

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              高级选项
            </button>
          </div>
        </div>

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
            disabled={screenMutation.isPending || selectedFormulas.size === 0}
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

        {selectedFormulas.size === 0 && enabledFormulas.length > 0 && (
          <p className="mt-2 text-sm text-amber-600">请至少选择一个公式</p>
        )}
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
              <h2 className="text-lg font-semibold text-gray-900">筛选结果</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Filter className="h-4 w-4" />
                交易日: {formatDate(screenMutation.data.trade_date)} | 共{' '}
                {screenMutation.data.hits.length} 只股票
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
                      匹配规则
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      操作
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
                        {String(hit.rules ?? '-')}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <Link
                          to={`/stocks/${encodeURIComponent(hit.ts_code)}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          查看详情
                        </Link>
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

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useScreenMutation, useExportEbk } from '../hooks/useApi';
import api from '../api/client';
import type { ScreenRequest, ScreenHit, WatchlistItem } from '../types/api';
import { StockDetail } from '../components/StockDetail';
import { useWatchlist } from '../hooks/useWatchlist';
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
  const [selectedHits, setSelectedHits] = useState<Set<string>>(new Set());
  const [activeTsCode, setActiveTsCode] = useState<string | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  const { groups, createGroup, addItems } = useWatchlist();

  // Fetch formulas
  const { data: formulasData, isLoading: formulasLoading } = useQuery({
    queryKey: ['formulas', 'screen', 'enabled'],
    queryFn: () => api.listFormulas({ enabledOnly: true, kind: 'screen' }),
  });

  const screenMutation = useScreenMutation();
  const exportMutation = useExportEbk();

  const enabledFormulas = formulasData?.formulas ?? [];
  const hits = screenMutation.data?.hits ?? [];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (!activeTsCode) return;
      if (hits.length === 0) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

      const tsCodes = hits.map((x) => x.ts_code);
      const currentIndex = tsCodes.indexOf(activeTsCode);
      if (currentIndex === -1) return;
      const nextIndex = e.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= tsCodes.length) return;

      const nextTsCode = tsCodes[nextIndex];
      setActiveTsCode(nextTsCode);
      document
        .querySelector<HTMLElement>(`[data-ts-code="${nextTsCode}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTsCode, hits]);

  useEffect(() => {
    if (!targetGroupId && groups.length > 0) setTargetGroupId(groups[0].id);
  }, [groups, targetGroupId]);

  useEffect(() => {
    if (!screenMutation.data) return;
    setSelectedHits(new Set());
    setActiveTsCode(screenMutation.data.hits[0]?.ts_code ?? null);
  }, [screenMutation.data]);

  const selectedHitItems = useMemo(() => {
    if (!screenMutation.data) return [];
    if (selectedHits.size === 0) return [];
    const out: WatchlistItem[] = [];
    for (const hit of screenMutation.data.hits) {
      if (!selectedHits.has(hit.ts_code)) continue;
      out.push({
        ts_code: hit.ts_code,
        name: typeof hit.name === 'string' ? hit.name : null,
      });
    }
    return out;
  }, [screenMutation.data, selectedHits]);

  const allHitItems = useMemo<WatchlistItem[]>(() => {
    if (!screenMutation.data) return [];
    return screenMutation.data.hits.map((hit) => ({
      ts_code: hit.ts_code,
      name: typeof hit.name === 'string' ? hit.name : null,
    }));
  }, [screenMutation.data]);

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

  const handleToggleHit = (tsCode: string) => {
    setSelectedHits((prev) => {
      const next = new Set(prev);
      if (next.has(tsCode)) next.delete(tsCode);
      else next.add(tsCode);
      return next;
    });
  };

  const handleSelectAllHits = () => {
    if (!screenMutation.data) return;
    if (selectedHits.size === screenMutation.data.hits.length) {
      setSelectedHits(new Set());
    } else {
      setSelectedHits(new Set(screenMutation.data.hits.map((h) => h.ts_code)));
    }
  };

  const handleAddSelectedToGroup = () => {
    if (!screenMutation.data) return;
    if (!targetGroupId) return;
    const addingAll = selectedHits.size === 0;
    const items = addingAll ? allHitItems : selectedHitItems;
    if (items.length === 0) return;
    if (
      addingAll &&
      !window.confirm(`未选择股票，将把全部 ${items.length} 只加入分组，继续？`)
    ) {
      return;
    }
    void (async () => {
      try {
        setWatchlistError(null);
        setWatchlistBusy(true);
        await addItems(targetGroupId, items);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setWatchlistError(msg);
      } finally {
        setWatchlistBusy(false);
      }
    })();
  };

  const handleCreateGroupFromSelected = () => {
    if (!screenMutation.data) return;
    const items = selectedHitItems.length > 0 ? selectedHitItems : allHitItems;
    if (items.length === 0) return;

    const suggested = `筛选-${formatDate(screenMutation.data.trade_date)}`;
    const name = window.prompt('新建分组名称', suggested);
    if (!name) return;
    void (async () => {
      try {
        setWatchlistError(null);
        setWatchlistBusy(true);
        const id = await createGroup(name);
        if (!id) return;
        setTargetGroupId(id);
        await addItems(id, items);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setWatchlistError(msg);
      } finally {
        setWatchlistBusy(false);
      }
    })();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">股票筛选</h1>
      </div>

      {/* Formula Selection */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">选择筛选公式</h2>
          <div className="flex flex-wrap items-center gap-4">
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: result list */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
              <div className="border-b border-gray-200 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">筛选结果</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Filter className="h-4 w-4" />
                    交易日: {formatDate(screenMutation.data.trade_date)} | 共 {hits.length} 只
                  </div>
                </div>
              </div>

              <div className="border-b border-gray-100 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSelectAllHits}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    disabled={hits.length === 0}
                  >
                    {selectedHits.size === hits.length && hits.length > 0 ? '取消全选' : '全选'}
                  </button>
                  <div className="text-sm text-gray-500">已选 {selectedHits.size}</div>
                  <div className="flex-1" />
                  <Link to="/watchlist" className="text-sm text-gray-500 hover:text-gray-700">
                    打开自选
                  </Link>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={targetGroupId}
                    onChange={(e) => setTargetGroupId(e.target.value)}
                    disabled={watchlistBusy || groups.length === 0}
                    className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleAddSelectedToGroup}
                    disabled={watchlistBusy || !targetGroupId || hits.length === 0}
                    className="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                  >
                    加入分组
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateGroupFromSelected}
                    disabled={watchlistBusy || hits.length === 0}
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    新建分组
                  </button>

                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exportMutation.isPending || hits.length === 0}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    {exportMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    导出
                  </button>
                </div>

                {watchlistError && (
                  <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    自选分组操作失败：{watchlistError}
                  </div>
                )}
              </div>

              {hits.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-gray-500">
                  没有符合条件的股票
                </div>
              ) : (
                <div className="max-h-[720px] overflow-auto">
                  <ul className="divide-y divide-gray-100">
	                    {hits.map((hit: ScreenHit) => {
	                      const active = hit.ts_code === activeTsCode;
	                      const selected = selectedHits.has(hit.ts_code);
	                      return (
	                        <li
	                          key={hit.ts_code}
                              data-ts-code={hit.ts_code}
	                          className={active ? 'bg-blue-50' : 'hover:bg-gray-50'}
	                        >
                          <div className="flex items-start gap-3 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleHit(hit.ts_code)}
                              className="mt-0.5 flex-shrink-0"
                              title={selected ? '取消选择' : '选择'}
                            >
                              {selected ? (
                                <CheckSquare className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Square className="h-5 w-5 text-gray-400" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setActiveTsCode(hit.ts_code)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="truncate text-sm font-medium text-gray-900">
                                {formData.with_name && hit.name
                                  ? `${hit.name} (${hit.ts_code})`
                                  : hit.ts_code}
                              </div>
                              <div className="mt-1 truncate text-xs text-gray-500">
                                {String(hit.rules ?? '-')}
                              </div>
                            </button>

                            <Link
                              to={`/stocks/${encodeURIComponent(hit.ts_code)}`}
                              className="flex-shrink-0 text-sm text-blue-600 hover:text-blue-800"
                              title="在新页面打开"
                            >
                              打开
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right: detail */}
          <div className="lg:col-span-7">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
              {activeTsCode ? (
                <StockDetail
                  tsCode={activeTsCode}
                  variant="panel"
                  onClose={() => setActiveTsCode(null)}
                />
              ) : (
                <div className="flex h-[560px] items-center justify-center text-sm text-gray-500">
                  从左侧选择一只股票查看K线
                </div>
              )}
            </div>
          </div>
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

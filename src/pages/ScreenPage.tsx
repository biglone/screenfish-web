import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useAutoScreenConfigs,
  useCreateAutoScreenConfig,
  useDataIntegrity,
  useExportEbk,
  useHealth,
  useScreenMutation,
} from '../hooks/useApi';
import { useMe } from '../hooks/useAuth';
import api from '../api/client';
import type { ScreenRequest, ScreenHit, WatchlistItem } from '../types/api';
import { StockDetail } from '../components/StockDetail';
import { useWatchlist } from '../hooks/useWatchlist';
import { usePriceAdjust, type PriceAdjustMode } from '../hooks/usePriceAdjust';
import { AutoScreenConfigsPanel } from '../components/AutoScreenConfigsPanel';
import {
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
  const [priceAdjust, setPriceAdjust] = usePriceAdjust();
  const [formData, setFormData] = useState<ScreenRequest>({
    date: 'latest',
    combo: 'and',
    lookback_days: 200,
    rules: null,
    with_name: true,
    exclude_st: true,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedFormulas, setSelectedFormulas] = useState<Set<string>>(new Set());
  const [selectedHits, setSelectedHits] = useState<Set<string>>(new Set());
  const [activeTsCode, setActiveTsCode] = useState<string | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [templateCreatedAt, setTemplateCreatedAt] = useState<number | null>(null);

  const { groups, createGroup, addItems } = useWatchlist();

  const health = useHealth();
  const authEnabled = health.data?.auth_enabled === true;
  const me = useMe(authEnabled);
  const isAdmin = !authEnabled || me.data?.role === 'admin';

  // Fetch formulas
  const { data: formulasData, isLoading: formulasLoading } = useQuery({
    queryKey: ['formulas', 'screen', 'enabled'],
    queryFn: () => api.listFormulas({ enabledOnly: true, kind: 'screen' }),
  });

  const screenMutation = useScreenMutation();
  const exportMutation = useExportEbk();
  const autoScreenConfigsQuery = useAutoScreenConfigs(isAdmin);
  const createAutoScreenConfigMutation = useCreateAutoScreenConfig();

  const enabledFormulas = formulasData?.formulas ?? [];
  const hits = screenMutation.data?.hits ?? [];

  const dateForIntegrity = 'latest';
  const canCheckIntegrity = true;
  const integrityQuery = useDataIntegrity(
    {
      provider: 'baostock',
      date: dateForIntegrity,
      lookback_days: Math.min(Math.max(0, formData.lookback_days ?? 200), 60),
      suspicious_ratio: 0.8,
      price_adjust: priceAdjust,
    },
    canCheckIntegrity
  );

  const selectedRules = useMemo(() => {
    if (selectedFormulas.size === 0) return '';
    const arr = Array.from(selectedFormulas);
    arr.sort();
    return arr.join(',');
  }, [selectedFormulas]);


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

  const handleCreateFromTemplate = () => {
    if (!isAdmin) return;
    const nextIndex = (autoScreenConfigsQuery.data?.configs?.length ?? 0) + 1;
    createAutoScreenConfigMutation.mutate(
      {
        enabled: true,
        group_name: `自动筛选-${nextIndex}`,
        combo: (formData.combo ?? 'and') as 'and' | 'or',
        rules: selectedRules.trim() ? selectedRules.trim() : null,
        lookback_days: Math.max(0, Math.round(formData.lookback_days ?? 200)),
        with_name: !!formData.with_name,
        exclude_st: !!formData.exclude_st,
        price_adjust: priceAdjust,
        replace_group: true,
      },
      {
        onSuccess: () => {
          setTemplateCreatedAt(Date.now());
        },
      }
    );
  };

  const handleExport = () => {
    const rules = selectedRules ? selectedRules : null;
    if (integrityQuery.data && !integrityQuery.data.ok) {
      const msg = `数据可能不完整（缺失更新日志 ${integrityQuery.data.missing_update_log_count}，缺失日线 ${integrityQuery.data.missing_daily_count}，异常 ${integrityQuery.data.suspicious_daily_count}），仍要继续导出？`;
      if (!window.confirm(msg)) return;
    }
    exportMutation.mutate(
      { ...formData, rules, price_adjust: priceAdjust },
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

      {!canCheckIntegrity ? (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          数据完整性检查：日期格式不正确，无法检查（请输入 <span className="font-mono">latest</span> 或{' '}
          <span className="font-mono">YYYYMMDD</span>）。
        </div>
      ) : integrityQuery.isLoading ? (
        <div className="rounded-lg bg-[color:var(--sf-primary-50)] p-4 text-sm text-[color:var(--sf-primary-800)]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--sf-primary-600)]" />
            数据完整性检查中...
          </div>
        </div>
      ) : integrityQuery.data ? (
        integrityQuery.data.ok ? (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
            数据完整性：OK（目标交易日 {formatDate(integrityQuery.data.target_date)}）
            {integrityQuery.isFetching ? '（刷新中...）' : ''}。
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            数据可能不完整（目标交易日 {formatDate(integrityQuery.data.target_date)}）：缺失更新日志{' '}
            {integrityQuery.data.missing_update_log_count}，缺失日线 {integrityQuery.data.missing_daily_count}，异常{' '}
            {integrityQuery.data.suspicious_daily_count}
            {integrityQuery.isFetching ? '（刷新中...）' : ''}。建议先到{' '}
            <Link to="/integrity" className="underline">
              完整性检查
            </Link>{' '}
            或{' '}
            <Link to="/update" className="underline">
              数据更新
            </Link>
            。
          </div>
        )
      ) : integrityQuery.error ? (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          数据完整性检查失败：{(integrityQuery.error as Error).message}
        </div>
      ) : null}

      {/* Screen Config */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">新建配置模板</h2>
            <p className="mt-1 text-xs text-gray-500">使用该模板一键生成自动筛选配置。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/formulas" className="text-sm text-gray-500 hover:text-gray-700">
              管理公式
            </Link>
            <button
              type="button"
              onClick={handleCreateFromTemplate}
              disabled={!isAdmin || createAutoScreenConfigMutation.isPending}
              className="rounded-md bg-[color:var(--sf-primary-600)] px-3 py-2 text-sm text-white hover:bg-[color:var(--sf-primary-700)] disabled:bg-[color:var(--sf-primary-400)]"
            >
              用模板新建配置
            </button>
          </div>
        </div>
        {templateCreatedAt && (
          <div className="mt-2 text-xs text-green-700">
            已创建配置（{new Date(templateCreatedAt).toLocaleString()}）
          </div>
        )}

        <div className="mt-5 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">筛选公式</div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">已选 {selectedFormulas.size}</span>
                  {enabledFormulas.length > 0 && (
                    <button
                      onClick={handleSelectAll}
                      className="text-[color:var(--sf-primary-600)] hover:text-[color:var(--sf-primary-800)]"
                    >
                      {selectedFormulas.size === enabledFormulas.length ? '取消全选' : '全选'}
                    </button>
                  )}
                </div>
              </div>

              {formulasLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : enabledFormulas.length === 0 ? (
                <div className="mt-3 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
                  暂无启用的公式。请先到{' '}
                  <Link to="/formulas" className="font-medium text-yellow-900 underline">
                    公式管理
                  </Link>{' '}
                  创建并启用公式。
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {enabledFormulas.map((formula) => (
                    <label
                      key={formula.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        selectedFormulas.has(formula.name)
                          ? 'border-[color:var(--sf-primary-500)] bg-[color:var(--sf-primary-50)]'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleFormula(formula.name)}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {selectedFormulas.has(formula.name) ? (
                          <CheckSquare className="h-5 w-5 text-[color:var(--sf-primary-600)]" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900">{formula.name}</div>
                        {formula.description && (
                          <div className="mt-1 truncate text-sm text-gray-500">{formula.description}</div>
                        )}
                        <div className="mt-1 truncate font-mono text-xs text-gray-400">
                          {formula.formula.length > 50 ? `${formula.formula.slice(0, 50)}...` : formula.formula}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedFormulas.size === 0 && enabledFormulas.length > 0 && (
                <div className="mt-3 text-xs text-gray-500">留空表示使用全部启用公式。</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">筛选选项</div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  高级选项
                </button>
              </div>

              <div className="mt-3 space-y-4">
                <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                  自动筛选使用更新完成的最新交易日。
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">组合方式</label>
                    <select
                      value={formData.combo}
                      onChange={(e) => setFormData({ ...formData, combo: e.target.value as 'and' | 'or' })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                    >
                      <option value="and">AND（全部满足）</option>
                      <option value="or">OR（任一满足）</option>
                    </select>
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

                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    id="excludeSt"
                    checked={!!formData.exclude_st}
                    onChange={(e) => setFormData({ ...formData, exclude_st: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 accent-[color:var(--sf-primary-600)] focus:ring-[color:var(--sf-primary-500)]"
                  />
                  <label htmlFor="excludeSt">剔除ST股票</label>
                </div>

                {showAdvanced && (
                  <div className="grid grid-cols-1 gap-3 border-t border-gray-200 pt-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">回溯天数</label>
                      <input
                        type="number"
                        value={formData.lookback_days}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            lookback_days: parseInt(e.target.value) || 200,
                          })
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                      />
                    </div>

                    <div className="flex items-center pt-6">
                      <input
                        type="checkbox"
                        id="withName"
                        checked={formData.with_name}
                        onChange={(e) => setFormData({ ...formData, with_name: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 accent-[color:var(--sf-primary-600)] focus:ring-[color:var(--sf-primary-500)]"
                      />
                      <label htmlFor="withName" className="ml-2 text-sm text-gray-700">
                        显示股票名称
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AutoScreenConfigsPanel
        isAdmin={isAdmin}
        title="自动筛选（更新成功后自动写入分组）"
        headerExtra={
          <Link to="/update" className="text-sm text-gray-500 hover:text-gray-700">
            在更新页也可配置
          </Link>
        }
        getCreateDefaults={() => ({
          combo: (formData.combo ?? 'and') as 'and' | 'or',
          rules: selectedRules.trim() ? selectedRules.trim() : null,
          lookback_days: Math.max(0, Math.round(formData.lookback_days ?? 200)),
          with_name: !!formData.with_name,
          exclude_st: !!formData.exclude_st,
          price_adjust: priceAdjust,
        })}
      />

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
                      className="text-sm text-[color:var(--sf-primary-600)] hover:text-[color:var(--sf-primary-800)]"
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
                      className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
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
                      className="h-9 rounded-md bg-[color:var(--sf-primary-600)] px-3 text-sm font-medium text-white hover:bg-[color:var(--sf-primary-700)] disabled:cursor-not-allowed disabled:bg-[color:var(--sf-primary-400)]"
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
                            className={
                              active ? 'bg-[color:var(--sf-primary-50)]' : 'hover:bg-gray-50'
                            }
                          >
                          <div className="flex items-start gap-3 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleHit(hit.ts_code)}
                              className="mt-0.5 flex-shrink-0"
                              title={selected ? '取消选择' : '选择'}
                            >
                                {selected ? (
                                  <CheckSquare className="h-5 w-5 text-[color:var(--sf-primary-600)]" />
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
                                to={`/stocks/${encodeURIComponent(hit.ts_code)}?price_adjust=${encodeURIComponent(priceAdjust)}`}
                                className="flex-shrink-0 text-sm text-[color:var(--sf-primary-600)] hover:text-[color:var(--sf-primary-800)]"
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
                  key={activeTsCode}
                  tsCode={activeTsCode}
                  priceAdjust={priceAdjust}
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

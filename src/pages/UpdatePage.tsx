import { useEffect, useMemo, useState } from 'react';
import {
  useUpdate,
  useUpdateWait,
  useUpdateWaitJob,
  useCancelUpdateWaitJob,
  useStatus,
  useAutoUpdateConfig,
  useUpdateAutoUpdateConfig,
  useAutoScreenConfig,
  useUpdateAutoScreenConfig,
  useRunAutoScreen,
  useAvailability,
  useHealth,
} from '../hooks/useApi';
import { useMe } from '../hooks/useAuth';
import type { UpdateRequest, UpdateWaitRequest, UpdateWaitResponse } from '../types/api';
import {
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
} from 'lucide-react';

export function UpdatePage() {
  const health = useHealth();
  const authEnabled = health.data?.auth_enabled === true;
  const me = useMe(authEnabled);
  const isAdmin = !authEnabled || me.data?.role === 'admin';

  const allowNormalUpdate = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }, []);

  const { data: status, refetch: refetchStatus } = useStatus();
  const updateMutation = useUpdate();
  const updateWaitMutation = useUpdateWait();
  const cancelWaitJobMutation = useCancelUpdateWaitJob();

  const autoUpdateConfigQuery = useAutoUpdateConfig(isAdmin);
  const updateAutoUpdateConfigMutation = useUpdateAutoUpdateConfig();
  const [autoEnabledDraft, setAutoEnabledDraft] = useState<boolean | null>(null);
  const [autoIntervalMinutesDraft, setAutoIntervalMinutesDraft] = useState<number | null>(null);
  const [autoProviderDraft, setAutoProviderDraft] = useState<'baostock' | 'tushare' | null>(null);
  const [autoRepairDaysDraft, setAutoRepairDaysDraft] = useState<number | null>(null);
  const [autoSavedAt, setAutoSavedAt] = useState<number | null>(null);

  const autoScreenConfigQuery = useAutoScreenConfig(isAdmin);
  const updateAutoScreenConfigMutation = useUpdateAutoScreenConfig();
  const runAutoScreenMutation = useRunAutoScreen();
  const [screenEnabledDraft, setScreenEnabledDraft] = useState<boolean | null>(null);
  const [screenGroupNameDraft, setScreenGroupNameDraft] = useState<string | null>(null);
  const [screenComboDraft, setScreenComboDraft] = useState<'and' | 'or' | null>(null);
  const [screenRulesDraft, setScreenRulesDraft] = useState<string | null>(null);
  const [screenLookbackDaysDraft, setScreenLookbackDaysDraft] = useState<number | null>(null);
  const [screenExcludeStDraft, setScreenExcludeStDraft] = useState<boolean | null>(null);
  const [screenPriceAdjustDraft, setScreenPriceAdjustDraft] = useState<'none' | 'qfq' | 'hfq' | null>(null);
  const [screenReplaceGroupDraft, setScreenReplaceGroupDraft] = useState<boolean | null>(null);
  const [screenForceRun, setScreenForceRun] = useState(false);
  const [screenSavedAt, setScreenSavedAt] = useState<number | null>(null);

  const autoEnabled = autoEnabledDraft ?? autoUpdateConfigQuery.data?.enabled ?? false;
  const autoIntervalMinutes =
    autoIntervalMinutesDraft ??
    (autoUpdateConfigQuery.data
      ? Math.max(1, Math.round(autoUpdateConfigQuery.data.interval_seconds / 60))
      : 10);
  const autoProvider = autoProviderDraft ?? autoUpdateConfigQuery.data?.provider ?? 'baostock';
  const autoRepairDays = autoRepairDaysDraft ?? autoUpdateConfigQuery.data?.repair_days ?? 30;

  const screenEnabled = screenEnabledDraft ?? autoScreenConfigQuery.data?.enabled ?? false;
  const screenGroupName = screenGroupNameDraft ?? autoScreenConfigQuery.data?.group_name ?? '自动筛选';
  const screenCombo = screenComboDraft ?? autoScreenConfigQuery.data?.combo ?? 'and';
  const screenRules = screenRulesDraft ?? autoScreenConfigQuery.data?.rules ?? '';
  const screenLookbackDays = screenLookbackDaysDraft ?? autoScreenConfigQuery.data?.lookback_days ?? 200;
  const screenExcludeSt = screenExcludeStDraft ?? autoScreenConfigQuery.data?.exclude_st ?? true;
  const screenPriceAdjust = screenPriceAdjustDraft ?? autoScreenConfigQuery.data?.price_adjust ?? 'qfq';
  const screenReplaceGroup = screenReplaceGroupDraft ?? autoScreenConfigQuery.data?.replace_group ?? true;
  const screenWithName = autoScreenConfigQuery.data?.with_name ?? false;

  const [mode, setMode] = useState<'normal' | 'wait'>('wait');
  const [waitJobId, setWaitJobId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UpdateRequest>({
    provider: 'baostock',
    start: null,
    end: null,
    repair_days: 30,
  });
  const [waitData, setWaitData] = useState<UpdateWaitRequest>({
    provider: 'baostock',
    target_date: null,
    repair_days: 30,
    interval_seconds: 300,
    timeout_seconds: 7200,
  });
  const [checkDate, setCheckDate] = useState('');

  const availabilityProvider = mode === 'normal' ? formData.provider : waitData.provider;
  const { data: availability, refetch: checkAvailability } = useAvailability(
    checkDate,
    availabilityProvider,
    !!checkDate && checkDate.length === 8
  );

  const waitJobQuery = useUpdateWaitJob(waitJobId, mode === 'wait' && !!waitJobId);
  const waitJob: UpdateWaitResponse | undefined = useMemo(() => {
    if (mode !== 'wait') return undefined;
    if (!waitJobId) return undefined;
    const data = waitJobQuery.data;
    if (data && data.job_id === waitJobId) return data;
    const started = updateWaitMutation.data;
    if (started && started.job_id === waitJobId) return started;
    return started;
  }, [mode, updateWaitMutation.data, waitJobId, waitJobQuery.data]);

  useEffect(() => {
    if (!waitJob) return;
    if (waitJob.status === 'succeeded') {
      void refetchStatus();
    }
  }, [refetchStatus, waitJob]);

  useEffect(() => {
    if (allowNormalUpdate) return;
    if (mode !== 'normal') return;
    setMode('wait');
  }, [allowNormalUpdate, mode]);

  const handleUpdate = () => {
    if (mode === 'normal') {
      if (!allowNormalUpdate) {
        setMode('wait');
        return;
      }
      updateMutation.mutate(formData, {
        onSuccess: () => refetchStatus(),
      });
    } else {
      updateWaitMutation.mutate(waitData, {
        onSuccess: (data) => {
          setWaitJobId(data.job_id);
        },
      });
    }
  };

  const handleSaveAutoUpdateConfig = () => {
    const interval_seconds = Math.max(1, Math.max(1, Math.round(autoIntervalMinutes)) * 60);
    updateAutoUpdateConfigMutation.mutate(
      {
        enabled: autoEnabled,
        interval_seconds,
        provider: autoProvider,
        repair_days: Math.max(0, Math.round(autoRepairDays)),
      },
      {
        onSuccess: () => {
          setAutoEnabledDraft(null);
          setAutoProviderDraft(null);
          setAutoRepairDaysDraft(null);
          setAutoIntervalMinutesDraft(null);
          setAutoSavedAt(Date.now());
        },
      }
    );
  };

  const handleSaveAutoScreenConfig = () => {
    updateAutoScreenConfigMutation.mutate(
      {
        enabled: screenEnabled,
        group_name: screenGroupName,
        combo: screenCombo,
        rules: screenRules.trim() ? screenRules.trim() : null,
        lookback_days: Math.max(0, Math.round(screenLookbackDays)),
        with_name: screenWithName,
        exclude_st: screenExcludeSt,
        price_adjust: screenPriceAdjust,
        replace_group: screenReplaceGroup,
      },
      {
        onSuccess: () => {
          setScreenEnabledDraft(null);
          setScreenGroupNameDraft(null);
          setScreenComboDraft(null);
          setScreenRulesDraft(null);
          setScreenLookbackDaysDraft(null);
          setScreenExcludeStDraft(null);
          setScreenPriceAdjustDraft(null);
          setScreenReplaceGroupDraft(null);
          setScreenSavedAt(Date.now());
        },
      }
    );
  };

  const isPending =
    updateMutation.isPending ||
    updateWaitMutation.isPending ||
    (mode === 'wait' && waitJob?.status === 'running');

  const error =
    mode === 'normal'
      ? updateMutation.error
      : updateWaitMutation.error ?? waitJobQuery.error;

  const waitJobUi = useMemo(() => {
    if (!waitJob) return null;
    const status = waitJob.status;
    if (status === 'running') {
      return {
        tone: 'info' as const,
        title: '任务运行中',
        icon: (
          <Clock className="h-5 w-5 animate-pulse text-[color:var(--sf-primary-600)]" />
        ),
      };
    }
    if (status === 'succeeded') {
      return { tone: 'success' as const, title: '更新完成', icon: <CheckCircle className="h-5 w-5 text-green-600" /> };
    }
    if (status === 'timeout') {
      return { tone: 'warning' as const, title: '已超时', icon: <XCircle className="h-5 w-5 text-yellow-600" /> };
    }
    if (status === 'canceled') {
      return { tone: 'warning' as const, title: '已取消', icon: <XCircle className="h-5 w-5 text-yellow-600" /> };
    }
    return { tone: 'error' as const, title: '任务失败', icon: <XCircle className="h-5 w-5 text-red-600" /> };
  }, [waitJob]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">数据更新</h1>
      </div>

      {!isAdmin && (
        <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
          需要管理员权限（admin）才能执行数据更新。
        </div>
      )}

      {/* Current Status */}
      <div className="rounded-lg bg-[color:var(--sf-primary-50)] p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[color:var(--sf-primary-600)]" />
          <div>
            <p className="text-sm font-medium text-[color:var(--sf-primary-800)]">当前数据状态</p>
            <p className="text-sm text-[color:var(--sf-primary-700)]">
              最新数据日期: {formatDate(status?.max_daily_trade_date)} |
              股票数量: {status?.stocks?.toLocaleString() ?? '-'} |
              数据行数: {status?.rows?.toLocaleString() ?? '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Update Form */}
      {isAdmin && (
        <>
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">自动更新设置</h2>

            {(autoUpdateConfigQuery.isLoading || autoUpdateConfigQuery.isFetching) && (
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中...
              </div>
            )}

            {autoUpdateConfigQuery.error && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                读取自动更新配置失败：{(autoUpdateConfigQuery.error as Error).message}
              </div>
            )}

            {updateAutoUpdateConfigMutation.error && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                保存自动更新配置失败：{(updateAutoUpdateConfigMutation.error as Error).message}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">启用</label>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={autoEnabled}
                    onChange={(e) => setAutoEnabledDraft(e.target.checked)}
                    disabled={!autoUpdateConfigQuery.data || updateAutoUpdateConfigMutation.isPending}
                    className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
                  />
                  自动更新
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">更新频率（分钟）</label>
                <input
                  type="number"
                  value={autoIntervalMinutes}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setAutoIntervalMinutesDraft(Number.isNaN(v) ? 10 : Math.max(1, v));
                  }}
                  disabled={!autoUpdateConfigQuery.data || updateAutoUpdateConfigMutation.isPending}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                />
                <div className="mt-1 text-xs text-gray-500">默认 10 分钟</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">数据提供商</label>
                <select
                  value={autoProvider}
                  onChange={(e) => setAutoProviderDraft(e.target.value as 'baostock' | 'tushare')}
                  disabled={!autoUpdateConfigQuery.data || updateAutoUpdateConfigMutation.isPending}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                >
                  <option value="baostock">BaoStock（免费）</option>
                  <option value="tushare">TuShare（需要 Token）</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">修复回溯（天）</label>
                <input
                  type="number"
                  value={autoRepairDays}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setAutoRepairDaysDraft(Number.isNaN(v) ? 30 : Math.max(0, v));
                  }}
                  disabled={!autoUpdateConfigQuery.data || updateAutoUpdateConfigMutation.isPending}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                />
                <div className="mt-1 text-xs text-gray-500">默认 30 天</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSaveAutoUpdateConfig}
                disabled={!autoUpdateConfigQuery.data || updateAutoUpdateConfigMutation.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--sf-primary-600)] px-4 py-2 text-white hover:bg-[color:var(--sf-primary-700)] disabled:bg-[color:var(--sf-primary-400)] sm:w-auto"
              >
                {updateAutoUpdateConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                保存配置
              </button>
            </div>

            {autoSavedAt && (
              <div className="mt-3 text-xs text-green-700">
                已保存（{new Date(autoSavedAt).toLocaleString()}）
              </div>
            )}

            {autoUpdateConfigQuery.data && (
              <div className="mt-4 text-xs text-gray-600">
                <div>上次尝试：{formatTimestamp(autoUpdateConfigQuery.data.last_run_at)}</div>
                <div>
                  上次成功：{formatDate(autoUpdateConfigQuery.data.last_success_trade_date)}（{formatTimestamp(
                    autoUpdateConfigQuery.data.last_success_at
                  )}）
                </div>
                {autoUpdateConfigQuery.data.last_error && (
                  <div className="mt-1 text-red-700">上次失败：{autoUpdateConfigQuery.data.last_error}</div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">自动筛选设置</h2>

            {(autoScreenConfigQuery.isLoading || autoScreenConfigQuery.isFetching) && (
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中...
              </div>
            )}

            {autoScreenConfigQuery.error && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                读取自动筛选配置失败：{(autoScreenConfigQuery.error as Error).message}
              </div>
            )}

            {updateAutoScreenConfigMutation.error && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                保存自动筛选配置失败：{(updateAutoScreenConfigMutation.error as Error).message}
              </div>
            )}

            {runAutoScreenMutation.error && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                执行自动筛选失败：{(runAutoScreenMutation.error as Error).message}
              </div>
            )}

            {autoScreenConfigQuery.data?.last_error && (
              <div className="mb-4 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                上次失败：{autoScreenConfigQuery.data.last_error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">启用</label>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={screenEnabled}
                    onChange={(e) => setScreenEnabledDraft(e.target.checked)}
                    disabled={!autoScreenConfigQuery.data || updateAutoScreenConfigMutation.isPending}
                    className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
                  />
                  自动筛选（更新成功后执行）
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">分组名称</label>
                <input
                  type="text"
                  value={screenGroupName}
                  onChange={(e) => setScreenGroupNameDraft(e.target.value)}
                  disabled={!autoScreenConfigQuery.data || updateAutoScreenConfigMutation.isPending}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                />
                <div className="mt-1 text-xs text-gray-500">自动写入到该分组（不存在则创建）</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">赋权模式</label>
                <select
                  value={screenPriceAdjust}
                  onChange={(e) => setScreenPriceAdjustDraft(e.target.value as 'none' | 'qfq' | 'hfq')}
                  disabled={!autoScreenConfigQuery.data || updateAutoScreenConfigMutation.isPending}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                >
                  <option value="qfq">前复权（qfq）</option>
                  <option value="hfq">后复权（hfq）</option>
                  <option value="none">不复权（none）</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">组合方式</label>
                <select
                  value={screenCombo}
                  onChange={(e) => setScreenComboDraft(e.target.value as 'and' | 'or')}
                  disabled={!autoScreenConfigQuery.data || updateAutoScreenConfigMutation.isPending}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                >
                  <option value="and">AND（全部满足）</option>
                  <option value="or">OR（满足任意）</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">回溯天数</label>
                <input
                  type="number"
                  value={screenLookbackDays}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setScreenLookbackDaysDraft(Number.isNaN(v) ? 200 : Math.max(0, v));
                  }}
                  disabled={!autoScreenConfigQuery.data || updateAutoScreenConfigMutation.isPending}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">选项</label>
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={screenExcludeSt}
                      onChange={(e) => setScreenExcludeStDraft(e.target.checked)}
                      disabled={!autoScreenConfigQuery.data || updateAutoScreenConfigMutation.isPending}
                      className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
                    />
                    剔除 ST
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={screenReplaceGroup}
                      onChange={(e) => setScreenReplaceGroupDraft(e.target.checked)}
                      disabled={!autoScreenConfigQuery.data || updateAutoScreenConfigMutation.isPending}
                      className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
                    />
                    覆盖分组（替换旧结果）
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700">规则（逗号分隔）</label>
                <textarea
                  value={screenRules}
                  onChange={(e) => setScreenRulesDraft(e.target.value)}
                  rows={2}
                  placeholder="例如：公式A,公式B（留空表示使用全部启用的公式；若无则使用内置规则）"
                  disabled={!autoScreenConfigQuery.data || updateAutoScreenConfigMutation.isPending}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                />
                <div className="mt-1 text-xs text-gray-500">
                  规则会在保存时校验（内置规则如 midline_ma60/kdj_oversold 也可用）。
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">手动执行</label>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={screenForceRun}
                    onChange={(e) => setScreenForceRun(e.target.checked)}
                    className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
                  />
                  强制重新筛选
                </label>
                <div className="mt-1 text-xs text-gray-500">用于验证/回测同一天结果</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSaveAutoScreenConfig}
                disabled={!autoScreenConfigQuery.data || updateAutoScreenConfigMutation.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--sf-primary-600)] px-4 py-2 text-white hover:bg-[color:var(--sf-primary-700)] disabled:bg-[color:var(--sf-primary-400)] sm:w-auto"
              >
                {updateAutoScreenConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                保存配置
              </button>

              <button
                type="button"
                onClick={() => runAutoScreenMutation.mutate({ date: 'latest', force: screenForceRun })}
                disabled={!autoScreenConfigQuery.data || runAutoScreenMutation.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 sm:w-auto"
              >
                {runAutoScreenMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                立即执行一次
              </button>
            </div>

            {screenSavedAt && (
              <div className="mt-3 text-xs text-green-700">
                已保存（{new Date(screenSavedAt).toLocaleString()}）
              </div>
            )}

            {autoScreenConfigQuery.data && (
              <div className="mt-4 text-xs text-gray-600">
                上次执行：
                {autoScreenConfigQuery.data.last_trade_date
                  ? `${autoScreenConfigQuery.data.last_trade_date}（命中 ${autoScreenConfigQuery.data.last_count ?? 0}）`
                  : '—'}
                {autoScreenConfigQuery.data.group_id ? ` | 分组ID: ${autoScreenConfigQuery.data.group_id}` : ''}
              </div>
            )}

            {runAutoScreenMutation.data?.message && (
              <div className="mt-3 text-xs text-green-700">{runAutoScreenMutation.data.message}</div>
            )}
          </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex items-center">
	                <input
	                  type="radio"
	                  checked={mode === 'normal'}
	                  onChange={() => setMode('normal')}
	                  disabled={!allowNormalUpdate}
	                  className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
	                />
                <span className={`ml-2 text-sm ${allowNormalUpdate ? 'text-gray-700' : 'text-gray-400'}`}>
                  普通更新（仅本地）
                </span>
              </label>
	              <label className="flex items-center">
	                <input
	                  type="radio"
	                  checked={mode === 'wait'}
	                  onChange={() => setMode('wait')}
	                  className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
	                />
                <span className="ml-2 text-sm text-gray-700">等待更新（轮询直到数据可用）</span>
              </label>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              推荐使用“等待更新”。通过公网/Cloudflare 访问时，“普通更新”会超时（504/524），因此已默认禁用。
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                数据提供商
              </label>
	              <select
	                value={mode === 'normal' ? formData.provider : waitData.provider}
	                onChange={(e) => {
	                  const provider = e.target.value as 'baostock' | 'tushare';
	                  if (mode === 'normal') {
	                    setFormData({ ...formData, provider });
	                  } else {
	                    setWaitData({ ...waitData, provider });
	                  }
	                }}
	                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
	              >
                <option value="baostock">BaoStock（免费）</option>
                <option value="tushare">TuShare（需要 Token）</option>
              </select>
            </div>

            {mode === 'normal' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    开始日期
                  </label>
	                  <input
	                    type="text"
	                    value={formData.start ?? ''}
	                    onChange={(e) =>
	                      setFormData({ ...formData, start: e.target.value || null })
	                    }
	                    placeholder="YYYYMMDD（留空自动）"
	                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
	                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    结束日期
                  </label>
	                  <input
	                    type="text"
	                    value={formData.end ?? ''}
	                    onChange={(e) =>
	                      setFormData({ ...formData, end: e.target.value || null })
	                    }
	                    placeholder="YYYYMMDD（留空到最新）"
	                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
	                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    目标日期
                  </label>
	                  <input
	                    type="text"
	                    value={waitData.target_date ?? ''}
	                    onChange={(e) =>
	                      setWaitData({
	                        ...waitData,
	                        target_date: e.target.value || null,
	                      })
	                    }
	                    placeholder="YYYYMMDD（留空为今日）"
	                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
	                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    轮询间隔（秒）
                  </label>
	                  <input
	                    type="number"
	                    value={waitData.interval_seconds}
	                    onChange={(e) =>
	                      setWaitData({
	                        ...waitData,
	                        interval_seconds: parseInt(e.target.value) || 300,
	                      })
	                    }
	                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
	                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    超时时间（秒）
                  </label>
	                  <input
	                    type="number"
	                    value={waitData.timeout_seconds}
	                    onChange={(e) =>
	                      setWaitData({
	                        ...waitData,
	                        timeout_seconds: parseInt(e.target.value) || 7200,
	                      })
	                    }
	                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
	                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                修复天数
              </label>
	              <input
	                type="number"
	                value={mode === 'normal' ? formData.repair_days : waitData.repair_days}
	                onChange={(e) => {
	                  const repair_days = parseInt(e.target.value) || 30;
	                  if (mode === 'normal') {
	                    setFormData({ ...formData, repair_days });
	                  } else {
	                    setWaitData({ ...waitData, repair_days });
	                  }
	                }}
	                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
	              />
            </div>
          </div>

	          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
	            <button
	              onClick={handleUpdate}
	              disabled={isPending || (mode === 'wait' && waitJob?.status === 'running')}
	              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--sf-primary-600)] px-4 py-2 text-white hover:bg-[color:var(--sf-primary-700)] disabled:bg-[color:var(--sf-primary-400)] sm:w-auto"
	            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {mode === 'normal' ? '开始更新' : '开始等待更新'}
            </button>

            {mode === 'wait' && waitJobId && waitJob?.status === 'running' && (
              <button
                type="button"
                onClick={() => cancelWaitJobMutation.mutate(waitJobId)}
                disabled={cancelWaitJobMutation.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 sm:w-auto"
              >
                {cancelWaitJobMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                取消任务
              </button>
            )}

            {mode === 'wait' && waitJobId && waitJob?.status !== 'running' && (
              <button
                type="button"
                onClick={() => setWaitJobId(null)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 sm:w-auto"
              >
                清除结果
              </button>
            )}
          </div>
        </div>
        </>
      )}

      {/* Check Availability */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">检查数据可用性</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
	        <input
	          type="text"
	          value={checkDate}
	          onChange={(e) => setCheckDate(e.target.value)}
	          placeholder="YYYYMMDD"
	          className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)] sm:w-48"
	        />
          <button
            onClick={() => checkAvailability()}
            disabled={!checkDate || checkDate.length !== 8}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 sm:w-auto"
          >
            检查
          </button>
        </div>

        {availability && (
          <div className="mt-4 flex items-center gap-2">
            {availability.available ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <span className={availability.available ? 'text-green-700' : 'text-red-700'}>
              {availability.detail}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          更新失败：{(error as Error).message}
        </div>
      )}

      {/* Result */}
      {mode === 'normal' && updateMutation.data && (
        <div className="rounded-lg bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">更新完成</p>
              <p className="text-sm text-green-700">
                最新数据日期: {formatDate(updateMutation.data.max_daily_trade_date)}
              </p>
            </div>
          </div>
        </div>
      )}

	      {mode === 'wait' && waitJobUi && waitJob && (
	        <div
	          className={`rounded-lg p-4 ${
	            waitJobUi.tone === 'success'
	              ? 'bg-green-50'
	              : waitJobUi.tone === 'info'
	                ? 'bg-[color:var(--sf-primary-50)]'
	                : waitJobUi.tone === 'warning'
	                  ? 'bg-yellow-50'
	                  : 'bg-red-50'
	          }`}
	        >
          <div className="flex items-start gap-3">
            {waitJobUi.icon}
            <div className="min-w-0">
              <p
	                className={`text-sm font-medium ${
	                  waitJobUi.tone === 'success'
	                    ? 'text-green-800'
	                    : waitJobUi.tone === 'info'
	                      ? 'text-[color:var(--sf-primary-800)]'
	                      : waitJobUi.tone === 'warning'
	                        ? 'text-yellow-800'
	                        : 'text-red-800'
	                }`}
	              >
                {waitJobUi.title}
              </p>
              <p
	                className={`mt-1 text-sm ${
	                  waitJobUi.tone === 'success'
	                    ? 'text-green-700'
	                    : waitJobUi.tone === 'info'
	                      ? 'text-[color:var(--sf-primary-700)]'
	                      : waitJobUi.tone === 'warning'
	                        ? 'text-yellow-700'
	                        : 'text-red-700'
	                }`}
	              >
                目标日期: {formatDate(waitJob.target_date)} | 提供商: {waitJob.provider} | 尝试次数: {waitJob.attempts} | 耗时: {waitJob.elapsed_seconds.toFixed(1)}秒
              </p>
              <p className="mt-1 text-xs text-gray-600">
                job_id: {waitJob.job_id} | latest: {formatDate(waitJob.latest_trade_date)} | {waitJob.message}
              </p>
              {waitJob.last_error && (
                <p className="mt-2 text-xs text-red-700">last_error: {waitJob.last_error}</p>
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

function formatTimestamp(ts: number | null | undefined): string {
  if (!ts || ts <= 0) return '-';
  return new Date(ts * 1000).toLocaleString();
}

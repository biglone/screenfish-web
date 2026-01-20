import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useAutoScreenConfigs,
  useCreateAutoScreenConfig,
  useUpdateAutoScreenConfigItem,
  useDeleteAutoScreenConfigItem,
  useRunAutoScreen,
} from '../hooks/useApi';
import api from '../api/client';
import type { AutoScreenConfig, AutoScreenConfigCreate } from '../types/api';
import { Loader2, RefreshCw, Save, X } from 'lucide-react';

interface AutoScreenConfigsPanelProps {
  isAdmin: boolean;
  title?: string;
  headerExtra?: ReactNode;
  getCreateDefaults?: () => Partial<AutoScreenConfigCreate>;
}

const BUILTIN_RULES = [
  {
    name: 'midline_ma60',
    label: 'midline_ma60',
    description: '执行中期多空线与MA60确认趋势',
  },
  {
    name: 'kdj_oversold',
    label: 'kdj_oversold',
    description: 'KDJ 超卖（J 低位）',
  },
];

const countRules = (rules: string | null | undefined) => {
  const tokens = String(rules ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(tokens).size;
};

export function AutoScreenConfigsPanel({
  isAdmin,
  title = '自动筛选设置',
  headerExtra,
  getCreateDefaults,
}: AutoScreenConfigsPanelProps) {
  const autoScreenConfigsQuery = useAutoScreenConfigs(isAdmin);
  const createAutoScreenConfigMutation = useCreateAutoScreenConfig();
  const updateAutoScreenConfigItemMutation = useUpdateAutoScreenConfigItem();
  const deleteAutoScreenConfigItemMutation = useDeleteAutoScreenConfigItem();
  const runAutoScreenMutation = useRunAutoScreen();
  const formulasQuery = useQuery({
    queryKey: ['formulas', 'screen', 'enabled'],
    queryFn: () => api.listFormulas({ enabledOnly: true, kind: 'screen' }),
  });
  const [autoScreenDrafts, setAutoScreenDrafts] = useState<Record<string, Partial<AutoScreenConfig>>>({});
  const [autoScreenSavedAt, setAutoScreenSavedAt] = useState<Record<string, number>>({});
  const [rulePickerConfigId, setRulePickerConfigId] = useState<string | null>(null);
  const [rulePickerSelected, setRulePickerSelected] = useState<Set<string>>(new Set());
  const [rulePickerSearch, setRulePickerSearch] = useState('');
  const [runMessages, setRunMessages] = useState<
    Record<string, { type: 'success' | 'error'; text: string; at: number }>
  >({});
  const [runPending, setRunPending] = useState<Record<string, boolean>>({});

  const autoScreenConfigs = autoScreenConfigsQuery.data?.configs ?? [];
  const formulas = formulasQuery.data?.formulas ?? [];
  const enabledCount = autoScreenConfigs.filter((item) => item.enabled).length;
  const builtinRules = BUILTIN_RULES;
  const ruleSearch = rulePickerSearch.trim().toLowerCase();
  const filteredBuiltinRules = useMemo(() => {
    if (!ruleSearch) return builtinRules;
    return builtinRules.filter((rule) => {
      const hay = `${rule.name} ${rule.label} ${rule.description}`.toLowerCase();
      return hay.includes(ruleSearch);
    });
  }, [builtinRules, ruleSearch]);
  const filteredFormulas = useMemo(() => {
    if (!ruleSearch) return formulas;
    return formulas.filter((formula) => {
      const hay = `${formula.name} ${formula.description ?? ''} ${formula.formula ?? ''}`.toLowerCase();
      return hay.includes(ruleSearch);
    });
  }, [formulas, ruleSearch]);
  const allRuleNames = useMemo(() => {
    const names = new Set<string>();
    builtinRules.forEach((rule) => names.add(rule.name));
    formulas.forEach((formula) => names.add(formula.name));
    return Array.from(names);
  }, [builtinRules, formulas]);
  const rulePickerPreview = useMemo(() => {
    const arr = Array.from(rulePickerSelected);
    arr.sort();
    return arr.join(',');
  }, [rulePickerSelected]);

  const formatTradeDate = (value: string | null | undefined) => {
    if (!value) return '-';
    if (value.length === 8) {
      return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    }
    return value;
  };

  const openRulePicker = (configId: string, rawRules: string) => {
    const next = new Set<string>();
    rawRules
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => next.add(item));
    setRulePickerConfigId(configId);
    setRulePickerSelected(next);
    setRulePickerSearch('');
  };

  const closeRulePicker = () => {
    setRulePickerConfigId(null);
    setRulePickerSelected(new Set());
    setRulePickerSearch('');
  };

  const toggleRulePickerItem = (name: string) => {
    setRulePickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const applyRulePicker = () => {
    if (!rulePickerConfigId) return;
    updateAutoScreenDraft(rulePickerConfigId, {
      rules: rulePickerPreview,
    });
    closeRulePicker();
  };

  const updateAutoScreenDraft = (configId: string, patch: Partial<AutoScreenConfig>) => {
    setAutoScreenDrafts((prev) => ({
      ...prev,
      [configId]: { ...(prev[configId] ?? {}), ...patch },
    }));
  };

  const setRunMessage = (configId: string, type: 'success' | 'error', text: string) => {
    setRunMessages((prev) => ({
      ...prev,
      [configId]: { type, text, at: Date.now() },
    }));
  };
  const setRunPendingState = (configId: string, pending: boolean) => {
    setRunPending((prev) => {
      const next = { ...prev };
      if (pending) {
        next[configId] = true;
      } else {
        delete next[configId];
      }
      return next;
    });
  };

  const clearAutoScreenDraft = (configId: string) => {
    setAutoScreenDrafts((prev) => {
      const next = { ...prev };
      delete next[configId];
      return next;
    });
  };

  const handleCreateAutoScreenConfig = () => {
    const nextIndex = autoScreenConfigs.length + 1;
    const baseRequest: AutoScreenConfigCreate = {
      enabled: true,
      group_name: `自动筛选-${nextIndex}`,
      combo: 'and',
      rules: null,
      lookback_days: 200,
      with_name: false,
      exclude_st: true,
      price_adjust: 'qfq',
      replace_group: true,
    };
    const overrides = getCreateDefaults ? getCreateDefaults() : null;
    const request = { ...baseRequest, ...(overrides ?? {}) };
    createAutoScreenConfigMutation.mutate(
      request,
      {
        onSuccess: () => {
          void autoScreenConfigsQuery.refetch();
        },
      }
    );
  };

  const handleSaveAutoScreenConfig = (config: AutoScreenConfig) => {
    const configId = config.id ?? '';
    if (!configId) return;
    const draft = autoScreenDrafts[configId] ?? {};
    const groupName = String(draft.group_name ?? config.group_name ?? '').trim();
    const ruleCount = countRules(draft.rules ?? config.rules ?? '');
    const comboValue = (draft.combo ?? config.combo ?? 'and') as 'and' | 'or';
    const normalizedCombo = ruleCount === 1 ? 'and' : comboValue;
    updateAutoScreenConfigItemMutation.mutate(
      {
        configId,
        request: {
          enabled: (draft.enabled ?? config.enabled) ?? false,
          group_name: groupName || '自动筛选',
          combo: normalizedCombo,
          rules: (draft.rules ?? config.rules ?? '').trim() ? (draft.rules ?? config.rules ?? '').trim() : null,
          lookback_days: Math.max(0, Math.round(draft.lookback_days ?? config.lookback_days ?? 200)),
          with_name: (draft.with_name ?? config.with_name ?? false) ?? false,
          exclude_st: (draft.exclude_st ?? config.exclude_st ?? true) ?? false,
          price_adjust: (draft.price_adjust ?? config.price_adjust ?? 'qfq') as 'none' | 'qfq' | 'hfq',
          replace_group: (draft.replace_group ?? config.replace_group ?? true) ?? true,
        },
      },
      {
        onSuccess: () => {
          clearAutoScreenDraft(configId);
          setAutoScreenSavedAt((prev) => ({ ...prev, [configId]: Date.now() }));
        },
      }
    );
  };

  const handleDeleteAutoScreenConfig = (configId: string) => {
    deleteAutoScreenConfigItemMutation.mutate(configId, {
      onSuccess: () => {
        setAutoScreenSavedAt((prev) => {
          const next = { ...prev };
          delete next[configId];
          return next;
        });
      },
    });
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {isAdmin && (
            <div className="mt-1 text-xs text-gray-500">
              共 {autoScreenConfigs.length} 条 | 启用 {enabledCount} 条
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerExtra}
          {isAdmin && (
            <button
              type="button"
              onClick={handleCreateAutoScreenConfig}
              disabled={createAutoScreenConfigMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
            >
              <Save className="h-4 w-4" />
              新增配置
            </button>
          )}
        </div>
      </div>

      {!isAdmin ? (
        <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          该功能需要管理员权限（用于保存配置并在后台自动写入分组）。
        </div>
      ) : (
        <>
          {(autoScreenConfigsQuery.isLoading || autoScreenConfigsQuery.isFetching) && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          )}

          {autoScreenConfigsQuery.error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              读取自动筛选配置失败：{(autoScreenConfigsQuery.error as Error).message}
            </div>
          )}

          {createAutoScreenConfigMutation.error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              新增自动筛选配置失败：{(createAutoScreenConfigMutation.error as Error).message}
            </div>
          )}

          {updateAutoScreenConfigItemMutation.error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              保存自动筛选配置失败：{(updateAutoScreenConfigItemMutation.error as Error).message}
            </div>
          )}

          {deleteAutoScreenConfigItemMutation.error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              删除自动筛选配置失败：{(deleteAutoScreenConfigItemMutation.error as Error).message}
            </div>
          )}

          {runAutoScreenMutation.error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              执行自动筛选失败：{(runAutoScreenMutation.error as Error).message}
            </div>
          )}

          {autoScreenConfigs.length === 0 && (
            <div className="rounded-md border border-dashed border-gray-200 p-4 text-sm text-gray-500">
              暂无配置，点击右上角“新增配置”创建自动筛选组合。
            </div>
          )}

          <div className="space-y-4">
            {autoScreenConfigs.map((config, index) => {
              const configId = config.id ?? '';
              if (!configId) return null;
              const draft = autoScreenDrafts[configId] ?? {};
              const enabled = draft.enabled ?? config.enabled ?? false;
              const groupName = String(draft.group_name ?? config.group_name ?? '自动筛选');
              const combo = (draft.combo ?? config.combo ?? 'and') as 'and' | 'or';
              const rules = String(draft.rules ?? config.rules ?? '');
              const ruleCount = countRules(rules);
              const comboDisabled = ruleCount === 1;
              const comboLabel = comboDisabled ? 'AND' : combo.toUpperCase();
              const lookbackDays = Number(draft.lookback_days ?? config.lookback_days ?? 200);
              const excludeSt = draft.exclude_st ?? config.exclude_st ?? true;
              const withName = draft.with_name ?? config.with_name ?? false;
              const priceAdjust = (draft.price_adjust ?? config.price_adjust ?? 'qfq') as 'none' | 'qfq' | 'hfq';
              const replaceGroup = draft.replace_group ?? config.replace_group ?? true;
              const canSave = groupName.trim().length > 0 && !updateAutoScreenConfigItemMutation.isPending;
              const savedAt = autoScreenSavedAt[configId];
              const runMessage = runMessages[configId];
              const isRunPending = !!runPending[configId];
              const lastTradeDate = formatTradeDate(config.last_trade_date);
              const lastCount = config.last_count ?? 0;

              return (
                <div key={configId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900">配置 {index + 1}</div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            enabled
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-gray-200 bg-gray-100 text-gray-600'
                          }`}
                        >
                          {enabled ? '启用' : '停用'}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                          {priceAdjust.toUpperCase()}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                          {comboLabel}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        上次执行 {lastTradeDate} | 命中 {lastCount}
                        {config.group_id ? ` | 分组ID: ${config.group_id}` : ''}
                      </div>
                      {savedAt && (
                        <div className="mt-1 text-xs text-green-700">
                          已保存（{new Date(savedAt).toLocaleString()}）
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm('确认删除该自动筛选配置吗？')) return;
                        handleDeleteAutoScreenConfig(configId);
                      }}
                      disabled={deleteAutoScreenConfigItemMutation.isPending}
                      className="text-sm text-red-600 hover:text-red-700 disabled:text-red-300"
                    >
                      删除
                    </button>
                  </div>

                  {config.last_error && (
                    <div className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                      上次失败：{config.last_error}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-8">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">启用</label>
                          <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) => updateAutoScreenDraft(configId, { enabled: e.target.checked })}
                              className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
                            />
                            自动筛选（更新成功后执行）
                          </label>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">分组名称</label>
                          <input
                            type="text"
                            value={groupName}
                            onChange={(e) => updateAutoScreenDraft(configId, { group_name: e.target.value })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                          />
                          <div className="mt-1 text-xs text-gray-500">分组名会自动追加交易日期。</div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">赋权模式</label>
                          <select
                            value={priceAdjust}
                            onChange={(e) =>
                              updateAutoScreenDraft(configId, {
                                price_adjust: e.target.value as 'none' | 'qfq' | 'hfq',
                              })
                            }
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
                            value={comboDisabled ? 'and' : combo}
                            onChange={(e) => updateAutoScreenDraft(configId, { combo: e.target.value as 'and' | 'or' })}
                            disabled={comboDisabled}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                          >
                            <option value="and">AND（全部满足）</option>
                            <option value="or">OR（满足任意）</option>
                          </select>
                          {comboDisabled && (
                            <div className="mt-1 text-xs text-gray-500">仅 1 条规则，组合方式不生效。</div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">回溯天数</label>
                          <input
                            type="number"
                            value={lookbackDays}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              updateAutoScreenDraft(configId, {
                                lookback_days: Number.isNaN(v) ? 200 : Math.max(0, v),
                              });
                            }}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-2">
                          <label className="block text-sm font-medium text-gray-700">规则（逗号分隔）</label>
                          <button
                            type="button"
                            onClick={() => openRulePicker(configId, rules)}
                            className="text-xs text-[color:var(--sf-primary-600)] hover:text-[color:var(--sf-primary-800)]"
                          >
                            选择规则
                          </button>
                        </div>
                        <textarea
                          value={rules}
                          readOnly
                          rows={2}
                          placeholder="点击“选择规则”进行配置"
                          onClick={() => openRulePicker(configId, rules)}
                          onFocus={() => openRulePicker(configId, rules)}
                          className="mt-1 block w-full cursor-pointer rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-700 shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
                          aria-readonly="true"
                        />
                        <div className="mt-1 text-xs text-gray-500">
                          规则会在保存时校验（内置规则如 midline_ma60/kdj_oversold 也可用）。
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-4">
                      <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                        <div className="text-xs font-semibold text-gray-600">选项</div>
                        <div className="mt-2 space-y-2 text-sm text-gray-700">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={excludeSt}
                              onChange={(e) => updateAutoScreenDraft(configId, { exclude_st: e.target.checked })}
                              className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
                            />
                            剔除 ST
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={withName}
                              onChange={(e) => updateAutoScreenDraft(configId, { with_name: e.target.checked })}
                              className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
                            />
                            写入名称
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={replaceGroup}
                              onChange={(e) => updateAutoScreenDraft(configId, { replace_group: e.target.checked })}
                              className="h-4 w-4 accent-[color:var(--sf-primary-600)]"
                            />
                            覆盖分组（替换旧结果）
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleSaveAutoScreenConfig(config)}
                      disabled={!canSave}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--sf-primary-600)] px-4 py-2 text-white hover:bg-[color:var(--sf-primary-700)] disabled:bg-[color:var(--sf-primary-400)] sm:w-auto"
                    >
                      {updateAutoScreenConfigItemMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      保存配置
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        (() => {
                          setRunMessage(configId, 'success', '执行中...');
                          setRunPendingState(configId, true);
                          runAutoScreenMutation.mutate(
                            { date: 'latest', force: true, config_id: configId },
                            {
                              onSuccess: (data) => {
                                const msg = data.message || `已执行 ${data.count} 只`;
                                setRunMessage(configId, 'success', msg);
                              },
                              onError: (err) => {
                                const msg = err instanceof Error ? err.message : String(err);
                                setRunMessage(configId, 'error', `执行失败：${msg}`);
                              },
                              onSettled: () => {
                                setRunPendingState(configId, false);
                              },
                            }
                          );
                        })()
                      }
                      disabled={isRunPending}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 sm:w-auto"
                    >
                      {isRunPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      立即执行一次
                      </button>
                  </div>
                  {runMessage && (
                    <div className={`text-xs ${runMessage.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
                      {runMessage.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {runAutoScreenMutation.data?.message && (
            <div className="mt-3 text-xs text-green-700">{runAutoScreenMutation.data.message}</div>
          )}
        </>
      )}

      {rulePickerConfigId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeRulePicker}
        >
          <div
            className="w-full max-w-4xl rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">选择规则</h3>
                <p className="mt-1 text-xs text-gray-500">
                  在此选择的规则需要点击“确认”才会写入配置。
                </p>
              </div>
              <button
                type="button"
                onClick={closeRulePicker}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">搜索规则</label>
              <input
                type="text"
                value={rulePickerSearch}
                onChange={(e) => setRulePickerSearch(e.target.value)}
                placeholder="输入规则名或公式名"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-600">内置规则</div>
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  {filteredBuiltinRules.length === 0 && (
                    <div className="text-xs text-gray-500">无匹配规则</div>
                  )}
                  {filteredBuiltinRules.map((rule) => (
                    <label key={rule.name} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={rulePickerSelected.has(rule.name)}
                        onChange={() => toggleRulePickerItem(rule.name)}
                        className="mt-0.5 h-4 w-4 accent-[color:var(--sf-primary-600)]"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">{rule.label}</div>
                        <div className="text-xs text-gray-500">{rule.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span>公式规则</span>
                  <span className="text-[11px] text-gray-500">
                    {formulasQuery.isLoading ? '加载中' : `${formulas.length} 条`}
                  </span>
                </div>
                <div className="mt-2 max-h-64 space-y-2 overflow-auto text-sm text-gray-700">
                  {formulasQuery.isLoading && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      加载公式中...
                    </div>
                  )}
                  {formulasQuery.error && (
                    <div className="text-xs text-red-600">
                      公式加载失败：{(formulasQuery.error as Error).message}
                    </div>
                  )}
                  {!formulasQuery.isLoading && filteredFormulas.length === 0 && (
                    <div className="text-xs text-gray-500">无匹配公式</div>
                  )}
                  {filteredFormulas.map((formula) => (
                    <label key={formula.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={rulePickerSelected.has(formula.name)}
                        onChange={() => toggleRulePickerItem(formula.name)}
                        className="mt-0.5 h-4 w-4 accent-[color:var(--sf-primary-600)]"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">{formula.name}</div>
                        {formula.description && (
                          <div className="text-xs text-gray-500">{formula.description}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-600">规则预览</div>
              <div className="mt-1 break-all font-mono text-xs text-gray-700">
                {rulePickerPreview || '留空将使用全部启用公式/内置规则'}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setRulePickerSelected(new Set())}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-gray-600 hover:bg-gray-50"
                >
                  清空选择
                </button>
                <button
                  type="button"
                  onClick={() => setRulePickerSelected(new Set(allRuleNames))}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-gray-600 hover:bg-gray-50"
                >
                  全选规则
                </button>
              </div>
              <div className="flex flex-1 justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRulePicker}
                  className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={applyRulePicker}
                  className="rounded-md bg-[color:var(--sf-primary-600)] px-4 py-2 text-sm text-white hover:bg-[color:var(--sf-primary-700)]"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

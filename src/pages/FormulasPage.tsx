import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import api from '../api/client';
import { useHealth } from '../hooks/useApi';
import { useMe } from '../hooks/useAuth';
import type { FormulaItem, FormulaCreate, FormulaUpdate } from '../types/api';

type ModalMode = 'create' | 'edit' | null;

// Helper to extract error message from axios error
function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && error.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '操作失败';
}

export function FormulasPage() {
  const health = useHealth();
  const authEnabled = health.data?.auth_enabled === true;
  const me = useMe(authEnabled);
  const isAdmin = !authEnabled || me.data?.role === 'admin';

  const queryClient = useQueryClient();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingFormula, setEditingFormula] = useState<FormulaItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formFormula, setFormFormula] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formKind, setFormKind] = useState<'screen' | 'indicator'>('screen');
  const [formTimeframe, setFormTimeframe] = useState<'D' | 'W' | 'M'>('D');
  const [formEnabled, setFormEnabled] = useState(true);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['formulas'],
    queryFn: () => api.listFormulas(),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormulaCreate) => api.createFormula(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormulaUpdate }) =>
      api.updateFormula(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteFormula(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      setDeleteConfirmId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.updateFormula(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
    },
  });

  const openCreateModal = () => {
    setModalMode('create');
    setEditingFormula(null);
    setFormName('');
    setFormFormula('');
    setFormDescription('');
    setFormKind('screen');
    setFormTimeframe('D');
    setFormEnabled(true);
    setValidationResult(null);
  };

  const openEditModal = (formula: FormulaItem) => {
    setModalMode('edit');
    setEditingFormula(formula);
    setFormName(formula.name);
    setFormFormula(formula.formula);
    setFormDescription(formula.description || '');
    setFormKind(formula.kind || 'screen');
    setFormTimeframe(formula.timeframe || 'D');
    setFormEnabled(formula.enabled);
    setValidationResult(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingFormula(null);
    setValidationResult(null);
  };

  const handleValidate = async () => {
    if (!formFormula.trim()) return;
    setIsValidating(true);
    try {
      const result = await api.validateFormula({ formula: formFormula });
      setValidationResult(result);
    } catch (err) {
      setValidationResult({
        valid: false,
        message: err instanceof Error ? err.message : '验证失败',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formFormula.trim()) return;

    const kind = formKind;
    const timeframe = kind === 'indicator' ? formTimeframe : null;

    if (modalMode === 'create') {
      createMutation.mutate({
        name: formName.trim(),
        formula: formFormula.trim(),
        description: formDescription.trim() || null,
        kind,
        timeframe,
        enabled: formEnabled,
      });
    } else if (modalMode === 'edit' && editingFormula) {
      updateMutation.mutate({
        id: editingFormula.id,
        data: {
          name: formName.trim(),
          formula: formFormula.trim(),
          description: formDescription.trim() || null,
          kind,
          timeframe,
          enabled: formEnabled,
        },
      });
    }
  };

  const handleToggleEnabled = (formula: FormulaItem) => {
    toggleMutation.mutate({ id: formula.id, enabled: !formula.enabled });
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">公式管理</h1>
        {isAdmin ? (
          <button
            onClick={openCreateModal}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            新建公式
          </button>
        ) : (
          <div className="text-sm text-gray-500">只读（需要管理员权限）</div>
        )}
      </div>

      {/* Help Info */}
      <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">通达信公式语法说明:</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-blue-700">
          <li>
            变量: OPEN/O, HIGH/H, LOW/L, CLOSE/C, VOL/V, AMOUNT
          </li>
          <li>
            函数: MA, EMA, SMA, REF, HHV, LLV, CROSS, STD, SUM, ABS, MAX, MIN,
            IF, COUNT, EVERY, EXIST, BARSLAST, SLOPE
          </li>
          <li>运算符: +, -, *, /, {'>'}, {'<'}, {'>='}, {'<='}, =, {'<>'}, AND, OR, NOT</li>
          <li>
            赋值: VAR:=表达式; 输出: 表达式;
          </li>
        </ul>
        <p className="mt-2 text-blue-600">
          示例: MA5:=MA(CLOSE,5); MA10:=MA(CLOSE,10); CROSS(MA5,MA10);
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          加载失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* Formula List */}
      {data && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Mobile / Tablet cards */}
          <div className="divide-y divide-gray-200 lg:hidden">
            {data.formulas.map((formula) => (
              <div key={formula.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleEnabled(formula)}
                        disabled={!isAdmin || toggleMutation.isPending}
                        className={`transition-colors ${
                          formula.enabled
                            ? 'text-green-600 hover:text-green-700'
                            : 'text-gray-400 hover:text-gray-500'
                        }`}
                        title={
                          !isAdmin ? '需要管理员权限' : formula.enabled ? '点击禁用' : '点击启用'
                        }
                      >
                        {formula.enabled ? (
                          <ToggleRight className="h-6 w-6" />
                        ) : (
                          <ToggleLeft className="h-6 w-6" />
                        )}
                      </button>
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {formula.name}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {formula.kind === 'indicator' ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          指标{formula.timeframe ? `(${formula.timeframe})` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          筛选
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {formula.enabled ? '已启用' : '已禁用'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      onClick={() => openEditModal(formula)}
                      disabled={!isAdmin}
                      className="rounded-md border border-gray-300 bg-white p-2 text-blue-600 hover:bg-gray-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      title="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    {deleteConfirmId === formula.id ? (
                      <>
                        <button
                          onClick={() => deleteMutation.mutate(formula.id)}
                          disabled={!isAdmin || deleteMutation.isPending}
                          className="rounded-md border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                          title="确认删除"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={!isAdmin}
                          className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                          title="取消"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(formula.id)}
                        disabled={!isAdmin}
                        className="rounded-md border border-gray-300 bg-white p-2 text-red-600 hover:bg-gray-50 hover:text-red-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-xs font-medium text-gray-500">公式</div>
                    <code className="mt-1 block whitespace-pre-wrap break-words rounded-md bg-gray-50 p-2 text-xs text-gray-700">
                      {formula.formula}
                    </code>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">描述</div>
                    <div className="mt-1 text-sm text-gray-700">
                      {formula.description || '-'}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {data.formulas.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                暂无公式，点击"新建公式"创建
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1100px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    名称
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    类型
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    公式
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    描述
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data.formulas.map((formula) => (
                  <tr key={formula.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <button
                        onClick={() => handleToggleEnabled(formula)}
                        disabled={!isAdmin || toggleMutation.isPending}
                        className={`transition-colors ${
                          formula.enabled
                            ? 'text-green-600 hover:text-green-700'
                            : 'text-gray-400 hover:text-gray-500'
                        }`}
                        title={
                          !isAdmin ? '需要管理员权限' : formula.enabled ? '点击禁用' : '点击启用'
                        }
                      >
                        {formula.enabled ? (
                          <ToggleRight className="h-6 w-6" />
                        ) : (
                          <ToggleLeft className="h-6 w-6" />
                        )}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {formula.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {formula.kind === 'indicator' ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          指标{formula.timeframe ? `(${formula.timeframe})` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          筛选
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-6 py-4">
                      <code className="text-sm text-gray-600">{formula.formula}</code>
                    </td>
                    <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-500">
                      {formula.description || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(formula)}
                          disabled={!isAdmin}
                          className="text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-gray-400"
                          title="编辑"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {deleteConfirmId === formula.id ? (
                          <>
                            <button
                              onClick={() => deleteMutation.mutate(formula.id)}
                              disabled={!isAdmin || deleteMutation.isPending}
                              className="text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:text-gray-400"
                              title="确认删除"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={!isAdmin}
                              className="text-gray-600 hover:text-gray-800 disabled:cursor-not-allowed disabled:text-gray-400"
                              title="取消"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(formula.id)}
                            disabled={!isAdmin}
                            className="text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:text-gray-400"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.formulas.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                暂无公式，点击"新建公式"创建
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {modalMode === 'create' ? '新建公式' : '编辑公式'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="例如：金叉选股"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  公式 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formFormula}
                  onChange={(e) => {
                    setFormFormula(e.target.value);
                    setValidationResult(null);
                  }}
                  rows={5}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="MA5:=MA(CLOSE,5);&#10;MA10:=MA(CLOSE,10);&#10;CROSS(MA5,MA10);"
                  required
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={isValidating || !formFormula.trim()}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                  >
                    {isValidating ? '验证中...' : '验证公式'}
                  </button>
                  {validationResult && (
                    <span
                      className={`flex items-center gap-1 text-sm ${
                        validationResult.valid ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {validationResult.valid ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      {validationResult.message}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  描述
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="可选的描述信息"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">类型</label>
                  <select
                    value={formKind}
                    onChange={(e) => setFormKind(e.target.value as 'screen' | 'indicator')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="screen">筛选公式</option>
                    <option value="indicator">指标公式（用于绘图）</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">周期</label>
                  <select
                    value={formTimeframe}
                    onChange={(e) => setFormTimeframe(e.target.value as 'D' | 'W' | 'M')}
                    disabled={formKind !== 'indicator'}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="D">日线 (D)</option>
                    <option value="W">周线 (W)</option>
                    <option value="M">月线 (M)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="enabled" className="text-sm text-gray-700">
                  启用此公式
                </label>
              </div>

              {(createMutation.error || updateMutation.error) && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {getErrorMessage(createMutation.error || updateMutation.error)}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {isSubmitting ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

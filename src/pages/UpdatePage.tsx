import { useState } from 'react';
import { useUpdate, useUpdateWait, useStatus, useAvailability } from '../hooks/useApi';
import type { UpdateRequest, UpdateWaitRequest } from '../types/api';
import {
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

export function UpdatePage() {
  const { data: status, refetch: refetchStatus } = useStatus();
  const updateMutation = useUpdate();
  const updateWaitMutation = useUpdateWait();

  const [mode, setMode] = useState<'normal' | 'wait'>('normal');
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

  const { data: availability, refetch: checkAvailability } = useAvailability(
    checkDate,
    formData.provider,
    !!checkDate && checkDate.length === 8
  );

  const handleUpdate = () => {
    if (mode === 'normal') {
      updateMutation.mutate(formData, {
        onSuccess: () => refetchStatus(),
      });
    } else {
      updateWaitMutation.mutate(waitData, {
        onSuccess: () => refetchStatus(),
      });
    }
  };

  const isPending = updateMutation.isPending || updateWaitMutation.isPending;
  const result = mode === 'normal' ? updateMutation.data : updateWaitMutation.data;
  const error = mode === 'normal' ? updateMutation.error : updateWaitMutation.error;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">数据更新</h1>
      </div>

      {/* Current Status */}
      <div className="rounded-lg bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800">当前数据状态</p>
            <p className="text-sm text-blue-700">
              最新数据日期: {formatDate(status?.max_daily_trade_date)} |
              股票数量: {status?.stocks?.toLocaleString() ?? '-'} |
              数据行数: {status?.rows?.toLocaleString() ?? '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Update Form */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4">
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                checked={mode === 'normal'}
                onChange={() => setMode('normal')}
                className="h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">普通更新</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={mode === 'wait'}
                onChange={() => setMode('wait')}
                className="h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">等待更新（轮询直到数据可用）</span>
            </label>
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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    setWaitData({ ...waitData, target_date: e.target.value || null })
                  }
                  placeholder="YYYYMMDD（留空为今日）"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleUpdate}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {mode === 'normal' ? '开始更新' : '开始等待更新'}
          </button>
        </div>
      </div>

      {/* Check Availability */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">检查数据可用性</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={checkDate}
            onChange={(e) => setCheckDate(e.target.value)}
            placeholder="YYYYMMDD"
            className="block w-48 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => checkAvailability()}
            disabled={!checkDate || checkDate.length !== 8}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
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
      {result && (
        <div className="rounded-lg bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">更新完成</p>
              {'ok' in result && 'attempts' in result ? (
                <p className="text-sm text-green-700">
                  目标日期: {formatDate(result.target_date)} |
                  尝试次数: {result.attempts} |
                  耗时: {result.elapsed_seconds.toFixed(1)}秒 |
                  {result.message}
                </p>
              ) : (
                <p className="text-sm text-green-700">
                  最新数据日期: {formatDate(result.max_daily_trade_date)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Update in progress indicator */}
      {isPending && mode === 'wait' && (
        <div className="rounded-lg bg-yellow-50 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 animate-pulse text-yellow-600" />
            <p className="text-sm text-yellow-800">
              正在等待数据更新，可能需要较长时间...
            </p>
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

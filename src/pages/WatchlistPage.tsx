import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, Upload, Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import api from '../api/client';
import { useWatchlist } from '../hooks/useWatchlist';
import { usePriceAdjust } from '../hooks/usePriceAdjust';
import { StockDetail } from '../components/StockDetail';
import type { StockItem } from '../types/api';

function tsCodeToEbkCode(tsCode: string): string {
  const raw = tsCode.trim();
  const [code, marketRaw] = raw.split('.', 2);
  const market = (marketRaw ?? '').trim().toUpperCase();
  const digits = code.trim();
  if (!/^\d{6}$/.test(digits)) throw new Error(`invalid ts_code: ${tsCode}`);
  if (market === 'SZ') return `0${digits}`;
  if (market === 'SH') return `1${digits}`;
  if (market === 'BJ') return `2${digits}`;
  throw new Error(`unsupported ts_code market: ${tsCode}`);
}

function buildEbkContent(tsCodes: string[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const tsCode of tsCodes) {
    const ebk = tsCodeToEbkCode(tsCode);
    if (seen.has(ebk)) continue;
    seen.add(ebk);
    lines.push(ebk);
  }
  return `\r\n${lines.join('\r\n')}`;
}

function ebkCodeToTsCode(ebkCode: string): string {
  const raw = ebkCode.trim().replace(/^\uFEFF/, '');
  if (!/^[012]\d{6}$/.test(raw)) throw new Error(`invalid ebk code: ${ebkCode}`);
  const digits = raw.slice(1);
  const marketFlag = raw[0];
  const market = marketFlag === '0' ? 'SZ' : marketFlag === '1' ? 'SH' : 'BJ';
  return `${digits}.${market}`;
}

function parseEbkContent(content: string): { tsCodes: string[]; ignoredLines: string[] } {
  const normalized = String(content ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const seen = new Set<string>();
  const tsCodes: string[] = [];
  const ignoredLines: string[] = [];

  const parseLine = (rawLine: string): string => {
    const line = rawLine.trim().replace(/^\uFEFF/, '');
    if (/^\d{6}\.(SZ|SH|BJ)$/i.test(line)) return line.toUpperCase();
    if (/^(SZ|SH|BJ)\d{6}$/i.test(line)) return `${line.slice(2)}.${line.slice(0, 2)}`.toUpperCase();
    if (/^[012]\d{6}$/.test(line)) return ebkCodeToTsCode(line).toUpperCase();
    if (/^\d{6}$/.test(line)) {
      const digits = line;
      // Best-effort fallback when market prefix is missing.
      if (digits.startsWith('6') || digits.startsWith('9')) return `${digits}.SH`;
      if (digits.startsWith('8') || digits.startsWith('4')) return `${digits}.BJ`;
      return `${digits}.SZ`;
    }
    throw new Error('unrecognized');
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    try {
      const tsCode = parseLine(trimmed);
      if (seen.has(tsCode)) continue;
      seen.add(tsCode);
      tsCodes.push(tsCode);
    } catch {
      ignoredLines.push(trimmed);
    }
  }

  return { tsCodes, ignoredLines };
}

function safeFilename(x: string): string {
  return x.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'watchlist';
}

const WATCHLIST_PANE_WIDTH_STORAGE_KEY = 'screenfish.watchlist.leftPaneWidth';
const DEFAULT_LEFT_PANE_WIDTH = 360;
const MIN_LEFT_PANE_WIDTH = 240;
const MIN_RIGHT_PANE_WIDTH = 520;
const RESIZER_WIDTH_PX = 12;
const RESIZER_STEP_PX = 24;

export function WatchlistPage() {
  const { groups, createGroup, renameGroup, deleteGroup, refresh, upsertItem, removeItems } =
    useWatchlist();
  const [priceAdjust] = usePriceAdjust();

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeTsCode, setActiveTsCode] = useState<string | null>(null);
  const [autoSelectDetail, setAutoSelectDetail] = useState(true);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistNotice, setWatchlistNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [addCode, setAddCode] = useState('');

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [splitEnabled, setSplitEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(min-width: 1024px)')?.matches ?? false;
  });

  const clampLeftPaneWidth = useCallback((rawWidth: number) => {
    const containerWidth = splitContainerRef.current?.clientWidth ?? 0;
    const maxByContainer =
      containerWidth > 0 ? containerWidth - MIN_RIGHT_PANE_WIDTH - RESIZER_WIDTH_PX : Infinity;
    const maxWidth = Math.max(MIN_LEFT_PANE_WIDTH, maxByContainer);
    return Math.max(MIN_LEFT_PANE_WIDTH, Math.min(rawWidth, maxWidth));
  }, []);

  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_LEFT_PANE_WIDTH;
    const saved = Number(window.localStorage.getItem(WATCHLIST_PANE_WIDTH_STORAGE_KEY));
    if (Number.isFinite(saved) && saved > 0) return saved;
    return DEFAULT_LEFT_PANE_WIDTH;
  });

  const resizeDragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(
    null
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setSplitEnabled(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    if (!splitEnabled) return;
    setLeftPaneWidth((w) => clampLeftPaneWidth(w));
  }, [clampLeftPaneWidth, splitEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!splitEnabled) return;
    window.localStorage.setItem(WATCHLIST_PANE_WIDTH_STORAGE_KEY, String(leftPaneWidth));
  }, [leftPaneWidth, splitEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!splitEnabled) return;
    const onResize = () => setLeftPaneWidth((w) => clampLeftPaneWidth(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampLeftPaneWidth, splitEnabled]);

  const endResizeDrag = useCallback(() => {
    if (!resizeDragRef.current) return;
    resizeDragRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    return () => endResizeDrag();
  }, [endResizeDrag]);

  const handleResizerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      resizeDragRef.current = { pointerId: e.pointerId, startX: e.clientX, startWidth: leftPaneWidth };
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    },
    [leftPaneWidth]
  );

  const handleResizerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = resizeDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const nextWidth = drag.startWidth + (e.clientX - drag.startX);
      setLeftPaneWidth(clampLeftPaneWidth(nextWidth));
    },
    [clampLeftPaneWidth]
  );

  const handleResizerPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endResizeDrag();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [endResizeDrag]
  );

  const handleResizerPointerCancel = useCallback(() => {
    endResizeDrag();
  }, [endResizeDrag]);

  const handleResizerDoubleClick = useCallback(() => {
    setLeftPaneWidth(clampLeftPaneWidth(DEFAULT_LEFT_PANE_WIDTH));
  }, [clampLeftPaneWidth]);

  const handleResizerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = (e.shiftKey ? 3 : 1) * RESIZER_STEP_PX;
      if (e.key === 'ArrowLeft') {
        setLeftPaneWidth((w) => clampLeftPaneWidth(w - step));
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowRight') {
        setLeftPaneWidth((w) => clampLeftPaneWidth(w + step));
        e.preventDefault();
        return;
      }
      if (e.key === 'Home') {
        setLeftPaneWidth(clampLeftPaneWidth(MIN_LEFT_PANE_WIDTH));
        e.preventDefault();
        return;
      }
      if (e.key === 'End') {
        const containerWidth = splitContainerRef.current?.clientWidth ?? 0;
        const maxByContainer =
          containerWidth > 0
            ? containerWidth - MIN_RIGHT_PANE_WIDTH - RESIZER_WIDTH_PX
            : DEFAULT_LEFT_PANE_WIDTH;
        setLeftPaneWidth(clampLeftPaneWidth(maxByContainer));
        e.preventDefault();
        return;
      }
    },
    [clampLeftPaneWidth]
  );

  const stockSearch = filter.trim();
  const stockSearchQuery = useQuery({
    queryKey: ['stocks', 'search', stockSearch],
    queryFn: () => api.listStocks({ search: stockSearch, limit: 20, offset: 0 }),
    enabled: stockSearch.length > 0,
    staleTime: 10_000,
    retry: 1,
  });
  const stockSearchResults = stockSearchQuery.data?.stocks ?? [];

  const activeGroup = useMemo(() => {
    if (groups.length === 0) return null;
    const found = activeGroupId ? groups.find((g) => g.id === activeGroupId) : null;
    return found ?? groups[0];
  }, [activeGroupId, groups]);

  const resolvedActiveTsCode = useMemo(() => {
    if (!activeGroup) return null;
    if (activeTsCode && activeGroup.items.some((i) => i.ts_code === activeTsCode)) return activeTsCode;
    if (!autoSelectDetail) return null;
    return activeGroup.items[0]?.ts_code ?? null;
  }, [activeGroup, activeTsCode, autoSelectDetail]);

  const filteredItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!activeGroup) return [];
    if (!q) return activeGroup.items;
    return activeGroup.items.filter((i) => {
      const code = i.ts_code.toLowerCase();
      const name = (i.name ?? '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [activeGroup, filter]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (!resolvedActiveTsCode) return;
      if (filteredItems.length === 0) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

      const tsCodes = filteredItems.map((x) => x.ts_code);
      const currentIndex = tsCodes.indexOf(resolvedActiveTsCode);
      const currentResolved = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex = e.key === 'ArrowDown' ? currentResolved + 1 : currentResolved - 1;
      if (nextIndex < 0 || nextIndex >= tsCodes.length) return;

      const nextTsCode = tsCodes[nextIndex];
      setActiveTsCode(nextTsCode);
      setAutoSelectDetail(true);
      document
        .querySelector<HTMLElement>(`[data-ts-code="${nextTsCode}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredItems, resolvedActiveTsCode]);

  const handleCreateGroup = () => {
    const name = window.prompt('新建分组名称', '新分组');
    if (!name) return;
    void (async () => {
      try {
        setWatchlistError(null);
        setWatchlistBusy(true);
        const id = await createGroup(name);
        if (id) setActiveGroupId(id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setWatchlistError(msg);
      } finally {
        setWatchlistBusy(false);
      }
    })();
  };

  const handleRenameGroup = (groupId: string, currentName: string) => {
    const name = window.prompt('重命名分组', currentName);
    if (!name) return;
    renameGroup(groupId, name);
  };

  const handleDeleteGroup = (groupId: string, name: string) => {
    if (!window.confirm(`确定删除分组「${name}」？`)) return;
    deleteGroup(groupId);
    if (activeGroupId === groupId) setActiveGroupId(null);
  };

  const handleAddStock = (stock: StockItem) => {
    if (!activeGroup) return;
    void (async () => {
      try {
        setWatchlistError(null);
        setWatchlistBusy(true);
        await upsertItem(activeGroup.id, { ts_code: stock.ts_code, name: stock.name });
        setActiveTsCode(stock.ts_code);
        setAutoSelectDetail(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setWatchlistError(msg);
      } finally {
        setWatchlistBusy(false);
      }
    })();
  };

  const handleAddCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;
    const raw = addCode.trim();
    if (!raw) return;
    void (async () => {
      try {
        setWatchlistError(null);
        setWatchlistBusy(true);

        const q = raw.toUpperCase();
        const isFullTsCode = /^\d{6}\.(SZ|SH|BJ)$/.test(q);

        const res = await api.listStocks({ search: q, limit: 20, offset: 0 });
        const stocks = res.stocks ?? [];
        if (stocks.length === 0) {
          throw new Error(isFullTsCode ? `未找到 ts_code：${q}` : `未找到股票：${raw}`);
        }

        const exact = stocks.find((s) => s.ts_code.toUpperCase() === q) ?? null;
        const target = exact ?? (stocks.length === 1 ? stocks[0] : null);
        if (!target) {
          const sample = stocks
            .slice(0, 5)
            .map((s) => s.ts_code)
            .join('，');
          const more = stocks.length > 5 ? '…' : '';
          throw new Error(`匹配到 ${stocks.length} 个结果，请输入完整 ts_code（例如：${sample}${more}）`);
        }

        await upsertItem(activeGroup.id, { ts_code: target.ts_code, name: target.name });
        setAddCode('');
        setActiveTsCode(target.ts_code);
        setAutoSelectDetail(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setWatchlistError(msg);
      } finally {
        setWatchlistBusy(false);
      }
    })();
  };

  const handleExportEbk = () => {
    if (!activeGroup) return;
    const tsCodes = activeGroup.items.map((i) => String(i.ts_code ?? '').trim()).filter(Boolean);
    if (tsCodes.length === 0) return;
    try {
      setWatchlistError(null);
      setWatchlistNotice(null);
      const content = buildEbkContent(tsCodes);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
        now.getDate()
      ).padStart(2, '0')}`;
      a.download = `${safeFilename(activeGroup.name)}_${stamp}.ebk`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWatchlistError(msg);
    }
  };

  const handleImportEbkClick = () => {
    if (!activeGroup) return;
    importInputRef.current?.click();
  };

  const handleImportEbkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    if (!activeGroup) return;

    void (async () => {
      try {
        setWatchlistBusy(true);
        setWatchlistError(null);
        setWatchlistNotice(null);

        const content = await file.text();
        const { tsCodes, ignoredLines } = parseEbkContent(content);
        if (tsCodes.length === 0) {
          throw new Error('文件中未解析到任何股票代码（请确认是通达信导出的 .EBK 文件）');
        }

        const res = await api.upsertWatchlistItems(activeGroup.id, {
          items: tsCodes.map((ts_code) => ({ ts_code, name: null })),
          ignore_unknown: true,
        });
        refresh();
        const unknownTotal = typeof res.unknown_total === 'number' ? res.unknown_total : 0;
        const unknownCodes = Array.isArray(res.unknown)
          ? res.unknown.map((x) => String(x ?? '').trim()).filter(Boolean)
          : [];
        const shownUnknownCodes = unknownCodes.slice(0, 10);

        setFilter('');
        setActiveGroupId(activeGroup.id);
        setActiveTsCode((prev) => prev ?? tsCodes[0] ?? null);
        setAutoSelectDetail(true);
        const noticeLines = [
          `已导入 ${Math.max(0, tsCodes.length - unknownTotal)} 只股票到「${activeGroup.name}」`,
        ];
        if (unknownTotal > 0) {
          const suffix =
            unknownTotal > shownUnknownCodes.length ? ` (+${unknownTotal - shownUnknownCodes.length})` : '';
          noticeLines.push(
            `已跳过 ${unknownTotal} 个系统暂无数据的代码：${shownUnknownCodes.join(', ')}${suffix}`
          );
        }
        if (ignoredLines.length > 0) {
          noticeLines.push(`已忽略 ${ignoredLines.length} 行无法识别的内容`);
        }
        setWatchlistNotice(noticeLines.join('\n'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setWatchlistError(msg);
      } finally {
        setWatchlistBusy(false);
      }
    })();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">自选分组</h1>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={importInputRef}
            type="file"
            accept=".ebk,.txt"
            className="hidden"
            onChange={handleImportEbkChange}
          />
          <button
            type="button"
            onClick={handleImportEbkClick}
            disabled={!activeGroup || watchlistBusy}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
            title={activeGroup ? `导入到「${activeGroup.name}」` : '导入'}
          >
            <Upload className="h-4 w-4" />
            导入 EBK
          </button>
          <button
            type="button"
            onClick={handleExportEbk}
            disabled={!activeGroup || activeGroup.items.length === 0}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
            title={activeGroup ? `导出「${activeGroup.name}」` : '导出'}
          >
            <Download className="h-4 w-4" />
            导出 EBK
          </button>
          <Link to="/screen" className="text-sm text-gray-500 hover:text-gray-700">
            去筛选并加入分组
          </Link>
        </div>
      </div>

      {watchlistNotice && (
        <div className="whitespace-pre-wrap rounded-lg bg-blue-50 p-4 text-blue-700">
          {watchlistNotice}
        </div>
      )}

      {watchlistError && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          自选分组操作失败：{watchlistError}
        </div>
      )}

      <div
        ref={splitContainerRef}
        className="grid grid-cols-1 gap-6 lg:gap-0 lg:grid-cols-[var(--watchlist-left-pane)_12px_minmax(0,1fr)]"
        style={
          { ['--watchlist-left-pane' as never]: `${leftPaneWidth}px` } as React.CSSProperties
        }
      >
        {/* Left: groups + list */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-semibold text-gray-900">分组</div>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={watchlistBusy}
                className="inline-flex items-center gap-1 rounded-md bg-[color:var(--sf-primary-600)] px-2 py-1 text-sm text-white hover:bg-[color:var(--sf-primary-700)] disabled:cursor-not-allowed disabled:bg-[color:var(--sf-primary-400)]"
              >
                <Plus className="h-4 w-4" />
                新建
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {groups.map((g) => {
                const active = activeGroup?.id === g.id;
                return (
                  <div
                    key={g.id}
                    className={`px-4 py-2 ${active ? 'bg-[color:var(--sf-primary-50)]' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveGroupId(g.id)}
                        className={`min-w-0 flex-1 truncate text-left text-sm ${
                          active
                            ? 'font-semibold text-[color:var(--sf-primary-700)]'
                            : 'text-gray-900 hover:text-[color:var(--sf-primary-700)]'
                        }`}
                        title={g.name}
                      >
                        {g.name}
                        <span className="ml-2 text-xs text-gray-400">({g.items.length})</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRenameGroup(g.id, g.name)}
                          className="text-gray-400 hover:text-gray-600"
                          title="重命名"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(g.id, g.name)}
                          className="text-gray-400 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-200 px-4 py-3">
              <div className="mb-2 text-sm font-semibold text-gray-900">股票</div>

	              <div className="mb-3 flex gap-2">
	                <div className="relative flex-1">
	                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
	                  <input
	                    value={filter}
	                    onChange={(e) => setFilter(e.target.value)}
	                    placeholder="搜索代码/名称..."
	                    className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
	                  />
	                </div>
	              </div>

	              {stockSearch && (
	                <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-2">
	                  <div className="mb-2 text-xs font-semibold text-gray-600">搜索结果</div>
	                  {stockSearchQuery.isFetching ? (
	                    <div className="text-xs text-gray-500">搜索中...</div>
	                  ) : stockSearchResults.length === 0 ? (
	                    <div className="text-xs text-gray-500">未找到相关股票</div>
	                  ) : (
	                    <ul className="space-y-1">
	                      {stockSearchResults.slice(0, 8).map((s) => {
	                        const inGroup = activeGroup?.items.some((i) => i.ts_code === s.ts_code) ?? false;
	                        return (
	                          <li key={s.ts_code} className="flex items-center justify-between gap-2">
	                            <div className="min-w-0 flex-1">
	                              <div className="truncate text-sm text-gray-900">
	                                {s.name ? `${s.name} (${s.ts_code})` : s.ts_code}
	                              </div>
	                            </div>
		                            <button
		                              type="button"
		                              onClick={() => handleAddStock(s)}
		                              disabled={!activeGroup || inGroup || watchlistBusy}
		                              className="h-7 rounded-md bg-[color:var(--sf-primary-600)] px-2 text-xs font-medium text-white hover:bg-[color:var(--sf-primary-700)] disabled:cursor-not-allowed disabled:bg-[color:var(--sf-primary-400)]"
		                            >
	                              {inGroup ? '已在组内' : '添加'}
	                            </button>
	                          </li>
	                        );
	                      })}
	                    </ul>
	                  )}
	                </div>
	              )}

	              <form onSubmit={handleAddCode} className="mb-3 flex gap-2">
	                <input
	                  value={addCode}
	                  onChange={(e) => setAddCode(e.target.value)}
	                  placeholder="输入 ts_code/名称 添加..."
	                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
	                />
	                <button
	                  type="submit"
	                  disabled={!activeGroup || watchlistBusy || addCode.trim().length === 0}
	                  className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
	                >
	                  添加
	                </button>
	              </form>

              <div className="max-h-[520px] overflow-auto">
                {activeGroup && filteredItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">暂无股票</div>
                ) : (
	                  <ul className="divide-y divide-gray-100">
                    {filteredItems.map((item) => {
                      const active = item.ts_code === resolvedActiveTsCode;
                      return (
	                        <li
                            key={item.ts_code}
                            data-ts-code={item.ts_code}
                            className={`relative ${
                              active ? 'bg-[color:var(--sf-primary-50)]' : 'hover:bg-gray-50'
                            }`}
                          >
                            {active && (
                              <div className="absolute inset-y-0 left-0 w-1 bg-[color:var(--sf-primary-600)]" />
                            )}
	                          <div className="flex items-center justify-between gap-2 px-3 py-2">
	                            <button
	                              type="button"
                              onClick={() => {
                                setActiveTsCode(item.ts_code);
                                setAutoSelectDetail(true);
                              }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="truncate text-sm font-medium text-gray-900">
                                {item.name ? `${item.name} (${item.ts_code})` : item.ts_code}
                              </div>
                              {item.name && (
                                <div className="truncate text-xs text-gray-500">{item.ts_code}</div>
                              )}
                            </button>
                            {activeGroup && (
                              <button
                                type="button"
                                onClick={() => removeItems(activeGroup.id, [item.ts_code])}
                                className="text-gray-400 hover:text-red-600"
                                title="移除"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整左右区域宽度"
          tabIndex={0}
          className="hidden select-none lg:flex"
          onPointerDown={handleResizerPointerDown}
          onPointerMove={handleResizerPointerMove}
          onPointerUp={handleResizerPointerUp}
          onPointerCancel={handleResizerPointerCancel}
          onDoubleClick={handleResizerDoubleClick}
          onKeyDown={handleResizerKeyDown}
          style={{ touchAction: 'none' }}
          title="拖动调整宽度（双击重置）"
        >
	          <div className="group relative h-full w-full cursor-col-resize rounded-md hover:bg-gray-50">
	            <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-gray-200 group-hover:bg-[color:var(--sf-primary-500)]" />
	          </div>
	        </div>

        {/* Right: detail */}
        <div className="min-w-0">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
            {resolvedActiveTsCode ? (
              <StockDetail
                tsCode={resolvedActiveTsCode}
                priceAdjust={priceAdjust}
                variant="panel"
                onClose={() => {
                  setActiveTsCode(null);
                  setAutoSelectDetail(false);
                }}
              />
            ) : (
              <div className="flex h-[560px] items-center justify-center text-sm text-gray-500">
                从左侧选择一只股票查看K线
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

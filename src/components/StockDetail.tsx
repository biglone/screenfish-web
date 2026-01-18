import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCcw,
  Star,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineWidth,
  type LogicalRange,
  type LineData,
  type Time,
  type WhitespaceData,
} from 'lightweight-charts';
import api from '../api/client';
import { useWatchlist } from '../hooks/useWatchlist';
import type { DailyBar, IndicatorLine, IndicatorPoint } from '../types/api';
import type { PriceAdjustMode } from '../hooks/usePriceAdjust';

const CHART_HEIGHT = 500;
const SUB_PANE_HEIGHT = 0.2;
const MAX_DAILY_BARS = 20000;
const DAILY_PAGE_SIZE = 1200;

type KlineTimeframe = 'D' | 'M' | 'Y';

const TIMEFRAME_LABEL: Record<KlineTimeframe, string> = {
  D: '日线',
  M: '月线',
  Y: '年线',
};

const DEFAULT_VISIBLE_BARS: Record<KlineTimeframe, number> = {
  D: 250,
  M: 60,
  Y: 20,
};

const PANEL_VISIBLE_BARS_STORAGE_KEY = 'screenfish_panel_kline_visible_bars_v1';
const INDICATOR_SELECTION_STORAGE_KEY = 'screenfish.kline.indicatorSelection';
const FULLSCREEN_VIEW_STATE_STORAGE_KEY = 'screenfish.kline.fullscreenViewState';

const PRICE_ADJUST_LABEL: Record<PriceAdjustMode, string> = {
  none: '不复权',
  qfq: '前复权',
  hfq: '后复权',
};

const COLOR_WARNING = '#f59e0b';
const COLOR_MUTED_LINE = '#9ca3af';
const COLOR_BULLBEAR_LINE = '#6b7280';
const INDICATOR_COLOR_PALETTE = [
  '#6366f1',
  COLOR_WARNING,
  '#10b981',
  '#ef4444',
  '#3b82f6',
  '#a855f7',
  '#14b8a6',
];

const KDJ_COLORS = {
  k: COLOR_WARNING,
  d: '#3b82f6',
  j: '#ef4444',
};

function pickIndicatorLineStyle(lines: IndicatorLine[], index: number): { color: string; lineWidth: LineWidth } {
  const line = lines[index];
  const name = String(line?.name ?? '').trim();
  const compactUpperName = name.replace(/\s+/g, '').toUpperCase();

  if (compactUpperName === 'MA60' || compactUpperName === 'MA1') {
    return { color: COLOR_WARNING, lineWidth: 1 };
  }

  if (compactUpperName === 'MA13' || compactUpperName === 'MA2' || compactUpperName === 'EMA13') {
    return { color: COLOR_MUTED_LINE, lineWidth: 1 };
  }
  const hasBullbear = lines.some((x) => String(x.name ?? '').includes('多空线'));
  if (hasBullbear) {
    const isBullbear = name.includes('多空线');
    if (isBullbear) return { color: COLOR_BULLBEAR_LINE, lineWidth: 1 };
    if (lines.length === 2) return { color: COLOR_MUTED_LINE, lineWidth: 1 };
  }
  const looksLikeMa = /^MA\d*$/i.test(name) || name.toUpperCase().startsWith('MA');
  if (looksLikeMa) return { color: COLOR_MUTED_LINE, lineWidth: 1 };
  return {
    color: INDICATOR_COLOR_PALETTE[index % INDICATOR_COLOR_PALETTE.length],
    lineWidth: index === 0 ? 2 : 1,
  };
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const v = Math.round(value);
  if (!Number.isFinite(v)) return fallback;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function visibleBarsFromLogicalRange(range: LogicalRange | null): number | null {
  if (!range) return null;
  if (!Number.isFinite(range.from) || !Number.isFinite(range.to)) return null;
  const len = range.to - range.from;
  if (!Number.isFinite(len) || len <= 0) return null;
  return Math.round(len);
}

function loadPanelVisibleBars(): Record<KlineTimeframe, number> {
  const out: Record<KlineTimeframe, number> = { ...DEFAULT_VISIBLE_BARS };
  if (typeof window === 'undefined') return out;
  try {
    const raw = localStorage.getItem(PANEL_VISIBLE_BARS_STORAGE_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Partial<Record<KlineTimeframe, unknown>>;
    out.D = clampInt(Number(parsed.D), 20, MAX_DAILY_BARS, out.D);
    out.M = clampInt(Number(parsed.M), 10, MAX_DAILY_BARS, out.M);
    out.Y = clampInt(Number(parsed.Y), 5, MAX_DAILY_BARS, out.Y);
  } catch {
    // ignore
  }
  return out;
}

function persistPanelVisibleBars(value: Record<KlineTimeframe, number>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PANEL_VISIBLE_BARS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

type FullscreenViewState = Record<KlineTimeframe, { barCount: number; rightGap: number }>;

function loadFullscreenViewState(): FullscreenViewState {
  const fallback: FullscreenViewState = {
    D: { barCount: DEFAULT_VISIBLE_BARS.D, rightGap: 0 },
    M: { barCount: DEFAULT_VISIBLE_BARS.M, rightGap: 0 },
    Y: { barCount: DEFAULT_VISIBLE_BARS.Y, rightGap: 0 },
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(FULLSCREEN_VIEW_STATE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<
      Record<KlineTimeframe, { barCount?: number; rightGap?: number; rightOffset?: number }>
    >;
    const toRightGap = (gap: unknown, offset: unknown) => {
      const gapNum = Number(gap);
      if (Number.isFinite(gapNum)) return Math.round(gapNum);
      const offsetNum = Number(offset);
      if (Number.isFinite(offsetNum)) return -Math.max(0, Math.round(offsetNum));
      return 0;
    };
    return {
      D: {
        barCount: clampInt(Number(parsed.D?.barCount), 5, MAX_DAILY_BARS, fallback.D.barCount),
        rightGap: toRightGap(parsed.D?.rightGap, parsed.D?.rightOffset),
      },
      M: {
        barCount: clampInt(Number(parsed.M?.barCount), 3, MAX_DAILY_BARS, fallback.M.barCount),
        rightGap: toRightGap(parsed.M?.rightGap, parsed.M?.rightOffset),
      },
      Y: {
        barCount: clampInt(Number(parsed.Y?.barCount), 2, MAX_DAILY_BARS, fallback.Y.barCount),
        rightGap: toRightGap(parsed.Y?.rightGap, parsed.Y?.rightOffset),
      },
    };
  } catch {
    return fallback;
  }
}

function persistFullscreenViewState(value: FullscreenViewState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FULLSCREEN_VIEW_STATE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function loadIndicatorSelection(): number | 'auto' | 'none' {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = String(localStorage.getItem(INDICATOR_SELECTION_STORAGE_KEY) ?? '').trim();
    if (!raw || raw === 'auto' || raw === 'none') return raw as 'auto' | 'none';
    const id = Number(raw);
    return Number.isFinite(id) ? id : 'auto';
  } catch {
    return 'auto';
  }
}

interface HoverData {
  bar: DailyBar;
  prevBar: DailyBar | null;
  x: number;
  y: number;
}

interface ModalData {
  bar: DailyBar;
  prevBar: DailyBar | null;
}

export type StockDetailVariant = 'page' | 'panel';

export type StockDetailProps = {
  tsCode: string;
  priceAdjust?: PriceAdjustMode;
  variant?: StockDetailVariant;
  onClose?: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
  navigationLabel?: string;
  onFullscreenChange?: (fullscreen: boolean) => void;
  initialFullscreen?: boolean;
};

function formatDate(yyyymmdd: string) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function toIsoDate(yyyymmdd: string): Time {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}` as Time;
}

function prevYyyymmdd(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6)) - 1;
  const d = Number(yyyymmdd.slice(6, 8));
  const dt = new Date(Date.UTC(y, m, d));
  if (Number.isNaN(dt.getTime())) return yyyymmdd;
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = String(dt.getUTCFullYear()).padStart(4, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function aggregateBars(bars: DailyBar[], timeframe: KlineTimeframe): DailyBar[] {
  if (timeframe === 'D') return bars;
  const out: DailyBar[] = [];
  let currentKey: string | null = null;
  let agg: DailyBar | null = null;

  for (const bar of bars) {
    const key = timeframe === 'M' ? bar.trade_date.slice(0, 6) : bar.trade_date.slice(0, 4);
    if (currentKey !== key) {
      if (agg) out.push(agg);
      currentKey = key;
      agg = { ...bar };
      continue;
    }
    if (!agg) {
      agg = { ...bar };
      continue;
    }
    agg.high = Math.max(agg.high, bar.high);
    agg.low = Math.min(agg.low, bar.low);
    agg.close = bar.close;
    agg.vol += bar.vol;
    agg.amount += bar.amount;
    agg.trade_date = bar.trade_date;
  }

  if (agg) out.push(agg);
  return out;
}

function buildIndicatorLineData(
  bars: DailyBar[],
  points: IndicatorPoint[]
): Array<LineData<Time> | WhitespaceData<Time>> {
  const valueByDate = new Map<string, number | null>();
  for (const p of points) {
    valueByDate.set(p.trade_date, p.value);
  }

  return bars.map((bar) => {
    const v = valueByDate.get(bar.trade_date);
    return v === null || v === undefined
      ? { time: toIsoDate(bar.trade_date) }
      : { time: toIsoDate(bar.trade_date), value: v };
  });
}

function sma(values: Array<number | null>, n: number, m: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const x = values[i];
    if (x === null || Number.isNaN(x)) {
      out[i] = null;
      continue;
    }
    if (prev === null || Number.isNaN(prev)) {
      prev = x;
      out[i] = prev;
      continue;
    }
    prev = (m * x + (n - m) * prev) / n;
    out[i] = prev;
  }
  return out;
}

function calcKdj(bars: DailyBar[], n = 9, m1 = 3, m2 = 3) {
  const llv: Array<number | null> = new Array(bars.length).fill(null);
  const hhv: Array<number | null> = new Array(bars.length).fill(null);

  for (let i = 0; i < bars.length; i += 1) {
    if (i < n - 1) continue;
    let minLow = Number.POSITIVE_INFINITY;
    let maxHigh = Number.NEGATIVE_INFINITY;
    for (let j = i - n + 1; j <= i; j += 1) {
      minLow = Math.min(minLow, bars[j].low);
      maxHigh = Math.max(maxHigh, bars[j].high);
    }
    llv[i] = minLow;
    hhv[i] = maxHigh;
  }

  const rsv: Array<number | null> = bars.map((bar, i) => {
    const lowN = llv[i];
    const highN = hhv[i];
    if (lowN === null || highN === null) return null;
    const denom = highN - lowN;
    if (denom === 0) return 0;
    return ((bar.close - lowN) / denom) * 100;
  });

  const k = sma(rsv, m1, 1);
  const d = sma(k, m2, 1);
  const j = k.map((kv, i) => {
    const dv = d[i];
    if (kv === null || dv === null) return null;
    return 3 * kv - 2 * dv;
  });

  return { k, d, j };
}

export function StockDetail({
  tsCode,
  priceAdjust = 'qfq',
  variant = 'page',
  onClose,
  onNavigate,
  canNavigatePrev = false,
  canNavigateNext = false,
  navigationLabel,
  onFullscreenChange,
  initialFullscreen = false,
}: StockDetailProps) {
  const tsCodeNormalized = tsCode.trim();
  const {
    groups: watchlistGroups,
    isLoading: watchlistLoading,
    upsertItem: upsertWatchlistItem,
    removeItems: removeWatchlistItems,
  } = useWatchlist();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const indicatorLineSeriesRefs = useRef<Array<ISeriesApi<'Line'>>>([]);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const kdjLineSeriesRefs = useRef<Array<ISeriesApi<'Line'>>>([]);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [indicatorSelection, setIndicatorSelection] = useState<number | 'auto' | 'none'>(() =>
    loadIndicatorSelection()
  );
  const [timeframe, setTimeframe] = useState<KlineTimeframe>('D');
  const [showVolume, setShowVolume] = useState(true);
  const [showKdj, setShowKdj] = useState(true);
  const [fullscreen, setFullscreen] = useState(() => !!initialFullscreen);
  const [chartHeight, setChartHeight] = useState<number>(CHART_HEIGHT);
  const [watchlistActionPending, setWatchlistActionPending] = useState(false);
  const [watchlistActionError, setWatchlistActionError] = useState<string | null>(null);
  const chartHeightRef = useRef<number>(CHART_HEIGHT);
  const fullscreenViewStateRef = useRef<FullscreenViewState>(loadFullscreenViewState());
  const mainAreaRatioRef = useRef<number>(
    1 - ((showVolume ? 1 : 0) + (showKdj ? 1 : 0)) * SUB_PANE_HEIGHT
  );
  const lastClickTime = useRef<number>(0);
  const lastClickDate = useRef<string | null>(null);

  const isPanel = variant === 'panel';
  const priceAdjustLabel = PRICE_ADJUST_LABEL[priceAdjust] ?? priceAdjust;
  const initialPanelVisibleBars = useMemo(() => loadPanelVisibleBars(), []);
  const panelVisibleBarsRef = useRef<Record<KlineTimeframe, number>>(initialPanelVisibleBars);
  const lastPersistPanelVisibleBarsAtRef = useRef<number>(0);
  const lastPersistFullscreenViewAtRef = useRef<number>(0);

  const setChartHeightSafe = useCallback((height: number) => {
    chartHeightRef.current = height;
    setChartHeight(height);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const value =
        indicatorSelection === 'auto' || indicatorSelection === 'none'
          ? indicatorSelection
          : String(indicatorSelection);
      localStorage.setItem(INDICATOR_SELECTION_STORAGE_KEY, value);
      window.dispatchEvent(new Event('screenfish_indicator_selection_changed'));
    } catch {
      // ignore
    }
  }, [indicatorSelection]);

  useEffect(() => {
    if (!onFullscreenChange) return;
    onFullscreenChange(fullscreen);
  }, [fullscreen, onFullscreenChange]);

  useEffect(() => {
    if (!onFullscreenChange) return;
    return () => onFullscreenChange(false);
  }, [onFullscreenChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (modalData) {
        setModalData(null);
        return;
      }
      if (fullscreen) {
        setFullscreen(false);
      }
    };
    if (!modalData && !fullscreen) return;
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen, modalData]);

  useEffect(() => {
    if (!fullscreen || !onNavigate) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (modalData) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (e.key === 'ArrowUp' && canNavigatePrev) {
        onNavigate('prev');
        e.preventDefault();
      }
      if (e.key === 'ArrowDown' && canNavigateNext) {
        onNavigate('next');
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen, onNavigate, canNavigatePrev, canNavigateNext, modalData]);

  useEffect(() => {
    const apply = () => {
      if (!fullscreen) {
        setChartHeightSafe(CHART_HEIGHT);
        return;
      }
      const next = Math.max(CHART_HEIGHT, Math.floor(window.innerHeight - 220));
      setChartHeightSafe(next);
    };

    apply();
    if (!fullscreen) return;
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [fullscreen, setChartHeightSafe]);

  const dailyQuery = useInfiniteQuery({
    queryKey: ['stock-daily', tsCodeNormalized, priceAdjust],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.getStockDaily(tsCodeNormalized, { end: pageParam, limit: DAILY_PAGE_SIZE, price_adjust: priceAdjust }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage, allPages) => {
      const total = allPages.reduce((acc, p) => acc + p.bars.length, 0);
      if (total >= MAX_DAILY_BARS) return undefined;
      if (lastPage.bars.length < DAILY_PAGE_SIZE) return undefined;
      let earliest: string | undefined;
      for (const page of allPages) {
        const first = page.bars[0]?.trade_date;
        if (!first) continue;
        if (!earliest || first < earliest) earliest = first;
      }
      return earliest ? prevYyyymmdd(earliest) : undefined;
    },
    enabled: !!tsCodeNormalized,
  });

  const dailyData = dailyQuery.data?.pages[0] ?? null;
  const dailyBars = useMemo(() => {
    const pages = dailyQuery.data?.pages ?? [];
    const map = new Map<string, DailyBar>();
    for (const page of pages) {
      for (const bar of page.bars) {
        map.set(bar.trade_date, bar);
      }
    }
    const out = Array.from(map.values());
    out.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
    return out;
  }, [dailyQuery.data]);

  const displayBars = useMemo(() => {
    return aggregateBars(dailyBars, timeframe);
  }, [dailyBars, timeframe]);

  const data = dailyData;
  const isLoading = dailyQuery.isLoading;
  const error = dailyQuery.error;
  const stockLabel = data?.name ? `${data.name} (${tsCodeNormalized})` : tsCodeNormalized;
  const watchlistItemName = data?.name ?? null;

  const defaultWatchlistGroup = useMemo(() => {
    if (watchlistGroups.length === 0) return null;
    return watchlistGroups.find((group) => group.id === 'default') ?? watchlistGroups[0] ?? null;
  }, [watchlistGroups]);

  const isInDefaultWatchlist = useMemo(() => {
    if (!defaultWatchlistGroup) return false;
    const target = tsCodeNormalized.toUpperCase();
    return defaultWatchlistGroup.items.some(
      (item) => item.ts_code.trim().toUpperCase() === target
    );
  }, [defaultWatchlistGroup, tsCodeNormalized]);

  const watchlistActionLabel = watchlistLoading
    ? '自选加载中'
    : !defaultWatchlistGroup
      ? '自选不可用'
      : watchlistActionPending
        ? isInDefaultWatchlist
          ? '移除中...'
          : '加入中...'
        : isInDefaultWatchlist
          ? '移除自选'
          : '加入自选';

  const watchlistActionTitle = isInDefaultWatchlist ? '从默认自选分组移除' : '加入默认自选分组';

  const watchlistActionDisabled =
    watchlistLoading || watchlistActionPending || !defaultWatchlistGroup;

  const handleToggleWatchlist = useCallback(async () => {
    if (!defaultWatchlistGroup) {
      setWatchlistActionError('自选分组不可用');
      return;
    }
    setWatchlistActionError(null);
    setWatchlistActionPending(true);
    try {
      if (isInDefaultWatchlist) {
        await removeWatchlistItems(defaultWatchlistGroup.id, [tsCodeNormalized]);
      } else {
        await upsertWatchlistItem(defaultWatchlistGroup.id, {
          ts_code: tsCodeNormalized,
          name: watchlistItemName,
        });
      }
    } catch (err) {
      setWatchlistActionError(
        err instanceof Error ? err.message : isInDefaultWatchlist ? '移除自选失败' : '加入自选失败'
      );
    } finally {
      setWatchlistActionPending(false);
    }
  }, [
    defaultWatchlistGroup,
    isInDefaultWatchlist,
    removeWatchlistItems,
    tsCodeNormalized,
    upsertWatchlistItem,
    watchlistItemName,
  ]);

  const {
    data: indicatorFormulasData,
    isLoading: indicatorsLoading,
    error: indicatorsError,
  } = useQuery({
    queryKey: ['formulas', 'indicator', 'enabled'],
    queryFn: () => api.listFormulas({ enabledOnly: true, kind: 'indicator' }),
  });

  const indicatorFormulas = indicatorFormulasData?.formulas ?? [];
  const preferredIndicatorId = useMemo(() => {
    if (indicatorFormulas.length === 0) return null;
    const keywordMatch = indicatorFormulas.find((f) => String(f.name ?? '').includes('多空线'));
    if (keywordMatch) return keywordMatch.id;
    const maMatch = indicatorFormulas.find((f) => /^MA\d+/i.test(String(f.name ?? '').trim()));
    return maMatch?.id ?? null;
  }, [indicatorFormulas]);
  const defaultIndicatorId = preferredIndicatorId ?? indicatorFormulas[0]?.id ?? null;
  const selectedIndicatorId =
    typeof indicatorSelection === 'number'
      ? indicatorFormulas.some((f) => f.id === indicatorSelection)
        ? indicatorSelection
        : defaultIndicatorId
      : indicatorSelection === 'none'
        ? null
        : defaultIndicatorId;

  const indicatorLimit = useMemo(() => {
    const base = Math.max(DAILY_PAGE_SIZE, dailyBars.length);
    return Math.min(MAX_DAILY_BARS, base);
  }, [dailyBars.length]);

  const {
    data: indicatorSeriesData,
    isLoading: indicatorSeriesLoading,
    error: indicatorSeriesError,
  } = useQuery({
    queryKey: ['indicator-series', tsCodeNormalized, selectedIndicatorId, indicatorLimit, priceAdjust],
    queryFn: () =>
      api.getIndicatorSeries(tsCodeNormalized, selectedIndicatorId!, { limit: indicatorLimit, price_adjust: priceAdjust }),
    enabled: !!tsCodeNormalized && selectedIndicatorId !== null && indicatorLimit > 0,
    placeholderData: keepPreviousData,
  });

  // Build a map for quick lookup
  const barsMap = useRef<Map<string, { bar: DailyBar; index: number }>>(new Map());
  const barsArrayRef = useRef<DailyBar[]>([]);

  const handleCrosshairMove = useCallback(
    (param: { time?: Time; point?: { x: number; y: number } }) => {
      if (!param.time || !param.point || !chartContainerRef.current) {
        setHoverData(null);
        return;
      }

      const chartHeight = chartHeightRef.current;
      if (param.point.y > chartHeight * mainAreaRatioRef.current) {
        setHoverData(null);
        return;
      }

      const timeStr = String(param.time).replace(/-/g, '');
      const entry = barsMap.current.get(timeStr);
      if (!entry) {
        setHoverData(null);
        return;
      }

      const { bar, index } = entry;
      const prevBar = index > 0 ? barsArrayRef.current[index - 1] ?? null : null;

      // Get container bounds for tooltip positioning
      const rect = chartContainerRef.current.getBoundingClientRect();
      let x = param.point.x + 15;
      let y = param.point.y - 10;

      // Keep tooltip within bounds
      if (x + 200 > rect.width) x = param.point.x - 215;
      if (y < 0) y = 10;

      setHoverData({ bar, prevBar, x, y });
    },
    []
  );

  const handleChartClick = useCallback((param: { time?: Time }) => {
    if (!param.time) return;

    const timeStr = String(param.time).replace(/-/g, '');
    const now = Date.now();

    // Detect double click (within 300ms and same date)
    if (lastClickDate.current === timeStr && now - lastClickTime.current < 300) {
      const entry = barsMap.current.get(timeStr);
      if (entry) {
        const { bar, index } = entry;
        const prevBar = index > 0 ? barsArrayRef.current[index - 1] ?? null : null;
        setModalData({ bar, prevBar });
      }
      lastClickDate.current = null;
    } else {
      lastClickDate.current = timeStr;
    }
    lastClickTime.current = now;
  }, []);

  const fetchMoreInFlightRef = useRef(false);
  useEffect(() => {
    if (!dailyQuery.isFetchingNextPage) {
      fetchMoreInFlightRef.current = false;
    }
  }, [dailyQuery.isFetchingNextPage]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) return;

    // Create chart
    const width = chartContainerRef.current.clientWidth || 600;
    const chart = createChart(chartContainerRef.current, {
      width,
      height: chartHeightRef.current,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#e0e0e0',
      },
      timeScale: {
        borderColor: '#e0e0e0',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;
    indicatorLineSeriesRefs.current = [];
    volumeSeriesRef.current = null;
    kdjLineSeriesRefs.current = [];

    // Add candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderDownColor: '#22c55e',
      borderUpColor: '#ef4444',
      wickDownColor: '#22c55e',
      wickUpColor: '#ef4444',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Subscribe to crosshair move for hover tooltip
    chart.subscribeCrosshairMove(handleCrosshairMove);

    // Subscribe to click for double-click detection
    chart.subscribeClick(handleChartClick);

    // Handle resize
    let resizeRafId: number | null = null;
    const scheduleResize = () => {
      if (resizeRafId !== null) return;
      resizeRafId = window.requestAnimationFrame(() => {
        resizeRafId = null;
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth || 600,
          });
        }
      });
    };

    window.addEventListener('resize', scheduleResize);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleResize) : null;
    if (resizeObserver && chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }
    scheduleResize();

    return () => {
      window.removeEventListener('resize', scheduleResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (resizeRafId !== null) window.cancelAnimationFrame(resizeRafId);
      if (chartRef.current) {
        chartRef.current.unsubscribeCrosshairMove(handleCrosshairMove);
        chartRef.current.unsubscribeClick(handleChartClick);
        chartRef.current.remove();
        chartRef.current = null;
      }
      candlestickSeriesRef.current = null;
      indicatorLineSeriesRefs.current = [];
      volumeSeriesRef.current = null;
      kdjLineSeriesRefs.current = [];
    };
  }, [handleCrosshairMove, handleChartClick]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({ height: chartHeightRef.current });
  }, [chartHeight]);

  const appliedInitialViewKeyRef = useRef<string>('');
  useEffect(() => {
    const chart = chartRef.current;
    const candlestickSeries = candlestickSeriesRef.current;
    if (!chart || !candlestickSeries) return;

    const viewKey = `${tsCodeNormalized}:${timeframe}`;
    const hasInitialView = appliedInitialViewKeyRef.current === viewKey;
    const prevVisibleRange = hasInitialView ? chart.timeScale().getVisibleRange() : null;

    // Build bars map
    barsMap.current.clear();
    barsArrayRef.current = displayBars;
    displayBars.forEach((bar, index) => {
      barsMap.current.set(bar.trade_date, { bar, index });
    });

    // Convert data to chart format
    const chartData: CandlestickData<Time>[] = displayBars.map((bar) => ({
      time: toIsoDate(bar.trade_date),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candlestickSeries.setData(chartData);

    if (hasInitialView && prevVisibleRange) {
      chart.timeScale().setVisibleRange(prevVisibleRange);
      return;
    }

    if (displayBars.length > 0) {
      const to = displayBars.length;
      const fallback = DEFAULT_VISIBLE_BARS[timeframe];
      if (fullscreen) {
        const view = fullscreenViewStateRef.current[timeframe];
        let barCount = clampInt(view?.barCount ?? fallback, 2, MAX_DAILY_BARS, fallback);
        const rightGap = Number.isFinite(view?.rightGap) ? Math.round(view!.rightGap) : 0;
        const maxBars = Math.max(2, to);
        if (barCount > maxBars) barCount = maxBars;
        let toIndex = to + rightGap;
        if (!Number.isFinite(toIndex)) toIndex = to;
        if (toIndex < barCount) toIndex = barCount;
        const fromIndex = toIndex - barCount;
        if (toIndex > fromIndex) {
          chart.timeScale().setVisibleLogicalRange({ from: fromIndex, to: toIndex });
          appliedInitialViewKeyRef.current = viewKey;
          return;
        }
      }
      const visibleBars = isPanel ? (panelVisibleBarsRef.current[timeframe] ?? fallback) : fallback;
      const from = Math.max(0, to - visibleBars);
      chart.timeScale().setVisibleLogicalRange({ from, to });
      appliedInitialViewKeyRef.current = viewKey;
    }
  }, [displayBars, fullscreen, isPanel, timeframe, tsCodeNormalized]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const threshold = timeframe === 'D' ? 50 : timeframe === 'M' ? 10 : 5;

    const onVisibleRangeChange = (range: LogicalRange | null) => {
      if (!range) return;
      if (fullscreen) {
        const visibleBars = visibleBarsFromLogicalRange(range);
        if (visibleBars !== null && displayBars.length > 0) {
          const fallback = DEFAULT_VISIBLE_BARS[timeframe];
          const barCount = clampInt(visibleBars, 2, MAX_DAILY_BARS, fallback);
          const toIndex = Number.isFinite(range.to) ? Math.round(range.to) : displayBars.length;
          const rightGap = toIndex - displayBars.length;
          fullscreenViewStateRef.current = {
            ...fullscreenViewStateRef.current,
            [timeframe]: { barCount, rightGap },
          };
          const now = Date.now();
          if (now - lastPersistFullscreenViewAtRef.current > 1000) {
            lastPersistFullscreenViewAtRef.current = now;
            persistFullscreenViewState(fullscreenViewStateRef.current);
          }
        }
      }
      if (isPanel) {
        const visibleBars = visibleBarsFromLogicalRange(range);
        if (visibleBars !== null) {
          panelVisibleBarsRef.current = {
            ...panelVisibleBarsRef.current,
            [timeframe]: clampInt(visibleBars, 5, MAX_DAILY_BARS, DEFAULT_VISIBLE_BARS[timeframe]),
          };
          const now = Date.now();
          if (now - lastPersistPanelVisibleBarsAtRef.current > 1000) {
            lastPersistPanelVisibleBarsAtRef.current = now;
            persistPanelVisibleBars(panelVisibleBarsRef.current);
          }
        }
      }
      if (!dailyQuery.hasNextPage) return;
      if (dailyQuery.isFetchingNextPage) return;
      if (fetchMoreInFlightRef.current) return;
      if (range.from > threshold) return;

      fetchMoreInFlightRef.current = true;
      void dailyQuery.fetchNextPage().finally(() => {
        fetchMoreInFlightRef.current = false;
      });
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
    };
  }, [
    dailyQuery.fetchNextPage,
    dailyQuery.hasNextPage,
    dailyQuery.isFetchingNextPage,
    displayBars.length,
    fullscreen,
    isPanel,
    timeframe,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (displayBars.length === 0) {
      if (volumeSeriesRef.current) {
        chart.removeSeries(volumeSeriesRef.current);
        volumeSeriesRef.current = null;
      }
      for (const s of kdjLineSeriesRefs.current) {
        chart.removeSeries(s);
      }
      kdjLineSeriesRefs.current = [];
      return;
    }

    const subPaneCount = (showVolume ? 1 : 0) + (showKdj ? 1 : 0);
    const mainAreaRatio = 1 - subPaneCount * SUB_PANE_HEIGHT;
    mainAreaRatioRef.current = mainAreaRatio;

    chart.applyOptions({
      rightPriceScale: {
        scaleMargins: {
          top: 0,
          bottom: subPaneCount * SUB_PANE_HEIGHT,
        },
      },
    });

    if (showVolume && !volumeSeriesRef.current) {
      volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
        color: '#6b7280',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });
    }

    if (volumeSeriesRef.current) {
      if (!showVolume) {
        chart.priceScale('volume').applyOptions({ visible: false });
        chart.removeSeries(volumeSeriesRef.current);
        volumeSeriesRef.current = null;
      } else {
        chart.priceScale('volume').applyOptions({
          visible: true,
          scaleMargins: {
            top: mainAreaRatio,
            bottom: showKdj ? SUB_PANE_HEIGHT : 0,
          },
        });
        const volumeData = displayBars.map((bar) => ({
          time: toIsoDate(bar.trade_date),
          value: bar.vol,
          color: bar.close >= bar.open ? '#ef4444' : '#22c55e',
        }));
        volumeSeriesRef.current.setData(volumeData);
      }
    }

    if (showKdj && kdjLineSeriesRefs.current.length === 0) {
      const colors = [KDJ_COLORS.k, KDJ_COLORS.d, KDJ_COLORS.j];
      for (const color of colors) {
        kdjLineSeriesRefs.current.push(
          chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            priceLineVisible: false,
            priceScaleId: 'kdj',
          })
        );
      }
      chart.priceScale('kdj').applyOptions({
        visible: true,
        scaleMargins: {
          top: 1 - SUB_PANE_HEIGHT,
          bottom: 0,
        },
      });
    }

    if (kdjLineSeriesRefs.current.length > 0) {
      if (!showKdj) {
        for (const s of kdjLineSeriesRefs.current) {
          chart.removeSeries(s);
        }
        kdjLineSeriesRefs.current = [];
      } else {
        chart.priceScale('kdj').applyOptions({
          visible: true,
          scaleMargins: {
            top: 1 - SUB_PANE_HEIGHT,
            bottom: 0,
          },
        });
        const { k, d, j } = calcKdj(displayBars);
        const linePoints = [k, d, j].map((arr) =>
          arr.map((v, i) =>
            v === null
              ? { time: toIsoDate(displayBars[i].trade_date) }
              : { time: toIsoDate(displayBars[i].trade_date), value: v }
          )
        );

        for (const [i, s] of kdjLineSeriesRefs.current.entries()) {
          s.setData(linePoints[i] as Array<LineData<Time> | WhitespaceData<Time>>);
        }
      }
    }
  }, [displayBars, showKdj, showVolume]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const clearIndicatorLines = () => {
      for (const s of indicatorLineSeriesRefs.current) {
        chart.removeSeries(s);
      }
      indicatorLineSeriesRefs.current = [];
    };

    if (displayBars.length === 0) {
      clearIndicatorLines();
      return;
    }

    if (
      selectedIndicatorId === null ||
      !indicatorSeriesData ||
      indicatorSeriesData.formula_id !== selectedIndicatorId
    ) {
      clearIndicatorLines();
      return;
    }

    clearIndicatorLines();

    const lines =
      indicatorSeriesData.lines && indicatorSeriesData.lines.length > 0
        ? indicatorSeriesData.lines
        : [{ name: indicatorSeriesData.name, points: indicatorSeriesData.points }];

    for (const [index, line] of lines.entries()) {
      const style = pickIndicatorLineStyle(lines, index);
      const s = chart.addSeries(LineSeries, {
        color: style.color,
        lineWidth: style.lineWidth,
        priceLineVisible: false,
      });

      const lineData = buildIndicatorLineData(displayBars, line.points);

      s.setData(lineData);
      indicatorLineSeriesRefs.current.push(s);
    }
  }, [displayBars, indicatorSeriesData, selectedIndicatorId]);

  if (!tsCodeNormalized) {
    return <div className="p-4 text-red-500">Invalid stock code</div>;
  }

  // Calculate change info
  const calcChange = (bar: DailyBar, prevBar: DailyBar | null) => {
    const change = prevBar ? bar.close - prevBar.close : 0;
    const changePercent = prevBar ? (change / prevBar.close) * 100 : 0;
    const isUp = change >= 0;
    return { change, changePercent, isUp };
  };

  return (
    <div className={isPanel ? 'space-y-4' : 'space-y-6'}>
      {/* Header */}
      {!isPanel && (
        <div className="flex items-center gap-4">
          <Link
            to="/stocks"
            className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Link>
        </div>
      )}

      {isPanel && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm text-gray-500">K线详情</div>
            <div className="truncate text-lg font-semibold text-gray-900">
              {data?.name ? `${data.name} (${tsCodeNormalized})` : tsCodeNormalized}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Link
              to={`/stocks/${encodeURIComponent(tsCodeNormalized)}?price_adjust=${encodeURIComponent(priceAdjust)}`}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
              title="在新页面打开"
            >
              <ExternalLink className="h-4 w-4" />
              打开
            </Link>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-50"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Title */}
      {!isPanel && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {data?.name ? `${data.name} (${tsCodeNormalized})` : tsCodeNormalized}
          </h1>
          {data && (
            <p className="mt-1 text-sm text-gray-500">
              已加载 {dailyBars.length} 条日线数据 · {TIMEFRAME_LABEL[timeframe]} {displayBars.length} 根 · 双击K线查看详情
              {dailyQuery.isFetchingNextPage
                ? ' · 历史数据加载中...'
                : dailyQuery.hasNextPage
                  ? ' · 向左滚动/缩放可继续加载'
                  : ''}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          加载失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--sf-primary-600)] border-t-transparent" />
        </div>
      )}

      {/* Chart */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setFullscreen(false)}
        />
      )}
      <div
        className={
          fullscreen
            ? 'fixed inset-2 z-50 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:inset-4'
            : 'overflow-hidden rounded-lg border border-gray-200 bg-white p-4'
        }
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="min-w-0 truncate text-lg font-semibold text-gray-900">
              {fullscreen ? stockLabel : 'K线图'}
            </h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {priceAdjustLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {fullscreen && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleWatchlist}
                  disabled={watchlistActionDisabled}
                  className={`inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 ${
                    isInDefaultWatchlist
                      ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title={watchlistActionTitle}
                >
                  {isInDefaultWatchlist ? (
                    <Trash2 className="h-4 w-4" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )}
                  {watchlistActionLabel}
                </button>
                {watchlistActionError && (
                  <span className="text-xs text-red-600" role="status" aria-live="polite">
                    {watchlistActionError}
                  </span>
                )}
              </div>
            )}
            {fullscreen && onNavigate && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">分组</span>
                <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => onNavigate('prev')}
                    disabled={!canNavigatePrev}
                    className="inline-flex h-9 items-center gap-1 px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    title="上一只（↑）"
                  >
                    <ChevronUp className="h-4 w-4" />
                    上一只
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('next')}
                    disabled={!canNavigateNext}
                    className="inline-flex h-9 items-center gap-1 border-l border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    title="下一只（↓）"
                  >
                    <ChevronDown className="h-4 w-4" />
                    下一只
                  </button>
                </div>
                {navigationLabel && <span className="text-xs text-gray-500">{navigationLabel}</span>}
              </div>
            )}
            <span className="text-sm text-gray-500">周期</span>
            <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
	              {(['D', 'M', 'Y'] as const).map((tf, idx) => (
	                <button
	                  key={tf}
	                  type="button"
	                  onClick={() => setTimeframe(tf)}
	                  className={`h-9 px-3 text-sm ${
	                    timeframe === tf
	                      ? 'bg-[color:var(--sf-primary-600)] text-white'
	                      : 'text-gray-700 hover:bg-gray-50'
	                  } ${idx ? 'border-l border-gray-300' : ''}`}
	                >
	                  {TIMEFRAME_LABEL[tf]}
	                </button>
	              ))}
            </div>
            {dailyQuery.isFetchingNextPage && (
              <span className="text-sm text-gray-400">历史加载中...</span>
            )}

            <span className="text-sm text-gray-500">指标</span>
            <select
              value={selectedIndicatorId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setIndicatorSelection(v ? Number(v) : 'none');
	              }}
	              disabled={!indicatorFormulasData?.formulas.length && !indicatorsLoading}
	              className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm shadow-sm focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)] disabled:bg-gray-100"
	            >
              <option value="">无</option>
              {(indicatorFormulasData?.formulas ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.timeframe ? ` (${f.timeframe})` : ''}
                </option>
              ))}
            </select>
            {indicatorSeriesLoading && <span className="text-sm text-gray-400">加载中...</span>}
            {indicatorSeriesError && selectedIndicatorId !== null && (
              <span className="text-sm text-red-600">
                {indicatorSeriesError instanceof Error
                  ? indicatorSeriesError.message
                  : '指标加载失败'}
              </span>
            )}
            {indicatorsError && (
              <span className="text-sm text-red-600">
                {indicatorsError instanceof Error ? indicatorsError.message : '指标公式加载失败'}
              </span>
            )}
            {!indicatorsLoading && (indicatorFormulasData?.formulas.length ?? 0) === 0 && (
              <Link to="/formulas" className="text-sm text-gray-500 hover:text-gray-700">
                去创建指标公式
              </Link>
            )}

            <span className="ml-2 text-sm text-gray-500">附图</span>
            <label className="inline-flex items-center gap-1 text-sm text-gray-700">
	                <input
	                  type="checkbox"
	                  checked={showVolume}
	                  onChange={(e) => setShowVolume(e.target.checked)}
	                  className="h-4 w-4 rounded border-gray-300 accent-[color:var(--sf-primary-600)] focus:ring-[color:var(--sf-primary-500)]"
	                />
	                成交量
	              </label>
            <label className="inline-flex items-center gap-1 text-sm text-gray-700">
	                <input
	                  type="checkbox"
	                  checked={showKdj}
	                  onChange={(e) => setShowKdj(e.target.checked)}
	                  className="h-4 w-4 rounded border-gray-300 accent-[color:var(--sf-primary-600)] focus:ring-[color:var(--sf-primary-500)]"
	                />
	                KDJ
	              </label>

            {showKdj && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500" aria-label="KDJ 图例">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: KDJ_COLORS.k }} />
                  K
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: KDJ_COLORS.d }} />
                  D
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: KDJ_COLORS.j }} />
                  J
                </span>
              </div>
            )}

            <span className="ml-2 text-sm text-gray-500">视图</span>
            <button
              type="button"
              onClick={() => {
                const chart = chartRef.current;
                if (!chart) return;
                const to = displayBars.length;
                if (!to) return;
                const range = chart.timeScale().getVisibleLogicalRange();
                const currentVisibleBars = visibleBarsFromLogicalRange(range);
                const fallback = DEFAULT_VISIBLE_BARS[timeframe];
                const visibleBars =
                  currentVisibleBars ??
                  (isPanel ? (panelVisibleBarsRef.current[timeframe] ?? fallback) : fallback);
                const from = Math.max(0, to - visibleBars);
                chart.timeScale().setVisibleLogicalRange({ from, to });
              }}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
              title="跳到最新（右侧）"
            >
              <SkipForward className="h-4 w-4" />
              最新
            </button>
            <button
              type="button"
              onClick={() => {
                const chart = chartRef.current;
                if (!chart) return;
                chart.timeScale().fitContent();
              }}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
              title="重置缩放/显示全部已加载数据"
            >
              <RotateCcw className="h-4 w-4" />
              重置
            </button>
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
              title={fullscreen ? '退出全屏（Esc）' : '全屏'}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {fullscreen ? '退出' : '全屏'}
            </button>
          </div>
        </div>

        {displayBars.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
            {(() => {
              const bar = hoverData?.bar ?? displayBars[displayBars.length - 1];
              const prev =
                hoverData?.prevBar ??
                (displayBars.length > 1 ? displayBars[displayBars.length - 2] : null);
              const { change, changePercent, isUp } = calcChange(bar, prev);
              const tone = isUp ? 'text-red-600' : 'text-green-600';
              return (
                <>
                  <span className="font-medium text-gray-900">{formatDate(bar.trade_date)}</span>
                  <span className={tone}>
                    收 {bar.close.toFixed(2)} ({isUp ? '+' : ''}
                    {change.toFixed(2)} / {isUp ? '+' : ''}
                    {changePercent.toFixed(2)}%)
                  </span>
                  <span className="text-gray-500">开 {bar.open.toFixed(2)}</span>
                  <span className="text-gray-500">高 {bar.high.toFixed(2)}</span>
                  <span className="text-gray-500">低 {bar.low.toFixed(2)}</span>
                  <span className="text-gray-500">量 {(bar.vol / 10000).toFixed(2)}万</span>
                  <span className="text-gray-500">额 {(bar.amount / 100000000).toFixed(2)}亿</span>
                  <span className="text-gray-400">（移动鼠标查看，双击弹窗）</span>
                </>
              );
            })()}
          </div>
        )}

        <div
          ref={chartContainerRef}
          className={fullscreen ? 'relative w-full flex-1' : 'relative w-full'}
          style={{ height: chartHeight }}
        >
	          {dailyQuery.isFetching && displayBars.length === 0 && (
	            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
	              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[color:var(--sf-primary-600)] border-t-transparent" />
	            </div>
	          )}
          {!dailyQuery.isFetching && displayBars.length === 0 && !error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-400">
              暂无数据
            </div>
          )}

          {/* Hover Tooltip */}
          {hoverData && (
            <div
              className="pointer-events-none absolute z-20 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
              style={{ left: hoverData.x, top: hoverData.y, minWidth: 180 }}
            >
              {(() => {
                const { bar, prevBar } = hoverData;
                const { change, changePercent, isUp } = calcChange(bar, prevBar);
                return (
                  <div className="space-y-1 text-sm">
                    <div className="font-medium text-gray-900">{formatDate(bar.trade_date)}</div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">收盘</span>
                      <span className={isUp ? 'text-red-600' : 'text-green-600'}>
                        {bar.close.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">涨跌</span>
                      <span className={isUp ? 'text-red-600' : 'text-green-600'}>
                        {isUp ? '+' : ''}
                        {change.toFixed(2)} ({isUp ? '+' : ''}
                        {changePercent.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">开盘</span>
                      <span>{bar.open.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">最高</span>
                      <span className="text-red-600">{bar.high.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">最低</span>
                      <span className="text-green-600">{bar.low.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">成交量</span>
                      <span>{(bar.vol / 10000).toFixed(2)}万</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {modalData && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
          onClick={() => setModalData(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-auto rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {formatDate(modalData.bar.trade_date)} 详情
              </h3>
              <button
                type="button"
                onClick={() => setModalData(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {(() => {
                const { bar, prevBar } = modalData;
                const { change, changePercent, isUp } = calcChange(bar, prevBar);
                const amplitude = ((bar.high - bar.low) / (prevBar?.close || bar.open)) * 100;

                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">开盘价</div>
                      <div className="text-xl font-medium">{bar.open.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">收盘价</div>
                      <div
                        className={`text-xl font-medium ${
                          isUp ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {bar.close.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">最高价</div>
                      <div className="text-xl font-medium text-red-600">
                        {bar.high.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">最低价</div>
                      <div className="text-xl font-medium text-green-600">
                        {bar.low.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">涨跌额</div>
                      <div
                        className={`text-xl font-medium ${
                          isUp ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {isUp ? '+' : ''}
                        {change.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">涨跌幅</div>
                      <div
                        className={`text-xl font-medium ${
                          isUp ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {isUp ? '+' : ''}
                        {changePercent.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">振幅</div>
                      <div className="text-xl font-medium">{amplitude.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">成交量</div>
                      <div className="text-xl font-medium">
                        {(bar.vol / 10000).toFixed(2)} 万手
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-gray-500">成交额</div>
                      <div className="text-xl font-medium">
                        {(bar.amount / 100000000).toFixed(2)} 亿元
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Latest Data */}
      {!fullscreen && dailyBars.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
            <h2 className="text-lg font-semibold text-gray-900">最新行情</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
            {(() => {
              const latest = dailyBars[dailyBars.length - 1];
              const prev = dailyBars.length > 1 ? dailyBars[dailyBars.length - 2] : null;
              const { change, changePercent, isUp } = calcChange(latest, prev);

              return (
                <>
                  <div>
                    <div className="text-sm text-gray-500">日期</div>
                    <div className="text-lg font-medium">{formatDate(latest.trade_date)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">收盘价</div>
                    <div
                      className={`text-lg font-medium ${
                        isUp ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {latest.close.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">涨跌额</div>
                    <div
                      className={`text-lg font-medium ${
                        isUp ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {isUp ? '+' : ''}
                      {change.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">涨跌幅</div>
                    <div
                      className={`text-lg font-medium ${
                        isUp ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {isUp ? '+' : ''}
                      {changePercent.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">开盘价</div>
                    <div className="text-lg font-medium">{latest.open.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">最高价</div>
                    <div className="text-lg font-medium text-red-600">
                      {latest.high.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">最低价</div>
                    <div className="text-lg font-medium text-green-600">
                      {latest.low.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">成交量</div>
                    <div className="text-lg font-medium">{(latest.vol / 10000).toFixed(2)} 万手</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

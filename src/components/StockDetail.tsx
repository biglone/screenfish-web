import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, X } from 'lucide-react';
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type LineData,
  type Time,
  type WhitespaceData,
} from 'lightweight-charts';
import api from '../api/client';
import type { DailyBar, IndicatorPoint } from '../types/api';
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

export function StockDetail({ tsCode, priceAdjust = 'qfq', variant = 'page', onClose }: StockDetailProps) {
  const tsCodeNormalized = tsCode.trim();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const indicatorLineSeriesRefs = useRef<Array<ISeriesApi<'Line'>>>([]);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const kdjLineSeriesRefs = useRef<Array<ISeriesApi<'Line'>>>([]);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [indicatorSelection, setIndicatorSelection] = useState<number | 'auto' | 'none'>('auto');
  const [timeframe, setTimeframe] = useState<KlineTimeframe>('D');
  const [showVolume, setShowVolume] = useState(true);
  const [showKdj, setShowKdj] = useState(true);
  const mainAreaRatioRef = useRef<number>(
    1 - ((showVolume ? 1 : 0) + (showKdj ? 1 : 0)) * SUB_PANE_HEIGHT
  );
  const lastClickTime = useRef<number>(0);
  const lastClickDate = useRef<string | null>(null);

  const isPanel = variant === 'panel';

  useEffect(() => {
    // When switching to a different stock in the panel view, reset to sensible defaults.
    setIndicatorSelection('auto');
    setTimeframe('D');
    setShowVolume(true);
    setShowKdj(true);
    setHoverData(null);
    setModalData(null);
  }, [tsCodeNormalized]);

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

  const { data: indicatorFormulasData, isLoading: indicatorsLoading } = useQuery({
    queryKey: ['formulas', 'indicator', 'enabled'],
    queryFn: () => api.listFormulas({ enabledOnly: true, kind: 'indicator' }),
  });

  const indicatorFormulas = indicatorFormulasData?.formulas ?? [];
  const defaultIndicatorId = indicatorFormulas[0]?.id ?? null;
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

      const chartHeight = CHART_HEIGHT;
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
      height: CHART_HEIGHT,
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
      const from = Math.max(0, to - DEFAULT_VISIBLE_BARS[timeframe]);
      chart.timeScale().setVisibleLogicalRange({ from, to });
      appliedInitialViewKeyRef.current = viewKey;
    }
  }, [displayBars, timeframe, tsCodeNormalized]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const threshold = timeframe === 'D' ? 50 : timeframe === 'M' ? 10 : 5;

    const onVisibleRangeChange = (range: LogicalRange | null) => {
      if (!range) return;
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
  }, [dailyQuery.fetchNextPage, dailyQuery.hasNextPage, dailyQuery.isFetchingNextPage, timeframe]);

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
      const colors = ['#f59e0b', '#3b82f6', '#ef4444'];
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

    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#a855f7', '#14b8a6'];

    for (const [index, line] of lines.entries()) {
      const s = chart.addSeries(LineSeries, {
        color: colors[index % colors.length],
        lineWidth: index === 0 ? 2 : 1,
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
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">K线图</h2>
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>
        <div ref={chartContainerRef} className="relative w-full" style={{ height: CHART_HEIGHT }}>
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
      {dailyBars.length > 0 && (
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

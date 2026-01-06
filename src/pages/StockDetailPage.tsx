import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, X } from 'lucide-react';
import { createChart, type IChartApi, type CandlestickData, type Time, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import api from '../api/client';
import type { DailyBar } from '../types/api';

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

function formatDate(yyyymmdd: string) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function toIsoDate(yyyymmdd: string): Time {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}` as Time;
}

export function StockDetailPage() {
  const { tsCode } = useParams<{ tsCode: string }>();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const lastClickTime = useRef<number>(0);
  const lastClickDate = useRef<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-daily', tsCode],
    queryFn: () => api.getStockDaily(tsCode!, { limit: 250 }),
    enabled: !!tsCode,
  });

  // Build a map for quick lookup
  const barsMap = useRef<Map<string, { bar: DailyBar; index: number }>>(new Map());

  const handleCrosshairMove = useCallback((param: { time?: Time; point?: { x: number; y: number } }) => {
    if (!param.time || !param.point || !chartContainerRef.current) {
      setHoverData(null);
      return;
    }

    // Only show tooltip in candlestick area (top 80%), hide in volume area (bottom 20%)
    const chartHeight = 500;
    if (param.point.y > chartHeight * 0.8) {
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
    const prevBar = index > 0 ? Array.from(barsMap.current.values())[index - 1]?.bar : null;

    // Get container bounds for tooltip positioning
    const rect = chartContainerRef.current.getBoundingClientRect();
    let x = param.point.x + 15;
    let y = param.point.y - 10;

    // Keep tooltip within bounds
    if (x + 200 > rect.width) x = param.point.x - 215;
    if (y < 0) y = 10;

    setHoverData({ bar, prevBar, x, y });
  }, []);

  const handleChartClick = useCallback((param: { time?: Time }) => {
    if (!param.time) return;

    const timeStr = String(param.time).replace(/-/g, '');
    const now = Date.now();

    // Detect double click (within 300ms and same date)
    if (lastClickDate.current === timeStr && now - lastClickTime.current < 300) {
      const entry = barsMap.current.get(timeStr);
      if (entry) {
        const { bar, index } = entry;
        const barsArray = Array.from(barsMap.current.values());
        const prevBar = index > 0 ? barsArray[index - 1]?.bar : null;
        setModalData({ bar, prevBar });
      }
      lastClickDate.current = null;
    } else {
      lastClickDate.current = timeStr;
    }
    lastClickTime.current = now;
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current || !data?.bars.length) return;

    // Build bars map
    barsMap.current.clear();
    data.bars.forEach((bar, index) => {
      barsMap.current.set(bar.trade_date, { bar, index });
    });

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
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

    // Add candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderDownColor: '#22c55e',
      borderUpColor: '#ef4444',
      wickDownColor: '#22c55e',
      wickUpColor: '#ef4444',
    });

    // Convert data to chart format
    const chartData: CandlestickData<Time>[] = data.bars.map((bar) => ({
      time: toIsoDate(bar.trade_date),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candlestickSeries.setData(chartData);

    // Add volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#6b7280',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const volumeData = data.bars.map((bar) => ({
      time: toIsoDate(bar.trade_date),
      value: bar.vol,
      color: bar.close >= bar.open ? '#ef4444' : '#22c55e',
    }));

    volumeSeries.setData(volumeData);

    // Subscribe to crosshair move for hover tooltip
    chart.subscribeCrosshairMove(handleCrosshairMove);

    // Subscribe to click for double-click detection
    chart.subscribeClick(handleChartClick);

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.unsubscribeCrosshairMove(handleCrosshairMove);
        chartRef.current.unsubscribeClick(handleChartClick);
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, handleCrosshairMove, handleChartClick]);

  if (!tsCode) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/stocks"
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {data?.name ? `${data.name} (${tsCode})` : tsCode}
        </h1>
        {data && (
          <p className="mt-1 text-sm text-gray-500">
            共 {data.bars.length} 条日线数据 · 双击K线查看详情
          </p>
        )}
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

      {/* Chart */}
      {data && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">K线图</h2>
          <div ref={chartContainerRef} className="relative w-full">
            {/* Hover Tooltip */}
            {hoverData && (
              <div
                className="pointer-events-none absolute z-10 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
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
                        <span className={isUp ? 'text-red-600' : 'text-green-600'}>{bar.close.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">涨跌</span>
                        <span className={isUp ? 'text-red-600' : 'text-green-600'}>
                          {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePercent.toFixed(2)}%)
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
      )}

      {/* Detail Modal */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalData(null)}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {formatDate(modalData.bar.trade_date)} 详情
              </h3>
              <button onClick={() => setModalData(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {(() => {
                const { bar, prevBar } = modalData;
                const { change, changePercent, isUp } = calcChange(bar, prevBar);
                const amplitude = ((bar.high - bar.low) / (prevBar?.close || bar.open) * 100);

                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">开盘价</div>
                      <div className="text-xl font-medium">{bar.open.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">收盘价</div>
                      <div className={`text-xl font-medium ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                        {bar.close.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">最高价</div>
                      <div className="text-xl font-medium text-red-600">{bar.high.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">最低价</div>
                      <div className="text-xl font-medium text-green-600">{bar.low.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">涨跌额</div>
                      <div className={`text-xl font-medium ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                        {isUp ? '+' : ''}{change.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">涨跌幅</div>
                      <div className={`text-xl font-medium ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                        {isUp ? '+' : ''}{changePercent.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">振幅</div>
                      <div className="text-xl font-medium">{amplitude.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">成交量</div>
                      <div className="text-xl font-medium">{(bar.vol / 10000).toFixed(2)} 万手</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-gray-500">成交额</div>
                      <div className="text-xl font-medium">{(bar.amount / 100000000).toFixed(2)} 亿元</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Latest Data */}
      {data && data.bars.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
            <h2 className="text-lg font-semibold text-gray-900">最新行情</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
            {(() => {
              const latest = data.bars[data.bars.length - 1];
              const prev = data.bars.length > 1 ? data.bars[data.bars.length - 2] : null;
              const { change, changePercent, isUp } = calcChange(latest, prev);

              return (
                <>
                  <div>
                    <div className="text-sm text-gray-500">日期</div>
                    <div className="text-lg font-medium">{formatDate(latest.trade_date)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">收盘价</div>
                    <div className={`text-lg font-medium ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                      {latest.close.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">涨跌额</div>
                    <div className={`text-lg font-medium ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                      {isUp ? '+' : ''}{change.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">涨跌幅</div>
                    <div className={`text-lg font-medium ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                      {isUp ? '+' : ''}{changePercent.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">开盘价</div>
                    <div className="text-lg font-medium">{latest.open.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">最高价</div>
                    <div className="text-lg font-medium text-red-600">{latest.high.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">最低价</div>
                    <div className="text-lg font-medium text-green-600">{latest.low.toFixed(2)}</div>
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

import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { createChart, type IChartApi, type CandlestickData, type Time, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import api from '../api/client';

export function StockDetailPage() {
  const { tsCode } = useParams<{ tsCode: string }>();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-daily', tsCode],
    queryFn: () => api.getStockDaily(tsCode!, { limit: 250 }),
    enabled: !!tsCode,
  });

  useEffect(() => {
    if (!chartContainerRef.current || !data?.bars.length) return;

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
      time: `${bar.trade_date.slice(0, 4)}-${bar.trade_date.slice(4, 6)}-${bar.trade_date.slice(6, 8)}` as Time,
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
      time: `${bar.trade_date.slice(0, 4)}-${bar.trade_date.slice(4, 6)}-${bar.trade_date.slice(6, 8)}` as Time,
      value: bar.vol,
      color: bar.close >= bar.open ? '#ef4444' : '#22c55e',
    }));

    volumeSeries.setData(volumeData);

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
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data]);

  if (!tsCode) {
    return <div className="p-4 text-red-500">Invalid stock code</div>;
  }

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
            共 {data.bars.length} 条日线数据
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
          <div ref={chartContainerRef} className="w-full" />
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
              const change = prev ? latest.close - prev.close : 0;
              const changePercent = prev ? (change / prev.close) * 100 : 0;
              const isUp = change >= 0;

              return (
                <>
                  <div>
                    <div className="text-sm text-gray-500">日期</div>
                    <div className="text-lg font-medium">
                      {`${latest.trade_date.slice(0, 4)}-${latest.trade_date.slice(4, 6)}-${latest.trade_date.slice(6, 8)}`}
                    </div>
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
                    <div className="text-lg font-medium">
                      {(latest.vol / 10000).toFixed(2)} 万手
                    </div>
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

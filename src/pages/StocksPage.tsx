import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client';
import { usePriceAdjust } from '../hooks/usePriceAdjust';

const PAGE_SIZE = 50;

const preloadStockDetailPage = () => import('./StockDetailPage');

export function StocksPage() {
  const [priceAdjust] = usePriceAdjust();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);

  const stockDetailQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('from', 'stocks');
    params.set('price_adjust', priceAdjust);
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [page, priceAdjust, search]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['stocks', search, page],
    queryFn: () =>
      api.listStocks({
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">股票列表</h1>
        <span className="text-sm text-gray-500">
          共 {data?.total ?? 0} 只股票
        </span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
	          <input
	            type="text"
	            value={searchInput}
	            onChange={(e) => setSearchInput(e.target.value)}
	            placeholder="搜索股票代码/名称/拼音首字母..."
	            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-[color:var(--sf-primary-500)] focus:outline-none focus:ring-1 focus:ring-[color:var(--sf-primary-500)]"
	          />
        </div>
	        <button
	          type="submit"
	          disabled={isFetching}
	          className="w-full rounded-lg bg-[color:var(--sf-primary-600)] px-4 py-2 text-white hover:bg-[color:var(--sf-primary-700)] sm:w-auto"
	        >
          {isFetching ? '搜索中...' : '搜索'}
        </button>
      </form>

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

      {/* Stock List */}
      {data && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* Mobile cards */}
	          <ul className="divide-y divide-gray-200 sm:hidden">
	            {data.stocks.map((stock) => (
	              <li key={stock.ts_code} className="px-4 py-3">
	                <div className="flex items-center justify-between gap-3">
	                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {stock.name || '-'}
                    </div>
                    <div className="mt-1 font-mono text-xs text-gray-500">{stock.ts_code}</div>
	                  </div>
		                  <Link
		                    to={`/stocks/${encodeURIComponent(stock.ts_code)}${stockDetailQuery}`}
		                    className="flex-shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-[color:var(--sf-primary-600)] hover:bg-gray-50 hover:text-[color:var(--sf-primary-800)]"
		                  >
	                    查看
	                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-[640px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    名称
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    代码
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data.stocks.map((stock) => (
                  <tr key={stock.ts_code} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {stock.name || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="font-mono text-sm text-gray-500">
                        {stock.ts_code}
                      </span>
                    </td>
	                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
		                    <Link
		                        to={`/stocks/${encodeURIComponent(stock.ts_code)}${stockDetailQuery}`}
		                        className="text-[color:var(--sf-primary-600)] hover:text-[color:var(--sf-primary-800)]"
		                        onMouseEnter={() => {
		                          void preloadStockDetailPage();
		                        }}
		                      >
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="text-sm text-gray-500">
                第 {page + 1} / {totalPages} 页
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex flex-1 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="inline-flex flex-1 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {data && data.stocks.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          {search ? `没有找到匹配 "${search}" 的股票` : '暂无股票数据'}
        </div>
      )}
    </div>
  );
}

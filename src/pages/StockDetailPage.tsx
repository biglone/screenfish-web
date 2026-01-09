import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { StockDetail } from '../components/StockDetail';
import api from '../api/client';

export function StockDetailPage() {
  const { tsCode } = useParams<{ tsCode: string }>();
  if (!tsCode) return <div className="p-4 text-red-500">Invalid stock code</div>;

  const navigate = useNavigate();
  const location = useLocation();
  const tsCodeNormalized = tsCode.trim();

  const stocksContext = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('from') !== 'stocks') return null;
    const search = (params.get('search') ?? '').trim();
    const pageRaw = parseInt(params.get('page') ?? '0', 10);
    const limitRaw = parseInt(params.get('limit') ?? '50', 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 0;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(1000, limitRaw) : 50;
    return { search, page, limit };
  }, [location.search]);

  const listQuery = useQuery({
    queryKey: [
      'stocks',
      'context',
      stocksContext?.search ?? '',
      stocksContext?.page ?? 0,
      stocksContext?.limit ?? 0,
    ],
    queryFn: () =>
      api.listStocks({
        search: stocksContext!.search || undefined,
        limit: stocksContext!.limit,
        offset: stocksContext!.page * stocksContext!.limit,
      }),
    enabled: stocksContext !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
  });

  const siblingTsCodes = useMemo(() => {
    return listQuery.data?.stocks.map((s) => s.ts_code) ?? [];
  }, [listQuery.data?.stocks]);

  const siblings = useMemo(() => {
    if (!stocksContext) return { prev: null as string | null, next: null as string | null };
    const idx = siblingTsCodes.indexOf(tsCodeNormalized);
    if (idx === -1) return { prev: null, next: null };
    return {
      prev: idx > 0 ? siblingTsCodes[idx - 1] : null,
      next: idx + 1 < siblingTsCodes.length ? siblingTsCodes[idx + 1] : null,
    };
  }, [siblingTsCodes, stocksContext, tsCodeNormalized]);

  useEffect(() => {
    if (!stocksContext) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

      if (e.key === 'ArrowUp' && siblings.prev) {
        navigate(
          { pathname: `/stocks/${encodeURIComponent(siblings.prev)}`, search: location.search },
          { replace: true }
        );
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowDown' && siblings.next) {
        navigate(
          { pathname: `/stocks/${encodeURIComponent(siblings.next)}`, search: location.search },
          { replace: true }
        );
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [location.search, navigate, siblings.next, siblings.prev, stocksContext]);

  return <StockDetail tsCode={tsCodeNormalized} variant="page" />;
}

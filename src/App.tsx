import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );
}

const DashboardPage = lazy(async () => {
  const mod = await import('./pages/DashboardPage');
  return { default: mod.DashboardPage };
});
const StocksPage = lazy(async () => {
  const mod = await import('./pages/StocksPage');
  return { default: mod.StocksPage };
});
const WatchlistPage = lazy(async () => {
  const mod = await import('./pages/WatchlistPage');
  return { default: mod.WatchlistPage };
});
const StockDetailPage = lazy(async () => {
  const mod = await import('./pages/StockDetailPage');
  return { default: mod.StockDetailPage };
});
const FormulasPage = lazy(async () => {
  const mod = await import('./pages/FormulasPage');
  return { default: mod.FormulasPage };
});
const ScreenPage = lazy(async () => {
  const mod = await import('./pages/ScreenPage');
  return { default: mod.ScreenPage };
});
const UpdatePage = lazy(async () => {
  const mod = await import('./pages/UpdatePage');
  return { default: mod.UpdatePage };
});
const LogsPage = lazy(async () => {
  const mod = await import('./pages/LogsPage');
  return { default: mod.LogsPage };
});
const AuthPage = lazy(async () => {
  const mod = await import('./pages/AuthPage');
  return { default: mod.AuthPage };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/auth"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AuthPage />
              </Suspense>
            }
          />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="stocks" element={<StocksPage />} />
            <Route path="stocks/:tsCode" element={<StockDetailPage />} />
            <Route path="watchlist" element={<WatchlistPage />} />
            <Route path="formulas" element={<FormulasPage />} />
            <Route path="screen" element={<ScreenPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="update" element={<UpdatePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

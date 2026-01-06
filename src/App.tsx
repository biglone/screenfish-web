import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ScreenPage } from './pages/ScreenPage';
import { UpdatePage } from './pages/UpdatePage';
import { StocksPage } from './pages/StocksPage';
import { StockDetailPage } from './pages/StockDetailPage';

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
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="stocks" element={<StocksPage />} />
            <Route path="stocks/:tsCode" element={<StockDetailPage />} />
            <Route path="screen" element={<ScreenPage />} />
            <Route path="update" element={<UpdatePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

import { useParams } from 'react-router-dom';
import { StockDetail } from '../components/StockDetail';

export function StockDetailPage() {
  const { tsCode } = useParams<{ tsCode: string }>();
  if (!tsCode) return <div className="p-4 text-red-500">Invalid stock code</div>;
  return <StockDetail tsCode={tsCode} variant="page" />;
}

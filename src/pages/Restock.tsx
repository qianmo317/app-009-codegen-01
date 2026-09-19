import { useNavigate } from 'react-router-dom';
import QuoteForm from '../components/restock/QuoteForm';
import ComparePanel from '../components/restock/ComparePanel';
import QuoteTable from '../components/restock/QuoteTable';
import OrderList from '../components/restock/OrderList';
import { btnGhost } from '../components/restock/styles';

export default function Restock() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ef' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          background: '#fff',
          borderBottom: '1px solid #e0dcd5',
        }}
      >
        <button onClick={() => navigate('/')} style={btnGhost}>
          ← 返回
        </button>
        <h1 style={{ fontSize: 18, margin: 0 }}>毛线比价本</h1>
        <span style={{ fontSize: 12, color: '#888' }}>
          记报价 · 比总价 · 出在途单 · 登记到货与短装
        </span>
      </header>
      <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
        <QuoteForm />
        <ComparePanel />
        <QuoteTable />
        <OrderList />
      </main>
    </div>
  );
}

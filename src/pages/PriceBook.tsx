import { useState } from 'react';
import { Link } from 'react-router-dom';
import OrdersPanel from '../components/pricebook/OrdersPanel';
import QuotesPanel from '../components/pricebook/QuotesPanel';
import RestockPanel from '../components/pricebook/RestockPanel';
import ShopsPanel from '../components/pricebook/ShopsPanel';
import { colors } from '../components/pricebook/styles';
import { usePriceBookStore } from '../store/priceBookStore';
import { isOrderOpen } from '../utils/priceBook';

type TabKey = 'restock' | 'quotes' | 'shops' | 'orders';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'restock', label: '补货比价' },
  { key: 'quotes', label: '色号与报价' },
  { key: 'shops', label: '店铺' },
  { key: 'orders', label: '订单' },
];

export default function PriceBook() {
  const [tab, setTab] = useState<TabKey>('restock');
  const openOrderCount = usePriceBookStore((s) => s.orders.filter(isOrderOpen).length);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <Link to="/" style={{ color: colors.accent, textDecoration: 'none', fontSize: 14 }}>← 我的图解</Link>
        <h1 style={{ fontSize: 22, margin: 0 }}>毛线比价本</h1>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${colors.border}` }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: tab === t.key ? colors.accent : '#555',
              borderBottom: tab === t.key ? `2px solid ${colors.accent}` : '2px solid transparent',
              fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
            {t.key === 'orders' && openOrderCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: colors.accent,
                  color: '#fff',
                  borderRadius: 8,
                  padding: '0 6px',
                  fontSize: 11,
                }}
              >
                {openOrderCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'restock' && <RestockPanel onGoOrders={() => setTab('orders')} />}
      {tab === 'quotes' && <QuotesPanel />}
      {tab === 'shops' && <ShopsPanel />}
      {tab === 'orders' && <OrdersPanel />}
    </div>
  );
}

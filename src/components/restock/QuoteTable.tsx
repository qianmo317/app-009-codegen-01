import { useMemo } from 'react';
import { useRestockStore } from '../../store/restockStore';
import type { Quote } from '../../types/restock';
import { DAY_MS, isQuoteValid, quoteExpireAt } from '../../utils/restockPlan';
import { fmtDateTime } from '../../utils/format';
import { badge, btnDanger, section, sectionTitle, table, td, th } from './styles';
import { useNow } from './useNow';

type RowState = 'current' | 'history' | 'expired';

function rowState(q: Quote, all: Quote[], now: number): RowState {
  const newerSameShop = all.some(
    (o) => o.colorCode === q.colorCode && o.shopName === q.shopName && o.quotedAt > q.quotedAt,
  );
  if (newerSameShop) return 'history';
  return isQuoteValid(q, now) ? 'current' : 'expired';
}

export default function QuoteTable() {
  const quotes = useRestockStore((s) => s.quotes);
  const deleteQuote = useRestockStore((s) => s.deleteQuote);
  const now = useNow();

  const byColor = useMemo(() => {
    const map = new Map<string, Quote[]>();
    for (const q of quotes) {
      const list = map.get(q.colorCode) ?? [];
      list.push(q);
      map.set(q.colorCode, list);
    }
    for (const list of map.values()) list.sort((a, b) => b.quotedAt - a.quotedAt);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [quotes]);

  if (quotes.length === 0) {
    return (
      <div style={section}>
        <h3 style={sectionTitle}>报价本</h3>
        <div style={{ fontSize: 12, color: '#888' }}>还没有报价，先在上方记一笔。</div>
      </div>
    );
  }

  return (
    <div style={section}>
      <h3 style={sectionTitle}>报价本</h3>
      {byColor.map(([colorCode, list]) => (
        <div key={colorCode} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            色号 {colorCode}
            <span style={{ marginLeft: 8, fontSize: 11, color: '#888', fontWeight: 400 }}>
              {new Set(list.map((q) => q.shopName)).size} 家店报过价
            </span>
          </div>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>店家</th>
                <th style={th}>单价</th>
                <th style={th}>起订</th>
                <th style={th}>运费</th>
                <th style={th}>到货</th>
                <th style={th}>可供</th>
                <th style={th}>报价时间</th>
                <th style={th}>状态</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((q) => {
                const state = rowState(q, quotes, now);
                const stale = state !== 'current';
                const daysLeft = Math.ceil((quoteExpireAt(q) - now) / DAY_MS);
                return (
                  <tr key={q.id} style={stale ? { color: '#aaa' } : undefined}>
                    <td style={td}>{q.shopName}</td>
                    <td style={td}>¥{q.pricePerSkein}/团</td>
                    <td style={td}>{q.minOrder} 团起</td>
                    <td style={td}>{q.shippingFee > 0 ? `¥${q.shippingFee}` : '包邮'}</td>
                    <td style={td}>{q.deliveryDays} 天</td>
                    <td style={td}>{q.availableQty == null ? '不限' : `${q.availableQty} 团`}</td>
                    <td style={td}>{fmtDateTime(q.quotedAt)}</td>
                    <td style={td}>
                      {state === 'current' && (
                        <span style={badge('#27ae60')}>有效 · {daysLeft} 天后过期</span>
                      )}
                      {state === 'expired' && <span style={badge('#95a5a6')}>已过期</span>}
                      {state === 'history' && <span style={badge('#bdc3c7')}>历史报价</span>}
                    </td>
                    <td style={td}>
                      <button onClick={() => deleteQuote(q.id)} style={btnDanger}>
                        删
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

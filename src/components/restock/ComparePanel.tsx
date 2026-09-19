import { useMemo, useState } from 'react';
import { useRestockStore } from '../../store/restockStore';
import { isOpenOrder, planRestock } from '../../utils/restockPlan';
import { badge, btnPrimary, input, section, sectionTitle, table, td, th } from './styles';
import { useNow } from './useNow';

export default function ComparePanel() {
  const quotes = useRestockStore((s) => s.quotes);
  const orders = useRestockStore((s) => s.orders);
  const createOrdersFromPlan = useRestockStore((s) => s.createOrdersFromPlan);
  const [colorCode, setColorCode] = useState('');
  const [needQty, setNeedQty] = useState(6);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const colorOptions = useMemo(
    () => [...new Set(quotes.map((q) => q.colorCode))].sort(),
    [quotes],
  );

  const color = colorCode.trim();
  const now = useNow();
  const result = useMemo(() => {
    if (!color) return null;
    const blocked = new Set(
      orders.filter((o) => o.colorCode === color && isOpenOrder(o)).map((o) => o.shopName),
    );
    return planRestock(quotes, color, needQty, blocked, now);
  }, [quotes, orders, color, needQty, now]);

  const submit = () => {
    if (!result?.plan) return;
    const r = createOrdersFromPlan(result.plan.lines);
    setMessage(
      r.ok
        ? { ok: true, text: `已出 ${result.plan.lines.length} 张采购单，在下方「采购单」里跟踪到货` }
        : { ok: false, text: r.error ?? '出单失败' },
    );
  };

  return (
    <div style={section}>
      <h3 style={sectionTitle}>补货比价</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#888' }}>
          要补的色号
          <input
            list="restock-colors"
            value={colorCode}
            onChange={(e) => {
              setColorCode(e.target.value);
              setMessage(null);
            }}
            placeholder="如 804"
            style={{ ...input, width: 110 }}
          />
          <datalist id="restock-colors">
            {colorOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#888' }}>
          需要(团)
          <input
            type="number"
            min={1}
            value={needQty}
            onChange={(e) => setNeedQty(Math.max(1, Number(e.target.value) || 1))}
            style={{ ...input, width: 70 }}
          />
        </label>
      </div>

      {color && result && result.ranking.length === 0 && (
        <div style={{ fontSize: 12, color: '#888' }}>这个色号还没有有效报价（或都已过期）。</div>
      )}

      {result && result.ranking.length > 0 && (
        <>
          <table style={{ ...table, marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={th}>排名</th>
                <th style={th}>店家</th>
                <th style={th}>单价</th>
                <th style={th}>下单团数</th>
                <th style={th}>运费</th>
                <th style={th}>总价(含运费)</th>
                <th style={th}>到货</th>
                <th style={th}>备注</th>
              </tr>
            </thead>
            <tbody>
              {result.ranking.map((row, i) => (
                <tr key={row.quote.id} style={row.blocked ? { color: '#aaa' } : undefined}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{row.quote.shopName}</td>
                  <td style={td}>¥{row.quote.pricePerSkein}/团</td>
                  <td style={td}>{row.qty} 团</td>
                  <td style={td}>{row.quote.shippingFee > 0 ? `¥${row.quote.shippingFee}` : '包邮'}</td>
                  <td style={{ ...td, fontWeight: 600 }}>¥{row.total}</td>
                  <td style={td}>{row.quote.deliveryDays} 天</td>
                  <td style={td}>
                    {row.note ? (
                      <span style={badge(row.blocked ? '#95a5a6' : '#e67e22')}>{row.note}</span>
                    ) : (
                      <span style={badge('#27ae60')}>一家可买齐</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.plan?.mode === 'single' && (
            <div style={{ fontSize: 13, background: '#f0f9f4', border: '1px solid #bfe3cf', borderRadius: 6, padding: 10, marginBottom: 8 }}>
              一家买齐：在「{result.plan.lines[0].quote.shopName}」下 {result.plan.lines[0].qty} 团，
              货款 ¥{result.plan.lines[0].goods} + 运费 ¥{result.plan.lines[0].quote.shippingFee}，
              合计 <b>¥{result.plan.lines[0].total}</b>，约 {result.plan.lines[0].quote.deliveryDays} 天到。
            </div>
          )}
          {result.plan?.mode === 'split' && (
            <div style={{ fontSize: 13, background: '#fdf6ec', border: '1px solid #f0dcb8', borderRadius: 6, padding: 10, marginBottom: 8 }}>
              一家买不齐，拆两家最省钱：
              「{result.plan.lines[0].quote.shopName}」{result.plan.lines[0].qty} 团（¥{result.plan.lines[0].total}）
              ＋「{result.plan.lines[1].quote.shopName}」{result.plan.lines[1].qty} 团（¥{result.plan.lines[1].total}），
              合计 <b>¥{result.plan.lines[0].total + result.plan.lines[1].total}</b>。
            </div>
          )}
          {!result.plan && (
            <div style={{ fontSize: 13, background: '#fdf0ef', border: '1px solid #f0c4c0', borderRadius: 6, padding: 10, marginBottom: 8 }}>
              凑不齐 {needQty} 团：有效报价不够，或各家现货加起来也不够（也可能都已有在途单）。
            </div>
          )}

          {result.plan && (
            <button onClick={submit} style={btnPrimary}>
              按此方案出采购单
            </button>
          )}
          {message && (
            <span style={{ marginLeft: 10, fontSize: 12, color: message.ok ? '#27ae60' : '#e74c3c' }}>
              {message.text}
            </span>
          )}
        </>
      )}
    </div>
  );
}

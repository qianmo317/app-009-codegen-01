import { useState } from 'react';
import { usePriceBookStore } from '../../store/priceBookStore';
import type { PurchaseOrder, Receipt } from '../../types/priceBook';
import { isOrderOpen, orderOutstandingQty, orderReceivedQty, orderShortageQty } from '../../utils/priceBook';
import { btnStyle, cardStyle, colors, fmtDate, fmtDateTime, fmtMoney, inputStyle } from './styles';
import { ColorLabel, Tag } from './ui';

function statusTag(order: PurchaseOrder) {
  switch (order.status) {
    case 'in_transit':
      return <Tag color="blue">在途</Tag>;
    case 'awaiting_reship':
      return <Tag color="orange">等补发</Tag>;
    case 'completed':
      return <Tag color="green">已完成</Tag>;
    case 'cancelled':
      return <Tag color="gray">已取消</Tag>;
  }
}

/** 改单控件：把一条收货记录改到同色号另一张在途单上 */
function MoveReceiptControl({ receipt, currentOrder }: { receipt: Receipt; currentOrder: PurchaseOrder }) {
  const orders = usePriceBookStore((s) => s.orders);
  const shops = usePriceBookStore((s) => s.shops);
  const moveReceipt = usePriceBookStore((s) => s.moveReceipt);
  const [targetId, setTargetId] = useState('');
  const [error, setError] = useState('');

  const candidates = orders.filter((o) => o.id !== currentOrder.id && o.colorId === currentOrder.colorId && isOrderOpen(o));
  if (candidates.length === 0) return null;

  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <select style={{ ...inputStyle, fontSize: 12, padding: '2px 4px' }} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
        <option value="">改到…</option>
        {candidates.map((o) => (
          <option key={o.id} value={o.id}>
            {shops.find((s) => s.id === o.shopId)?.name ?? '?'} · {fmtDate(o.createdAt)} 的单
          </option>
        ))}
      </select>
      <button
        style={{ ...btnStyle('outline'), fontSize: 12, padding: '2px 8px' }}
        onClick={() => {
          if (!targetId) return;
          const err = moveReceipt(receipt.id, targetId);
          setError(err ?? '');
          if (!err) setTargetId('');
        }}
      >
        改单
      </button>
      {error && <span style={{ color: colors.danger, fontSize: 12 }}>{error}</span>}
    </span>
  );
}

function OrderCard({ order }: { order: PurchaseOrder }) {
  const shops = usePriceBookStore((s) => s.shops);
  const colorList = usePriceBookStore((s) => s.colors);
  const receipts = usePriceBookStore((s) => s.receipts);
  const addReceipt = usePriceBookStore((s) => s.addReceipt);
  const resolveShortage = usePriceBookStore((s) => s.resolveShortage);
  const cancelOrder = usePriceBookStore((s) => s.cancelOrder);

  const [recvQty, setRecvQty] = useState('');
  const [error, setError] = useState('');

  const shop = shops.find((s) => s.id === order.shopId);
  const color = colorList.find((c) => c.id === order.colorId);
  const orderReceipts = receipts.filter((r) => r.orderId === order.id).sort((a, b) => a.receivedAt - b.receivedAt);
  const received = orderReceivedQty(order.id, receipts);
  const shortage = orderShortageQty(order, receipts);
  const outstanding = orderOutstandingQty(order, receipts);
  const open = isOrderOpen(order);
  // 有待处理的短装决定：已到货过、仍欠货、且还没选补发
  const needsDecision = open && outstanding > 0 && orderReceipts.length > 0 && order.shortageDecision !== 'reship';

  const submitReceipt = () => {
    const qty = Number(recvQty);
    const err = addReceipt(order.id, qty);
    setError(err ?? '');
    if (!err) setRecvQty('');
  };

  return (
    <div style={{ ...cardStyle, border: `1px solid ${open ? colors.accent : colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15 }}>
          <b>{shop?.name ?? '?'}</b>
          <span style={{ margin: '0 8px', color: colors.muted }}>|</span>
          {color ? <ColorLabel color={color} /> : '?'}
          <span style={{ marginLeft: 10 }}>{statusTag(order)}</span>
        </div>
        <div style={{ fontSize: 12, color: colors.muted }}>
          {fmtDateTime(order.createdAt)} 下单 · 预计 {order.deliveryDays} 天到
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>订购 <b>{order.qty}</b> 团 × {fmtMoney(order.unitPrice)}</span>
        <span>运费 {order.shippingFee === 0 ? '包邮' : fmtMoney(order.shippingFee)}</span>
        <span>合计 <b>{fmtMoney(order.totalAmount)}</b></span>
        <span>已收 <b>{received}</b> 团</span>
        {shortage > 0 && (
          <span style={{ color: colors.warn }}>
            短装 <b>{shortage}</b> 团{order.writtenOffQty > 0 ? `（已划掉 ${order.writtenOffQty}）` : ''}
          </span>
        )}
      </div>

      {/* 到货登记 */}
      {open && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, width: 100 }}
            type="number"
            min={1}
            step={1}
            placeholder={`实收团数`}
            value={recvQty}
            onChange={(e) => setRecvQty(e.target.value)}
          />
          <button style={btnStyle('primary')} onClick={submitReceipt}>
            {order.status === 'awaiting_reship' ? '登记补发到货' : '登记到货'}
          </button>
          {outstanding > 0 && (
            <button style={btnStyle('ghost')} onClick={() => setRecvQty(String(outstanding))}>
              填入待收 {outstanding} 团
            </button>
          )}
          {error && <span style={{ color: colors.danger, fontSize: 13 }}>{error}</span>}
        </div>
      )}

      {/* 短装处理 */}
      {needsDecision && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: '#fdf2e9', borderRadius: 6, fontSize: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: colors.warn }}>短装 {outstanding} 团，怎么处理？</span>
          <button style={{ ...btnStyle('outline'), borderColor: colors.warn, color: colors.warn }} onClick={() => setError(resolveShortage(order.id, 'reship') ?? '')}>
            让店家补发
          </button>
          <button style={{ ...btnStyle('outline') }} onClick={() => setError(resolveShortage(order.id, 'writeoff') ?? '')}>
            从单里划掉
          </button>
        </div>
      )}
      {order.status === 'awaiting_reship' && outstanding > 0 && (
        <div style={{ marginTop: 10, fontSize: 13, color: colors.muted, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>补发中，还差 {outstanding} 团。</span>
          <button style={{ ...btnStyle('ghost'), fontSize: 13 }} onClick={() => setError(resolveShortage(order.id, 'writeoff') ?? '')}>
            不等了，划掉
          </button>
        </div>
      )}

      {/* 收货记录 */}
      {orderReceipts.length > 0 && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${colors.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>收货记录：</div>
          {orderReceipts.map((r) => (
            <div key={r.id} style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', padding: '3px 0', flexWrap: 'wrap' }}>
              <span>{fmtDateTime(r.receivedAt)}</span>
              <span>实收 <b>{r.qty}</b> 团</span>
              {r.kind === 'reship' && <Tag color="orange">补发</Tag>}
              {open && <MoveReceiptControl receipt={r} currentOrder={order} />}
            </div>
          ))}
        </div>
      )}

      {/* 取消 */}
      {open && orderReceipts.length === 0 && (
        <div style={{ marginTop: 10 }}>
          <button style={{ ...btnStyle('danger'), fontSize: 12 }} onClick={() => setError(cancelOrder(order.id) ?? '')}>
            取消订单
          </button>
        </div>
      )}
    </div>
  );
}

export default function OrdersPanel() {
  const orders = usePriceBookStore((s) => s.orders);
  const shops = usePriceBookStore((s) => s.shops);
  const colorList = usePriceBookStore((s) => s.colors);
  const receipts = usePriceBookStore((s) => s.receipts);

  const openOrders = orders.filter(isOrderOpen).sort((a, b) => b.createdAt - a.createdAt);
  const historyOrders = orders.filter((o) => !isOrderOpen(o)).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>在途订单（{openOrders.length}）</h3>
        {openOrders.length === 0 ? (
          <div style={{ ...cardStyle, color: colors.muted, fontSize: 14 }}>没有在途单。到「补货比价」页比价开单。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {openOrders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>历史订单（{historyOrders.length}）</h3>
        {historyOrders.length === 0 ? (
          <div style={{ ...cardStyle, color: colors.muted, fontSize: 14 }}>暂无。</div>
        ) : (
          <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `2px solid ${colors.border}`, fontSize: 13, color: colors.muted }}>店铺</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `2px solid ${colors.border}`, fontSize: 13, color: colors.muted }}>色号</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `2px solid ${colors.border}`, fontSize: 13, color: colors.muted }}>订购</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `2px solid ${colors.border}`, fontSize: 13, color: colors.muted }}>实收</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `2px solid ${colors.border}`, fontSize: 13, color: colors.muted }}>划掉</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `2px solid ${colors.border}`, fontSize: 13, color: colors.muted }}>合计</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `2px solid ${colors.border}`, fontSize: 13, color: colors.muted }}>下单时间</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: `2px solid ${colors.border}`, fontSize: 13, color: colors.muted }}>状态</th>
                </tr>
              </thead>
              <tbody>
                {historyOrders.map((o) => {
                  const shop = shops.find((s) => s.id === o.shopId);
                  const color = colorList.find((c) => c.id === o.colorId);
                  const received = orderReceivedQty(o.id, receipts);
                  return (
                    <tr key={o.id}>
                      <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`, fontSize: 14 }}>{shop?.name ?? '?'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`, fontSize: 14 }}>{color ? <ColorLabel color={color} /> : '?'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`, fontSize: 14 }}>{o.qty} 团</td>
                      <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`, fontSize: 14 }}>{received} 团</td>
                      <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`, fontSize: 14 }}>{o.writtenOffQty > 0 ? `${o.writtenOffQty} 团` : '—'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`, fontSize: 14 }}>{fmtMoney(o.totalAmount)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`, fontSize: 14 }}>{fmtDateTime(o.createdAt)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: `1px solid ${colors.border}`, fontSize: 14 }}>{statusTag(o)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

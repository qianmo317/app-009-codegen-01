import { useState } from 'react';
import { useRestockStore } from '../../store/restockStore';
import type { OrderEvent, PurchaseOrder } from '../../types/restock';
import {
  DAY_MS,
  isOpenOrder,
  orderReceived,
  orderRemaining,
  orderStatus,
  orderWrittenOff,
} from '../../utils/restockPlan';
import { fmtDate, fmtDateTime } from '../../utils/format';
import { badge, btnDanger, btnGhost, btnPrimary, input, section, sectionTitle } from './styles';

const STATUS_LABEL = { in_transit: '在途', partial: '部分到货', done: '已了结' } as const;
const STATUS_COLOR = { in_transit: '#e67e22', partial: '#3498db', done: '#27ae60' } as const;

function eventText(e: OrderEvent): string {
  switch (e.type) {
    case 'receive':
      return `到货登记：实收 ${e.qty} 团`;
    case 'writeoff':
      return `短装划掉 ${e.qty} 团，不再补发`;
    case 'move_out':
      return `改单：${e.qty} 团${e.note ? `（${e.note}）` : ''}`;
    case 'move_in':
      return `改单入：${e.qty} 团${e.note ? `（${e.note}）` : ''}`;
  }
}

function OrderCard({ order, allOrders }: { order: PurchaseOrder; allOrders: PurchaseOrder[] }) {
  const receiveOrder = useRestockStore((s) => s.receiveOrder);
  const writeoffShortage = useRestockStore((s) => s.writeoffShortage);
  const moveReceive = useRestockStore((s) => s.moveReceive);
  const deleteOrder = useRestockStore((s) => s.deleteOrder);

  const [recvQty, setRecvQty] = useState('');
  const [movingEventId, setMovingEventId] = useState<string | null>(null);
  const [targetOrderId, setTargetOrderId] = useState('');
  const [moveError, setMoveError] = useState('');

  const status = orderStatus(order);
  const open = status !== 'done';
  const received = orderReceived(order.events);
  const writtenOff = orderWrittenOff(order.events);
  const remaining = orderRemaining(order);
  const arriveBy = order.createdAt + order.deliveryDays * DAY_MS;
  const total = Math.round((order.quantity * order.pricePerSkein + order.shippingFee) * 100) / 100;

  // 收错家时能改去的单：同色号、别家、还没了结
  const moveTargets = allOrders.filter((o) => o.id !== order.id && o.colorCode === order.colorCode && isOpenOrder(o));

  const doReceive = () => {
    const qty = Number(recvQty);
    if (!Number.isInteger(qty) || qty <= 0) return;
    receiveOrder(order.id, qty);
    setRecvQty('');
  };

  const doMove = (eventId: string) => {
    if (!targetOrderId) return setMoveError('先选要改到哪张单');
    const r = moveReceive(order.id, eventId, targetOrderId);
    if (!r.ok) return setMoveError(r.error ?? '改单失败');
    setMoveError('');
    setMovingEventId(null);
    setTargetOrderId('');
  };

  return (
    <div style={{ border: '1px solid #e0dcd5', borderRadius: 6, padding: 12, marginBottom: 10, background: open ? '#fff' : '#faf9f7' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <b style={{ fontSize: 13 }}>色号 {order.colorCode}</b>
        <span style={{ fontSize: 13 }}>{order.shopName}</span>
        <span style={badge(STATUS_COLOR[status])}>{STATUS_LABEL[status]}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>
          下单 {fmtDateTime(order.createdAt)} · 约 {order.deliveryDays} 天（{fmtDate(arriveBy)} 前到）
        </span>
      </div>

      <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>
        {order.quantity} 团 × ¥{order.pricePerSkein} + 运费 ¥{order.shippingFee} = <b>¥{total}</b>
        <span style={{ marginLeft: 12 }}>
          已收 <b>{received}</b> 团
          {writtenOff > 0 && <> · 已划掉 {writtenOff} 团</>}
          {open && remaining > 0 && <> · 还差 <b style={{ color: '#e67e22' }}>{remaining}</b> 团</>}
        </span>
      </div>

      {open && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <input
            type="number"
            min={1}
            value={recvQty}
            onChange={(e) => setRecvQty(e.target.value)}
            placeholder="实收团数"
            style={{ ...input, width: 90 }}
          />
          <button onClick={doReceive} style={btnPrimary}>
            登记到货
          </button>
          {remaining > 0 && (
            <button
              onClick={() => writeoffShortage(order.id)}
              style={btnGhost}
              title="短装的部分不要了，从这张单里划掉"
            >
              短装 {remaining} 团划掉不补
            </button>
          )}
          {remaining > 0 && received > 0 && (
            <span style={{ fontSize: 11, color: '#888' }}>短装 {remaining} 团等补发中</span>
          )}
        </div>
      )}

      {order.events.length > 0 && (
        <div style={{ fontSize: 11, color: '#777', borderTop: '1px dashed #e0dcd5', paddingTop: 6 }}>
          {order.events.map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
              <span style={{ color: '#aaa' }}>{fmtDateTime(e.at)}</span>
              <span>{eventText(e)}</span>
              {(e.type === 'receive' || e.type === 'move_in') && moveTargets.length > 0 && (
                <button
                  onClick={() => {
                    setMovingEventId(movingEventId === e.id ? null : e.id);
                    setMoveError('');
                    setTargetOrderId('');
                  }}
                  style={{ ...btnGhost, padding: '0 6px', fontSize: 11 }}
                >
                  改单
                </button>
              )}
              {movingEventId === e.id && (
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <select
                    value={targetOrderId}
                    onChange={(ev) => setTargetOrderId(ev.target.value)}
                    style={{ ...input, padding: '1px 4px', fontSize: 11 }}
                  >
                    <option value="">改到哪张单…</option>
                    {moveTargets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.shopName}（{fmtDate(o.createdAt)} 下单，还差 {orderRemaining(o)} 团）
                      </option>
                    ))}
                  </select>
                  <button onClick={() => doMove(e.id)} style={{ ...btnPrimary, padding: '1px 8px', fontSize: 11 }}>
                    确定
                  </button>
                  {moveError && <span style={{ color: '#e74c3c' }}>{moveError}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 6, textAlign: 'right' }}>
        <button
          onClick={() => {
            if (window.confirm(`删掉「${order.colorCode} · ${order.shopName}」这张单？`)) deleteOrder(order.id);
          }}
          style={{ ...btnDanger, fontSize: 11, padding: '2px 8px' }}
        >
          删单
        </button>
      </div>
    </div>
  );
}

export default function OrderList() {
  const orders = useRestockStore((s) => s.orders);
  const openOrders = orders.filter(isOpenOrder).sort((a, b) => b.createdAt - a.createdAt);
  const doneOrders = orders.filter((o) => !isOpenOrder(o)).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div style={section}>
      <h3 style={sectionTitle}>采购单</h3>
      {orders.length === 0 && <div style={{ fontSize: 12, color: '#888' }}>还没有采购单，先在上方「补货比价」出一张。</div>}
      {openOrders.map((o) => (
        <OrderCard key={o.id} order={o} allOrders={orders} />
      ))}
      {doneOrders.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: '#888', margin: '10px 0 8px' }}>已了结</div>
          {doneOrders.map((o) => (
            <OrderCard key={o.id} order={o} allOrders={orders} />
          ))}
        </>
      )}
    </div>
  );
}

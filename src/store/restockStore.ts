import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrderEvent, PlanLine, PurchaseOrder, Quote } from '../types/restock';
import { isOpenOrder, orderRemaining } from '../utils/restockPlan';

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeEvent(type: OrderEvent['type'], qty: number, extra?: Partial<OrderEvent>): OrderEvent {
  return { id: generateId(), type, qty, at: Date.now(), ...extra };
}

export type QuoteInput = Omit<Quote, 'id' | 'quotedAt'> & { quotedAt?: number };

interface RestockState {
  quotes: Quote[];
  orders: PurchaseOrder[];
}

interface RestockActions {
  addQuote: (input: QuoteInput) => void;
  deleteQuote: (id: string) => void;
  /** 按方案出单；同色号同店已有在途单时整批拒绝 */
  createOrdersFromPlan: (lines: PlanLine[]) => { ok: boolean; error?: string };
  /** 到货登记：记下实收团数，短装留在单上等补发 */
  receiveOrder: (orderId: string, qty: number, note?: string) => void;
  /** 短装划掉：把还差着的团数从单里划掉，单就此了结 */
  writeoffShortage: (orderId: string, note?: string) => void;
  /** 收错家：把一笔到货改到正确的单上 */
  moveReceive: (fromOrderId: string, eventId: string, toOrderId: string) => { ok: boolean; error?: string };
  deleteOrder: (id: string) => void;
}

export const useRestockStore = create<RestockState & RestockActions>()(
  persist(
    (set, get) => ({
      quotes: [],
      orders: [],

      addQuote: (input) => {
        const quote: Quote = {
          ...input,
          id: generateId(),
          quotedAt: input.quotedAt ?? Date.now(),
        };
        set((s) => ({ quotes: [...s.quotes, quote] }));
      },

      deleteQuote: (id) => {
        set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) }));
      },

      createOrdersFromPlan: (lines) => {
        const { orders } = get();
        const seen = new Set<string>();
        for (const line of lines) {
          const key = `${line.quote.colorCode}@${line.quote.shopName}`;
          if (seen.has(key)) return { ok: false, error: `方案里 ${key} 重复出单` };
          seen.add(key);
          const clash = orders.some(
            (o) =>
              o.colorCode === line.quote.colorCode &&
              o.shopName === line.quote.shopName &&
              isOpenOrder(o),
          );
          if (clash) {
            return {
              ok: false,
              error: `「${line.quote.colorCode}」在「${line.quote.shopName}」已有在途单，同色号同一家不许挂两张`,
            };
          }
        }
        const now = Date.now();
        const newOrders: PurchaseOrder[] = lines.map((line) => ({
          id: generateId(),
          colorCode: line.quote.colorCode,
          shopName: line.quote.shopName,
          quantity: line.qty,
          pricePerSkein: line.quote.pricePerSkein,
          shippingFee: line.quote.shippingFee,
          deliveryDays: line.quote.deliveryDays,
          createdAt: now,
          events: [],
        }));
        set((s) => ({ orders: [...s.orders, ...newOrders] }));
        return { ok: true };
      },

      receiveOrder: (orderId, qty, note) => {
        if (!Number.isFinite(qty) || qty <= 0) return;
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, events: [...o.events, makeEvent('receive', qty, { note })] } : o,
          ),
        }));
      },

      writeoffShortage: (orderId, note) => {
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const short = orderRemaining(o);
            if (short <= 0) return o;
            return { ...o, events: [...o.events, makeEvent('writeoff', short, { note })] };
          }),
        }));
      },

      moveReceive: (fromOrderId, eventId, toOrderId) => {
        const { orders } = get();
        const from = orders.find((o) => o.id === fromOrderId);
        const to = orders.find((o) => o.id === toOrderId);
        if (!from || !to) return { ok: false, error: '单不存在' };
        if (from.id === to.id) return { ok: false, error: '不能改到同一张单' };
        const event = from.events.find((e) => e.id === eventId);
        if (!event || (event.type !== 'receive' && event.type !== 'move_in')) {
          return { ok: false, error: '只有到货记录能改单' };
        }
        if (to.colorCode !== from.colorCode) {
          return { ok: false, error: `色号对不上：这单是「${from.colorCode}」，对方是「${to.colorCode}」` };
        }
        if (!isOpenOrder(to)) return { ok: false, error: '对方单已了结，不能改过去' };
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id === from.id) {
              return {
                ...o,
                events: [
                  ...o.events,
                  makeEvent('move_out', event.qty, {
                    refOrderId: to.id,
                    note: `改到「${to.shopName}」的单`,
                  }),
                ],
              };
            }
            if (o.id === to.id) {
              return {
                ...o,
                events: [
                  ...o.events,
                  makeEvent('move_in', event.qty, {
                    refOrderId: from.id,
                    note: `从「${from.shopName}」的单改入`,
                  }),
                ],
              };
            }
            return o;
          }),
        }));
        return { ok: true };
      },

      deleteOrder: (id) => {
        set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }));
      },
    }),
    { name: 'yarn-restock-book' },
  ),
);

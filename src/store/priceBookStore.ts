import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PurchaseOrder, Quote, Receipt, Shop, YarnColor } from '../types/priceBook';
import {
  findOpenOrder,
  isOrderOpen,
  orderOutstandingQty,
  recomputeStatus,
  round2,
} from '../utils/priceBook';

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export type OrderLineInput = {
  shopId: string;
  colorId: string;
  qty: number;
  unitPrice: number;
  shippingFee: number;
  deliveryDays: number;
};

interface PriceBookState {
  shops: Shop[];
  colors: YarnColor[];
  quotes: Quote[];
  orders: PurchaseOrder[];
  receipts: Receipt[];
}

interface PriceBookActions {
  // 店铺
  addShop: (input: { name: string; shippingFee: number; freeShipThreshold: number | null; note?: string }) => void;
  updateShop: (id: string, patch: Partial<Omit<Shop, 'id' | 'createdAt'>>) => void;
  deleteShop: (id: string) => string | null;
  // 色号
  addColor: (input: { yarnName: string; colorCode: string; colorName?: string; hex?: string }) => string;
  updateColor: (id: string, patch: Partial<Omit<YarnColor, 'id' | 'createdAt'>>) => void;
  deleteColor: (id: string) => string | null;
  // 报价
  addQuote: (input: {
    shopId: string;
    colorId: string;
    price: number;
    moq: number;
    deliveryDays: number;
    maxQty: number | null;
    validDays: number;
    note?: string;
  }) => string | null;
  deleteQuote: (id: string) => void;
  // 订单
  createOrders: (lines: OrderLineInput[]) => { ok: boolean; error?: string };
  cancelOrder: (id: string) => string | null;
  // 到货
  addReceipt: (orderId: string, qty: number, note?: string) => string | null;
  resolveShortage: (orderId: string, decision: 'reship' | 'writeoff') => string | null;
  moveReceipt: (receiptId: string, targetOrderId: string) => string | null;
}

export const usePriceBookStore = create<PriceBookState & PriceBookActions>()(
  persist(
    (set, get) => ({
      shops: [],
      colors: [],
      quotes: [],
      orders: [],
      receipts: [],

      addShop: (input) => {
        const name = input.name.trim();
        if (!name) return;
        set((s) => ({
          shops: [
            ...s.shops,
            {
              id: generateId(),
              name,
              shippingFee: Math.max(0, input.shippingFee),
              freeShipThreshold: input.freeShipThreshold,
              note: input.note?.trim() || undefined,
              createdAt: Date.now(),
            },
          ],
        }));
      },

      updateShop: (id, patch) => {
        set((s) => ({ shops: s.shops.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)) }));
      },

      deleteShop: (id) => {
        const { quotes, orders } = get();
        if (orders.some((o) => o.shopId === id)) return '该店已有订单，不能删除';
        if (quotes.some((q) => q.shopId === id)) return '该店已有报价记录，不能删除';
        set((s) => ({ shops: s.shops.filter((sh) => sh.id !== id) }));
        return null;
      },

      addColor: (input) => {
        const id = generateId();
        set((s) => ({
          colors: [
            ...s.colors,
            {
              id,
              yarnName: input.yarnName.trim(),
              colorCode: input.colorCode.trim(),
              colorName: input.colorName?.trim() || undefined,
              hex: input.hex || undefined,
              createdAt: Date.now(),
            },
          ],
        }));
        return id;
      },

      updateColor: (id, patch) => {
        set((s) => ({ colors: s.colors.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      },

      deleteColor: (id) => {
        const { quotes, orders } = get();
        if (orders.some((o) => o.colorId === id)) return '该色号已有订单，不能删除';
        if (quotes.some((q) => q.colorId === id)) return '该色号已有报价记录，不能删除';
        set((s) => ({ colors: s.colors.filter((c) => c.id !== id) }));
        return null;
      },

      addQuote: (input) => {
        if (!(input.price > 0)) return '单价必须大于 0';
        if (!(input.moq >= 1)) return '起订量至少 1 团';
        if (!(input.deliveryDays >= 0)) return '到货天数不能为负';
        if (!(input.validDays >= 1)) return '有效期至少 1 天';
        if (input.maxQty != null && input.maxQty < 1) return '可供团数至少 1 团';
        const { shops, colors } = get();
        if (!shops.some((sh) => sh.id === input.shopId)) return '店铺不存在';
        if (!colors.some((c) => c.id === input.colorId)) return '色号不存在';
        set((s) => ({
          quotes: [
            ...s.quotes,
            {
              id: generateId(),
              shopId: input.shopId,
              colorId: input.colorId,
              price: round2(input.price),
              moq: Math.floor(input.moq),
              deliveryDays: Math.floor(input.deliveryDays),
              maxQty: input.maxQty == null ? null : Math.floor(input.maxQty),
              quotedAt: Date.now(),
              validDays: Math.floor(input.validDays),
              note: input.note?.trim() || undefined,
            },
          ],
        }));
        return null;
      },

      deleteQuote: (id) => {
        set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) }));
      },

      createOrders: (lines) => {
        if (lines.length === 0) return { ok: false, error: '没有要下的单' };
        const { shops, colors, orders } = get();
        const seen = new Set<string>();
        for (const line of lines) {
          const shop = shops.find((sh) => sh.id === line.shopId);
          const color = colors.find((c) => c.id === line.colorId);
          if (!shop || !color) return { ok: false, error: '店铺或色号不存在' };
          if (!(line.qty >= 1)) return { ok: false, error: '订购团数至少 1 团' };
          const key = `${line.shopId}:${line.colorId}`;
          if (seen.has(key)) return { ok: false, error: `「${color.colorCode}」在「${shop.name}」重复下单` };
          seen.add(key);
          const open = findOpenOrder(orders, line.shopId, line.colorId);
          if (open) {
            return {
              ok: false,
              error: `「${color.colorCode}」在「${shop.name}」已有在途单，不能同时挂两张`,
            };
          }
        }
        const now = Date.now();
        const newOrders: PurchaseOrder[] = lines.map((line) => ({
          id: generateId(),
          shopId: line.shopId,
          colorId: line.colorId,
          qty: Math.floor(line.qty),
          unitPrice: round2(line.unitPrice),
          shippingFee: round2(line.shippingFee),
          totalAmount: round2(line.unitPrice * Math.floor(line.qty) + line.shippingFee),
          deliveryDays: Math.floor(line.deliveryDays),
          status: 'in_transit',
          shortageDecision: null,
          writtenOffQty: 0,
          createdAt: now,
        }));
        set((s) => ({ orders: [...s.orders, ...newOrders] }));
        return { ok: true };
      },

      cancelOrder: (id) => {
        const { orders, receipts } = get();
        const order = orders.find((o) => o.id === id);
        if (!order) return '订单不存在';
        if (!isOrderOpen(order)) return '订单已完结，不能取消';
        if (receipts.some((r) => r.orderId === id)) return '已有到货记录，不能取消';
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, status: 'cancelled' as const } : o)),
        }));
        return null;
      },

      addReceipt: (orderId, qty, note) => {
        if (!(qty >= 1)) return '实收团数至少 1 团';
        const { orders } = get();
        const order = orders.find((o) => o.id === orderId);
        if (!order) return '订单不存在';
        if (!isOrderOpen(order)) return '订单已完结，不能再登记到货';
        const receipt: Receipt = {
          id: generateId(),
          orderId,
          qty: Math.floor(qty),
          kind: order.status === 'awaiting_reship' ? 'reship' : 'normal',
          receivedAt: Date.now(),
          note: note?.trim() || undefined,
        };
        set((s) => {
          const receipts = [...s.receipts, receipt];
          return {
            receipts,
            orders: s.orders.map((o) => {
              if (o.id !== orderId) return o;
              const outstanding = orderOutstandingQty(o, receipts);
              if (outstanding <= 0) {
                // 收齐了
                return { ...o, status: 'completed' as const };
              }
              // 仍有短装：回到待处理，等「补发 / 划掉」的决定
              return { ...o, status: 'in_transit' as const, shortageDecision: null };
            }),
          };
        });
        return null;
      },

      resolveShortage: (orderId, decision) => {
        const { orders, receipts } = get();
        const order = orders.find((o) => o.id === orderId);
        if (!order) return '订单不存在';
        if (!isOrderOpen(order)) return '订单已完结';
        const outstanding = orderOutstandingQty(order, receipts);
        if (outstanding <= 0) return '这张单没有短装';
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            if (decision === 'reship') {
              return { ...o, shortageDecision: 'reship' as const, status: 'awaiting_reship' as const };
            }
            // 划掉：短装从单里销掉，单子完结
            return {
              ...o,
              shortageDecision: 'written_off' as const,
              writtenOffQty: o.writtenOffQty + outstanding,
              status: 'completed' as const,
            };
          }),
        }));
        return null;
      },

      moveReceipt: (receiptId, targetOrderId) => {
        const { orders, receipts } = get();
        const receipt = receipts.find((r) => r.id === receiptId);
        if (!receipt) return '收货记录不存在';
        const source = orders.find((o) => o.id === receipt.orderId);
        const target = orders.find((o) => o.id === targetOrderId);
        if (!source || !target) return '订单不存在';
        if (source.id === target.id) return '不能改到同一张单';
        if (source.colorId !== target.colorId) return '只能改到同一色号的单';
        if (!isOrderOpen(target)) return '目标单已完结，不能改入';
        set((s) => {
          const receipts = s.receipts.map((r) =>
            r.id === receiptId
              ? { ...r, orderId: targetOrderId, kind: (target.status === 'awaiting_reship' ? 'reship' : 'normal') as Receipt['kind'] }
              : r
          );
          return {
            receipts,
            orders: s.orders.map((o) =>
              o.id === source.id || o.id === target.id
                ? { ...o, status: recomputeStatus(o, receipts) }
                : o
            ),
          };
        });
        return null;
      },
    }),
    {
      name: 'yarn-price-book-storage',
    }
  )
);

import type { PurchaseOrder, Quote, Receipt, Shop } from '../types/priceBook';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------- 报价 ----------

export function quoteExpireAt(q: Quote): number {
  return q.quotedAt + q.validDays * DAY_MS;
}

/** 过期的报价不再拿出来比 */
export function isQuoteExpired(q: Quote, now = Date.now()): boolean {
  return now >= quoteExpireAt(q);
}

/** 某色号下各家最新的一条报价（不管是否过期，是否过期由调用方判断） */
export function latestQuotesByShop(quotes: Quote[], colorId: string): Map<string, Quote> {
  const map = new Map<string, Quote>();
  for (const q of quotes) {
    if (q.colorId !== colorId) continue;
    const cur = map.get(q.shopId);
    if (!cur || q.quotedAt > cur.quotedAt) map.set(q.shopId, q);
  }
  return map;
}

// ---------- 运费 ----------

export function shippingFor(shop: Shop, goodsTotal: number): number {
  if (shop.freeShipThreshold != null && goodsTotal >= shop.freeShipThreshold) return 0;
  return shop.shippingFee;
}

// ---------- 订单 ----------

/** 在途单：运输中或等补发，都占「同色号同店一张」的名额 */
export function isOrderOpen(o: PurchaseOrder): boolean {
  return o.status === 'in_transit' || o.status === 'awaiting_reship';
}

export function findOpenOrder(
  orders: PurchaseOrder[],
  shopId: string,
  colorId: string
): PurchaseOrder | undefined {
  return orders.find((o) => o.shopId === shopId && o.colorId === colorId && isOrderOpen(o));
}

export function orderReceivedQty(orderId: string, receipts: Receipt[]): number {
  return receipts.filter((r) => r.orderId === orderId).reduce((s, r) => s + r.qty, 0);
}

/** 总短装 = 订购 - 实收（含已划掉的部分） */
export function orderShortageQty(order: PurchaseOrder, receipts: Receipt[]): number {
  return Math.max(0, order.qty - orderReceivedQty(order.id, receipts));
}

/** 待处理 = 总短装中还没划掉的部分（在途或等补发的量） */
export function orderOutstandingQty(order: PurchaseOrder, receipts: Receipt[]): number {
  return Math.max(0, orderShortageQty(order, receipts) - order.writtenOffQty);
}

/** 收货记录变动后重算订单状态 */
export function recomputeStatus(order: PurchaseOrder, receipts: Receipt[]): PurchaseOrder['status'] {
  if (order.status === 'cancelled') return 'cancelled';
  if (orderOutstandingQty(order, receipts) <= 0) return 'completed';
  return order.shortageDecision === 'reship' ? 'awaiting_reship' : 'in_transit';
}

// ---------- 补货比价 ----------

/** 一张订单行的报价明细 */
export type OfferLine = {
  shopId: string;
  shopName: string;
  qty: number; // 购买团数
  unitPrice: number;
  goodsTotal: number; // 货款
  shipping: number; // 运费
  total: number; // 货款 + 运费
  deliveryDays: number;
};

export function makeOfferLine(shop: Shop, quote: Quote, qty: number): OfferLine {
  const goodsTotal = round2(quote.price * qty);
  const shipping = shippingFor(shop, goodsTotal);
  return {
    shopId: shop.id,
    shopName: shop.name,
    qty,
    unitPrice: quote.price,
    goodsTotal,
    shipping,
    total: round2(goodsTotal + shipping),
    deliveryDays: quote.deliveryDays,
  };
}

export type ShopEvalOk = {
  kind: 'ok';
  shop: Shop;
  quote: Quote;
  buyQty: number; // 一家买时要下的团数：max(需要, 起订)
  canFulfill: boolean; // 一家能否买齐
  line: OfferLine;
};

export type ShopEvalBlocked = {
  kind: 'blocked';
  shop: Shop;
  quote: Quote | null;
  reason: string;
};

export type ShopEvaluation = ShopEvalOk | ShopEvalBlocked;

/**
 * 评估某色号下各家（有报价的）店：
 * 排除已有在途单的、报价过期的、可供量低于起订量的。
 */
export function evaluateShopsForRestock(args: {
  shops: Shop[];
  quotes: Quote[];
  orders: PurchaseOrder[];
  colorId: string;
  neededQty: number;
  now?: number;
}): ShopEvaluation[] {
  const { shops, quotes, orders, colorId, neededQty } = args;
  const now = args.now ?? Date.now();
  const latest = latestQuotesByShop(quotes, colorId);
  const result: ShopEvaluation[] = [];

  for (const [shopId, quote] of latest) {
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) continue;

    if (findOpenOrder(orders, shopId, colorId)) {
      result.push({ kind: 'blocked', shop, quote, reason: '该店此色号已有在途单' });
      continue;
    }
    if (isQuoteExpired(quote, now)) {
      result.push({ kind: 'blocked', shop, quote, reason: '报价已过期' });
      continue;
    }
    if (quote.maxQty != null && quote.maxQty < quote.moq) {
      result.push({ kind: 'blocked', shop, quote, reason: `可供 ${quote.maxQty} 团，低于起订 ${quote.moq} 团` });
      continue;
    }

    const buyQty = Math.max(neededQty, quote.moq);
    const canFulfill = quote.maxQty == null || buyQty <= quote.maxQty;
    result.push({ kind: 'ok', shop, quote, buyQty, canFulfill, line: makeOfferLine(shop, quote, buyQty) });
  }

  return result;
}

export type RestockPlan =
  | { kind: 'single'; best: OfferLine; ranked: OfferLine[] }
  | { kind: 'split'; first: OfferLine; second: OfferLine; total: number }
  | { kind: 'none'; reason: string };

type SplitCombo = { first: OfferLine; second: OfferLine; total: number };

function byTotalThenDays(a: OfferLine, b: OfferLine): number {
  return a.total - b.total || a.deliveryDays - b.deliveryDays;
}

function comboMaxDays(c: SplitCombo): number {
  return Math.max(c.first.deliveryDays, c.second.deliveryDays);
}

/** 总费用更低优先，并列时到货更慢的一家先到的优先 */
function betterCombo(a: SplitCombo, b: SplitCombo): boolean {
  return a.total < b.total - 1e-9 || (Math.abs(a.total - b.total) < 1e-9 && comboMaxDays(a) < comboMaxDays(b));
}

/** 主家 p 尽量多拿、副家 s 补足的候选分法（覆盖起订/可供边界） */
function splitCandidates(p: ShopEvalOk, s: ShopEvalOk, neededQty: number): SplitCombo[] {
  const maxP = p.quote.maxQty ?? Number.POSITIVE_INFINITY;
  const maxS = s.quote.maxQty ?? Number.POSITIVE_INFINITY;
  const moqP = p.quote.moq;
  const moqS = s.quote.moq;

  const candidates = new Set<number>();
  candidates.add(neededQty - moqS); // 副家压到起订，主家尽量多拿
  if (Number.isFinite(maxS)) candidates.add(neededQty - maxS); // 副家拿满
  candidates.add(moqP); // 主家只拿起订

  const out: SplitCombo[] = [];
  for (const raw of candidates) {
    const qtyP = Math.min(Math.max(raw, moqP), maxP);
    if (!(qtyP >= moqP) || qtyP > maxP) continue;
    const qtyS = Math.max(moqS, neededQty - qtyP);
    if (qtyS > maxS || qtyP + qtyS < neededQty) continue;

    const first = makeOfferLine(p.shop, p.quote, qtyP);
    const second = makeOfferLine(s.shop, s.quote, qtyS);
    out.push({ first, second, total: round2(first.total + second.total) });
  }
  return out;
}

/** 两家凑 N 团的最省分法 */
function bestSplitForPair(a: ShopEvalOk, b: ShopEvalOk, neededQty: number): SplitCombo | null {
  const candidates = [...splitCandidates(a, b, neededQty), ...splitCandidates(b, a, neededQty)];
  let best: SplitCombo | null = null;
  for (const c of candidates) {
    if (!best || betterCombo(c, best)) best = c;
  }
  return best;
}

/**
 * 补货决策：
 * 能一家买齐 → 按总价加运费排出先后，出一张单；
 * 凑不齐 → 挑最省钱的两家组合拆两张单。
 */
export function planRestock(evaluations: ShopEvaluation[], neededQty: number): RestockPlan {
  if (neededQty <= 0) return { kind: 'none', reason: '请输入要补的团数' };

  const ok = evaluations.filter((e): e is ShopEvalOk => e.kind === 'ok');
  const singles = ok.filter((e) => e.canFulfill).map((e) => e.line).sort(byTotalThenDays);

  if (singles.length > 0) {
    return { kind: 'single', best: singles[0], ranked: singles };
  }

  let best: SplitCombo | null = null;
  for (let i = 0; i < ok.length; i++) {
    for (let j = i + 1; j < ok.length; j++) {
      const combo = bestSplitForPair(ok[i], ok[j], neededQty);
      if (combo && (!best || betterCombo(combo, best))) {
        best = combo;
      }
    }
  }

  if (best) return { kind: 'split', first: best.first, second: best.second, total: best.total };
  return {
    kind: 'none',
    reason: ok.length === 0 ? '没有可用报价' : '各家可供团数凑不齐所需数量',
  };
}

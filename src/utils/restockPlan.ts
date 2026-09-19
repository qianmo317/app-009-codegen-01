import type {
  OrderEvent,
  OrderStatus,
  PlanLine,
  PurchaseOrder,
  Quote,
  RestockPlan,
} from '../types/restock';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 报价是否仍在有效期内（过期不再拿出来比） */
export function isQuoteValid(q: Quote, now: number): boolean {
  return quoteExpireAt(q) > now;
}

export function quoteExpireAt(q: Quote): number {
  return q.quotedAt + q.validDays * DAY_MS;
}

/** 某色号下每家店的最新一条有效报价（一家只取一条） */
export function latestValidQuotes(quotes: Quote[], colorCode: string, now: number): Quote[] {
  const byShop = new Map<string, Quote>();
  for (const q of quotes) {
    if (q.colorCode !== colorCode || !isQuoteValid(q, now)) continue;
    const cur = byShop.get(q.shopName);
    if (!cur || q.quotedAt > cur.quotedAt) byShop.set(q.shopName, q);
  }
  return [...byShop.values()];
}

export function makeLine(quote: Quote, qty: number): PlanLine {
  const goods = round2(quote.pricePerSkein * qty);
  return { quote, qty, goods, total: round2(goods + quote.shippingFee) };
}

/** 一家能否买齐：按起订量补足后，可供量仍够 */
export function canCoverAlone(q: Quote, needQty: number): boolean {
  const qty = Math.max(needQty, q.minOrder);
  return q.availableQty == null || q.availableQty >= qty;
}

export type RankingRow = {
  quote: Quote;
  qty: number; // 需下单团数（不足起订量按起订量算）
  total: number; // 总价 = 货款 + 运费
  feasibleAlone: boolean;
  blocked: boolean; // 该店同色号已有在途单
  note: string;
};

/** 比价排名：按总价（含运费）升序，并列时到货快的在前 */
export function rankQuotes(
  candidates: Quote[],
  needQty: number,
  blockedShops: Set<string>,
): RankingRow[] {
  const rows = candidates.map((quote) => {
    const qty = Math.max(needQty, quote.minOrder);
    const feasibleAlone = canCoverAlone(quote, needQty);
    const blocked = blockedShops.has(quote.shopName);
    let note = '';
    if (blocked) note = '该店已有在途单，不能再挂';
    else if (!feasibleAlone) note = `现货仅 ${quote.availableQty} 团，一家买不齐`;
    return { quote, qty, total: makeLine(quote, qty).total, feasibleAlone, blocked, note };
  });
  rows.sort(
    (a, b) =>
      a.total - b.total ||
      a.quote.deliveryDays - b.quote.deliveryDays ||
      a.quote.shopName.localeCompare(b.quote.shopName),
  );
  return rows;
}

/** 两家凑单：枚举第一家出的团数，第二家补足（不少于其起订量），取总价最低 */
export function bestSplit(a: Quote, b: Quote, needQty: number): [PlanLine, PlanLine] | null {
  let best: [PlanLine, PlanLine] | null = null;
  const hiA = Math.min(a.availableQty ?? needQty, needQty);
  for (let qtyA = a.minOrder; qtyA <= hiA; qtyA++) {
    const qtyB = Math.max(needQty - qtyA, b.minOrder);
    if (b.availableQty != null && qtyB > b.availableQty) continue;
    if (qtyA + qtyB < needQty) continue;
    const la = makeLine(a, qtyA);
    const lb = makeLine(b, qtyB);
    if (!isBetterPair(la, lb, best)) continue;
    best = [la, lb];
  }
  return best;
}

function isBetterPair(la: PlanLine, lb: PlanLine, best: [PlanLine, PlanLine] | null): boolean {
  if (!best) return true;
  const total = la.total + lb.total;
  const bestTotal = best[0].total + best[1].total;
  if (total !== bestTotal) return total < bestTotal;
  const days = Math.max(la.quote.deliveryDays, lb.quote.deliveryDays);
  const bestDays = Math.max(best[0].quote.deliveryDays, best[1].quote.deliveryDays);
  return days < bestDays;
}

export type RestockResult = {
  plan: RestockPlan | null;
  ranking: RankingRow[];
};

/**
 * 补货比价：先按总价+运费排名；能一家买齐就出一张单，
 * 凑不齐就在所有两两组合里挑最省钱的拆单方案。
 * 已有同色号在途单的店不参与（同店同色号不许挂两张在途单）。
 */
export function planRestock(
  quotes: Quote[],
  colorCode: string,
  needQty: number,
  blockedShops: Set<string>,
  now: number,
): RestockResult {
  const all = latestValidQuotes(quotes, colorCode, now);
  const ranking = rankQuotes(all, needQty, blockedShops);
  if (needQty <= 0) return { plan: null, ranking };

  const usable = all.filter((q) => !blockedShops.has(q.shopName));
  const singles = usable
    .filter((q) => canCoverAlone(q, needQty))
    .sort(
      (a, b) =>
        makeLine(a, Math.max(needQty, a.minOrder)).total -
          makeLine(b, Math.max(needQty, b.minOrder)).total ||
        a.deliveryDays - b.deliveryDays,
    );
  if (singles.length > 0) {
    const best = singles[0];
    return { plan: { mode: 'single', lines: [makeLine(best, Math.max(needQty, best.minOrder))] }, ranking };
  }

  let best: [PlanLine, PlanLine] | null = null;
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const pair = bestSplit(usable[i], usable[j], needQty);
      if (pair && isBetterPair(pair[0], pair[1], best)) best = pair;
    }
  }
  return { plan: best ? { mode: 'split', lines: best } : null, ranking };
}

/* ---------- 采购单派生量（全部由事件流水算出） ---------- */

/** 实收团数：到货 + 改单入 − 改单出 */
export function orderReceived(events: OrderEvent[]): number {
  return events.reduce((sum, e) => {
    if (e.type === 'receive' || e.type === 'move_in') return sum + e.qty;
    if (e.type === 'move_out') return sum - e.qty;
    return sum;
  }, 0);
}

/** 短装中已划掉（不再补发）的团数 */
export function orderWrittenOff(events: OrderEvent[]): number {
  return events.reduce((sum, e) => (e.type === 'writeoff' ? sum + e.qty : sum), 0);
}

/** 还差几团没着落（在途或待补发） */
export function orderRemaining(o: PurchaseOrder): number {
  return o.quantity - orderReceived(o.events) - orderWrittenOff(o.events);
}

export function orderStatus(o: PurchaseOrder): OrderStatus {
  if (orderRemaining(o) <= 0) return 'done';
  return orderReceived(o.events) > 0 ? 'partial' : 'in_transit';
}

export function isOpenOrder(o: PurchaseOrder): boolean {
  return orderStatus(o) !== 'done';
}

/** 一条报价：某色号在某家店的价格、起订量、到货天数，带时间与有效期 */
export type Quote = {
  id: string;
  colorCode: string; // 色号
  shopName: string; // 店家
  pricePerSkein: number; // 单价（元/团）
  minOrder: number; // 最少起订（团）
  deliveryDays: number; // 到货天数
  shippingFee: number; // 运费（元/单）
  availableQty: number | null; // 可供团数，null = 不限
  quotedAt: number; // 报价时间（毫秒时间戳）
  validDays: number; // 有效期（天），过期不再参与比价
};

/** 采购单事件：到货登记 / 短装划掉 / 改单出 / 改单入 */
export type OrderEventType = 'receive' | 'writeoff' | 'move_out' | 'move_in';

export type OrderEvent = {
  id: string;
  type: OrderEventType;
  qty: number;
  at: number;
  note?: string;
  refOrderId?: string; // 改单时对方单 id
};

/** 一张采购单：下单时把报价快照进来，之后报价变动不影响已下的单 */
export type PurchaseOrder = {
  id: string;
  colorCode: string;
  shopName: string;
  quantity: number; // 下单团数
  pricePerSkein: number;
  shippingFee: number;
  deliveryDays: number;
  createdAt: number;
  events: OrderEvent[];
};

export type OrderStatus = 'in_transit' | 'partial' | 'done';

/** 方案里的一行：从哪家买几团、货款多少、含运费总价多少 */
export type PlanLine = {
  quote: Quote;
  qty: number;
  goods: number; // 货款 = 单价 × 团数
  total: number; // 货款 + 运费
};

/** 补货方案：一家买齐出一张单；凑不齐则拆给最省钱的两家 */
export type RestockPlan =
  | { mode: 'single'; lines: [PlanLine] }
  | { mode: 'split'; lines: [PlanLine, PlanLine] };

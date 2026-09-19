// 毛线比价本领域模型

/** 店铺：运费与包邮门槛记在店上，比价时算进总价 */
export type Shop = {
  id: string;
  name: string;
  shippingFee: number; // 运费（元）
  freeShipThreshold: number | null; // 满多少包邮（元），null 表示不包邮
  note?: string;
  createdAt: number;
};

/** 色号：同一种线下的一个色号 */
export type YarnColor = {
  id: string;
  yarnName: string; // 线名，如「美丽诺羊毛 4 股」
  colorCode: string; // 色号，如「209」
  colorName?: string; // 颜色名，如「奶白」
  hex?: string; // 色卡
  createdAt: number;
};

/** 报价：同一色号同一店可多次报价，留时间，过期的不再拿出来比 */
export type Quote = {
  id: string;
  shopId: string;
  colorId: string;
  price: number; // 每团单价（元）
  moq: number; // 最少起订团数
  deliveryDays: number; // 几天能到
  maxQty: number | null; // 可供团数，null 表示不限
  quotedAt: number; // 报价时间
  validDays: number; // 报价有效天数
  note?: string;
};

/** 在途 = 待发货运输中 + 等补发，两种状态都占用「同色号同店只能挂一张」的名额 */
export type OrderStatus = 'in_transit' | 'awaiting_reship' | 'completed' | 'cancelled';

export type ShortageDecision = 'reship' | 'written_off' | null;

export type PurchaseOrder = {
  id: string;
  shopId: string;
  colorId: string;
  qty: number; // 订购团数
  unitPrice: number; // 下单时单价快照
  shippingFee: number; // 实收运费
  totalAmount: number; // 合计（货款 + 运费）
  deliveryDays: number; // 预计到货天数快照
  status: OrderStatus;
  shortageDecision: ShortageDecision; // 短装处理：补发中 / 已划掉
  writtenOffQty: number; // 短装划掉的团数
  createdAt: number;
  note?: string;
};

/** 收货记录：一张单可多次到货（含补发），收错家可改到正确的单上 */
export type Receipt = {
  id: string;
  orderId: string;
  qty: number; // 实收团数
  kind: 'normal' | 'reship'; // 正常到货 / 补发到货
  receivedAt: number;
  note?: string;
};

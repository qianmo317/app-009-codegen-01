import { useMemo, useState } from 'react';
import { usePriceBookStore } from '../../store/priceBookStore';
import type { OfferLine } from '../../utils/priceBook';
import { evaluateShopsForRestock, planRestock } from '../../utils/priceBook';
import type { ShopEvalOk } from '../../utils/priceBook';
import { btnStyle, cardStyle, colors, fmtMoney, inputStyle, tdStyle, thStyle } from './styles';
import { ColorLabel, Field, Tag } from './ui';

function OfferTable({ lines, bestShopId }: { lines: OfferLine[]; bestShopId?: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thStyle}>排名</th>
          <th style={thStyle}>店铺</th>
          <th style={thStyle}>单价/团</th>
          <th style={thStyle}>下单团数</th>
          <th style={thStyle}>货款</th>
          <th style={thStyle}>运费</th>
          <th style={thStyle}>合计</th>
          <th style={thStyle}>到货</th>
          <th style={thStyle}></th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={l.shopId} style={l.shopId === bestShopId ? { background: '#eaf4fb' } : undefined}>
            <td style={tdStyle}>{i + 1}</td>
            <td style={tdStyle}><b>{l.shopName}</b></td>
            <td style={tdStyle}>{fmtMoney(l.unitPrice)}</td>
            <td style={tdStyle}>{l.qty} 团</td>
            <td style={tdStyle}>{fmtMoney(l.goodsTotal)}</td>
            <td style={tdStyle}>{l.shipping === 0 ? '包邮' : fmtMoney(l.shipping)}</td>
            <td style={tdStyle}><b>{fmtMoney(l.total)}</b></td>
            <td style={tdStyle}>{l.deliveryDays} 天</td>
            <td style={tdStyle}>{l.shopId === bestShopId && <Tag color="blue">最省</Tag>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RestockPanel({ onGoOrders }: { onGoOrders: () => void }) {
  const shops = usePriceBookStore((s) => s.shops);
  const colorList = usePriceBookStore((s) => s.colors);
  const quotes = usePriceBookStore((s) => s.quotes);
  const orders = usePriceBookStore((s) => s.orders);
  const createOrders = usePriceBookStore((s) => s.createOrders);

  const [colorId, setColorId] = useState('');
  const [neededQty, setNeededQty] = useState('10');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const needed = Math.max(0, Math.floor(Number(neededQty) || 0));

  const evaluations = useMemo(
    () =>
      colorId && needed > 0
        ? evaluateShopsForRestock({ shops, quotes, orders, colorId, neededQty: needed })
        : [],
    [shops, quotes, orders, colorId, needed]
  );

  const plan = useMemo(() => (evaluations.length > 0 ? planRestock(evaluations, needed) : null), [evaluations, needed]);

  const selectedColor = colorList.find((c) => c.id === colorId) ?? null;

  const blockedEvals = evaluations.filter((e) => e.kind === 'blocked');
  // 供不满一家、但可参与拆分的店
  const partialEvals = evaluations.filter((e): e is ShopEvalOk => e.kind === 'ok' && !e.canFulfill);

  const placeOrders = (lines: OfferLine[]) => {
    const result = createOrders(
      lines.map((l) => ({
        shopId: l.shopId,
        colorId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        shippingFee: l.shipping,
        deliveryDays: l.deliveryDays,
      }))
    );
    if (result.ok) {
      setMessage({ kind: 'ok', text: lines.length === 1 ? '已开出一张单，到「订单」页查看。' : '已拆成两张单，到「订单」页查看。' });
    } else {
      setMessage({ kind: 'err', text: result.error ?? '开单失败' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>要补哪个色号？</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="色号">
            <select
              style={{ ...inputStyle, minWidth: 220 }}
              value={colorId}
              onChange={(e) => {
                setColorId(e.target.value);
                setMessage(null);
              }}
            >
              <option value="">选择色号</option>
              {colorList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.yarnName} {c.colorCode}{c.colorName ? `（${c.colorName}）` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="要补（团）">
            <input style={{ ...inputStyle, width: 90 }} type="number" min={1} step={1} value={neededQty} onChange={(e) => setNeededQty(e.target.value)} />
          </Field>
        </div>
        {colorList.length === 0 && (
          <div style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>先到「色号与报价」页添加色号和报价。</div>
        )}
        {message && (
          <div style={{ marginTop: 10, fontSize: 14, color: message.kind === 'ok' ? colors.ok : colors.danger }}>
            {message.text}
            {message.kind === 'ok' && (
              <button style={{ ...btnStyle('ghost'), marginLeft: 8 }} onClick={onGoOrders}>去订单页 →</button>
            )}
          </div>
        )}
      </div>

      {selectedColor && needed > 0 && (
        <>
          {/* 各家报价评估 */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>
              各家对比 · <ColorLabel color={selectedColor} /> · 需 {needed} 团
            </h3>
            {evaluations.length === 0 ? (
              <div style={{ color: colors.muted, fontSize: 14 }}>这个色号还没有任何报价，先去「色号与报价」录入。</div>
            ) : (
              <>
                {plan?.kind === 'single' && plan.ranked.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, color: colors.muted, marginBottom: 6 }}>能一家买齐的（按总价+运费排先后）：</div>
                    <OfferTable lines={plan.ranked} bestShopId={plan.best.shopId} />
                  </>
                )}
                {partialEvals.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, color: colors.muted, margin: '12px 0 6px' }}>一家供不齐的（可用于拆分）：</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>店铺</th>
                          <th style={thStyle}>单价/团</th>
                          <th style={thStyle}>最多可供</th>
                          <th style={thStyle}>起订</th>
                          <th style={thStyle}>到货</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partialEvals.map((e) => (
                          <tr key={e.shop.id}>
                            <td style={tdStyle}>{e.shop.name}</td>
                            <td style={tdStyle}>{fmtMoney(e.quote.price)}</td>
                            <td style={tdStyle}>{e.quote.maxQty} 团</td>
                            <td style={tdStyle}>{e.quote.moq} 团</td>
                            <td style={tdStyle}>{e.quote.deliveryDays} 天</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {blockedEvals.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 13, color: colors.muted }}>
                    不参与本次比价：
                    {blockedEvals.map((e) =>
                      e.kind === 'blocked' ? (
                        <span key={e.shop.id} style={{ marginRight: 12 }}>
                          {e.shop.name}（{e.reason}）
                        </span>
                      ) : null
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 开单方案 */}
          {plan && plan.kind !== 'none' && evaluations.length > 0 && (
            <div style={{ ...cardStyle, border: `1px solid ${colors.accent}` }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>建议方案</h3>
              {plan.kind === 'single' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14 }}>
                    一家买齐：在 <b>{plan.best.shopName}</b> 下 <b>{plan.best.qty} 团</b>，货款 {fmtMoney(plan.best.goodsTotal)}
                    {' '}+ 运费 {plan.best.shipping === 0 ? '包邮' : fmtMoney(plan.best.shipping)} = <b>{fmtMoney(plan.best.total)}</b>，约 {plan.best.deliveryDays} 天到。
                  </div>
                  <button style={btnStyle('primary')} onClick={() => placeOrders([plan.best])}>出一张单</button>
                </div>
              )}
              {plan.kind === 'split' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 14, color: colors.muted }}>一家凑不齐，最省钱的拆法是两家：</div>
                  {[plan.first, plan.second].map((l) => (
                    <div key={l.shopId} style={{ fontSize: 14 }}>
                      · <b>{l.shopName}</b> 下 <b>{l.qty} 团</b>，货款 {fmtMoney(l.goodsTotal)} + 运费{' '}
                      {l.shipping === 0 ? '包邮' : fmtMoney(l.shipping)} = <b>{fmtMoney(l.total)}</b>，约 {l.deliveryDays} 天到
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
                    <div style={{ fontSize: 14 }}>两单合计 <b>{fmtMoney(plan.total)}</b></div>
                    <button style={btnStyle('primary')} onClick={() => placeOrders([plan.first, plan.second])}>拆成两张单</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {plan?.kind === 'none' && evaluations.length > 0 && (
            <div style={{ ...cardStyle, border: `1px solid ${colors.warn}` }}>
              <span style={{ color: colors.warn, fontSize: 14 }}>凑不齐：{plan.reason}。可以去补录报价，或把要补的团数调小。</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

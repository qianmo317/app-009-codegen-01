import { useMemo, useState } from 'react';
import { usePriceBookStore } from '../../store/priceBookStore';
import { isQuoteExpired, latestQuotesByShop, quoteExpireAt } from '../../utils/priceBook';
import { btnStyle, cardStyle, colors, fmtDateTime, fmtMoney, inputStyle, tdStyle, thStyle } from './styles';
import { ColorLabel, Field, Tag } from './ui';

export default function QuotesPanel() {
  const shops = usePriceBookStore((s) => s.shops);
  const colorList = usePriceBookStore((s) => s.colors);
  const quotes = usePriceBookStore((s) => s.quotes);
  const addColor = usePriceBookStore((s) => s.addColor);
  const deleteColor = usePriceBookStore((s) => s.deleteColor);
  const addQuote = usePriceBookStore((s) => s.addQuote);
  const deleteQuote = usePriceBookStore((s) => s.deleteQuote);

  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // 新色号表单
  const [yarnName, setYarnName] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [colorName, setColorName] = useState('');
  const [hex, setHex] = useState('#e74c3c');

  // 新报价表单
  const [quoteShopId, setQuoteShopId] = useState('');
  const [price, setPrice] = useState('');
  const [moq, setMoq] = useState('1');
  const [deliveryDays, setDeliveryDays] = useState('3');
  const [maxQty, setMaxQty] = useState('');
  const [validDays, setValidDays] = useState('30');
  const [quoteNote, setQuoteNote] = useState('');

  const selectedColor = colorList.find((c) => c.id === selectedColorId) ?? null;

  const latestByShop = useMemo(
    () => (selectedColorId ? latestQuotesByShop(quotes, selectedColorId) : new Map()),
    [quotes, selectedColorId]
  );

  const colorQuotes = useMemo(
    () =>
      quotes
        .filter((q) => q.colorId === selectedColorId)
        .slice()
        .sort((a, b) => b.quotedAt - a.quotedAt),
    [quotes, selectedColorId]
  );

  const submitColor = () => {
    if (!yarnName.trim() || !colorCode.trim()) {
      setError('线名和色号都要填');
      return;
    }
    const id = addColor({ yarnName, colorCode, colorName, hex });
    setSelectedColorId(id);
    setYarnName('');
    setColorCode('');
    setColorName('');
    setError('');
  };

  const submitQuote = () => {
    if (!selectedColorId) return;
    if (!quoteShopId) {
      setError('请选择店铺');
      return;
    }
    const err = addQuote({
      shopId: quoteShopId,
      colorId: selectedColorId,
      price: Number(price),
      moq: Number(moq),
      deliveryDays: Number(deliveryDays),
      maxQty: maxQty === '' ? null : Number(maxQty),
      validDays: Number(validDays),
      note: quoteNote,
    });
    if (err) {
      setError(err);
      return;
    }
    setPrice('');
    setMaxQty('');
    setQuoteNote('');
    setError('');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
      {/* 左：色号列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>添加色号</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Field label="线名（同一种线）">
              <input style={inputStyle} value={yarnName} onChange={(e) => setYarnName(e.target.value)} placeholder="如：美丽诺羊毛" />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Field label="色号">
                <input style={{ ...inputStyle, width: 80 }} value={colorCode} onChange={(e) => setColorCode(e.target.value)} placeholder="209" />
              </Field>
              <Field label="颜色名">
                <input style={{ ...inputStyle, width: 90 }} value={colorName} onChange={(e) => setColorName(e.target.value)} placeholder="奶白" />
              </Field>
              <Field label="色卡">
                <input type="color" style={{ ...inputStyle, width: 44, padding: 2, height: 32 }} value={hex} onChange={(e) => setHex(e.target.value)} />
              </Field>
            </div>
            <button style={btnStyle('primary')} onClick={submitColor}>添加色号</button>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>色号（{colorList.length}）</h3>
          {colorList.length === 0 && <div style={{ color: colors.muted, fontSize: 14 }}>先添加一个色号。</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {colorList.map((c) => {
              const active = c.id === selectedColorId;
              const quoteCount = quotes.filter((q) => q.colorId === c.id).length;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedColorId(c.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: `1px solid ${active ? colors.accent : colors.border}`,
                    background: active ? '#eaf4fb' : '#fff',
                    fontSize: 14,
                  }}
                >
                  <ColorLabel color={c} />
                  <span style={{ float: 'right', color: colors.muted, fontSize: 12 }}>{quoteCount} 条报价</span>
                </div>
              );
            })}
          </div>
          {selectedColor && (
            <button
              style={{ ...btnStyle('danger'), marginTop: 10, fontSize: 12 }}
              onClick={() => {
                const err = deleteColor(selectedColor.id);
                if (err) setError(err);
                else setSelectedColorId(null);
              }}
            >
              删除当前色号
            </button>
          )}
        </div>
        {error && <div style={{ color: colors.danger, fontSize: 13 }}>{error}</div>}
      </div>

      {/* 右：选中色号的报价 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!selectedColor ? (
          <div style={{ ...cardStyle, color: colors.muted, fontSize: 14 }}>从左侧选择一个色号，查看各家报价并录入新报价。</div>
        ) : (
          <>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>
                各家最新报价 · <ColorLabel color={selectedColor} />
              </h3>
              {latestByShop.size === 0 ? (
                <div style={{ color: colors.muted, fontSize: 14 }}>还没有任何报价。</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>店铺</th>
                      <th style={thStyle}>单价/团</th>
                      <th style={thStyle}>起订</th>
                      <th style={thStyle}>到货</th>
                      <th style={thStyle}>可供</th>
                      <th style={thStyle}>报价时间</th>
                      <th style={thStyle}>有效期至</th>
                      <th style={thStyle}>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...latestByShop.values()]
                      .sort((a, b) => a.price - b.price)
                      .map((q) => {
                        const shop = shops.find((s) => s.id === q.shopId);
                        const expired = isQuoteExpired(q);
                        return (
                          <tr key={q.id} style={expired ? { opacity: 0.5 } : undefined}>
                            <td style={tdStyle}>{shop?.name ?? '?'}</td>
                            <td style={tdStyle}><b>{fmtMoney(q.price)}</b></td>
                            <td style={tdStyle}>{q.moq} 团</td>
                            <td style={tdStyle}>{q.deliveryDays} 天</td>
                            <td style={tdStyle}>{q.maxQty == null ? '不限' : `${q.maxQty} 团`}</td>
                            <td style={tdStyle}>{fmtDateTime(q.quotedAt)}</td>
                            <td style={tdStyle}>{fmtDateTime(quoteExpireAt(q))}</td>
                            <td style={tdStyle}>{expired ? <Tag color="gray">已过期</Tag> : <Tag color="green">有效</Tag>}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>录入报价</h3>
              {shops.length === 0 ? (
                <div style={{ color: colors.muted, fontSize: 14 }}>先到「店铺」页添加店铺。</div>
              ) : (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <Field label="店铺">
                    <select style={{ ...inputStyle, minWidth: 120 }} value={quoteShopId} onChange={(e) => setQuoteShopId(e.target.value)}>
                      <option value="">选择店铺</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="单价/团（元）">
                    <input style={{ ...inputStyle, width: 90 }} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </Field>
                  <Field label="起订（团）">
                    <input style={{ ...inputStyle, width: 70 }} type="number" min={1} step={1} value={moq} onChange={(e) => setMoq(e.target.value)} />
                  </Field>
                  <Field label="到货（天）">
                    <input style={{ ...inputStyle, width: 70 }} type="number" min={0} step={1} value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} />
                  </Field>
                  <Field label="可供（团，可空）">
                    <input style={{ ...inputStyle, width: 100 }} type="number" min={1} step={1} value={maxQty} onChange={(e) => setMaxQty(e.target.value)} placeholder="空=不限" />
                  </Field>
                  <Field label="有效期（天）">
                    <input style={{ ...inputStyle, width: 80 }} type="number" min={1} step={1} value={validDays} onChange={(e) => setValidDays(e.target.value)} />
                  </Field>
                  <Field label="备注">
                    <input style={{ ...inputStyle, width: 120 }} value={quoteNote} onChange={(e) => setQuoteNote(e.target.value)} placeholder="可空" />
                  </Field>
                  <button style={btnStyle('primary')} onClick={submitQuote}>记下报价</button>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>报价历史（{colorQuotes.length}）</h3>
              {colorQuotes.length === 0 ? (
                <div style={{ color: colors.muted, fontSize: 14 }}>暂无记录。</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>店铺</th>
                      <th style={thStyle}>单价/团</th>
                      <th style={thStyle}>起订</th>
                      <th style={thStyle}>到货</th>
                      <th style={thStyle}>可供</th>
                      <th style={thStyle}>报价时间</th>
                      <th style={thStyle}>状态</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {colorQuotes.map((q) => {
                      const shop = shops.find((s) => s.id === q.shopId);
                      const isLatest = latestByShop.get(q.shopId)?.id === q.id;
                      const expired = isQuoteExpired(q);
                      return (
                        <tr key={q.id} style={!isLatest || expired ? { opacity: 0.55 } : undefined}>
                          <td style={tdStyle}>{shop?.name ?? '?'}</td>
                          <td style={tdStyle}>{fmtMoney(q.price)}</td>
                          <td style={tdStyle}>{q.moq} 团</td>
                          <td style={tdStyle}>{q.deliveryDays} 天</td>
                          <td style={tdStyle}>{q.maxQty == null ? '不限' : `${q.maxQty} 团`}</td>
                          <td style={tdStyle}>{fmtDateTime(q.quotedAt)}</td>
                          <td style={tdStyle}>
                            {isLatest ? (expired ? <Tag color="gray">已过期</Tag> : <Tag color="green">最新有效</Tag>) : <Tag color="gray">已被取代</Tag>}
                          </td>
                          <td style={tdStyle}>
                            <button style={{ ...btnStyle('danger'), fontSize: 12, padding: '2px 8px' }} onClick={() => deleteQuote(q.id)}>删除</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

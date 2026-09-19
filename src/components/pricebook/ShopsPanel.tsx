import { useState } from 'react';
import { usePriceBookStore } from '../../store/priceBookStore';
import { btnStyle, cardStyle, colors, fmtMoney, inputStyle, tdStyle, thStyle } from './styles';
import { Field } from './ui';

export default function ShopsPanel() {
  const shops = usePriceBookStore((s) => s.shops);
  const quotes = usePriceBookStore((s) => s.quotes);
  const orders = usePriceBookStore((s) => s.orders);
  const addShop = usePriceBookStore((s) => s.addShop);
  const updateShop = usePriceBookStore((s) => s.updateShop);
  const deleteShop = usePriceBookStore((s) => s.deleteShop);

  const [name, setName] = useState('');
  const [shippingFee, setShippingFee] = useState('0');
  const [freeShipThreshold, setFreeShipThreshold] = useState('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '', shippingFee: '', freeShipThreshold: '', note: '' });
  const [error, setError] = useState('');

  const submit = () => {
    if (!name.trim()) {
      setError('请填写店名');
      return;
    }
    addShop({
      name,
      shippingFee: Number(shippingFee) || 0,
      freeShipThreshold: freeShipThreshold === '' ? null : Number(freeShipThreshold),
      note,
    });
    setName('');
    setShippingFee('0');
    setFreeShipThreshold('');
    setNote('');
    setError('');
  };

  const startEdit = (id: string) => {
    const shop = shops.find((s) => s.id === id);
    if (!shop) return;
    setEditingId(id);
    setEditDraft({
      name: shop.name,
      shippingFee: String(shop.shippingFee),
      freeShipThreshold: shop.freeShipThreshold == null ? '' : String(shop.freeShipThreshold),
      note: shop.note ?? '',
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (!editDraft.name.trim()) {
      setError('店名不能为空');
      return;
    }
    updateShop(editingId, {
      name: editDraft.name.trim(),
      shippingFee: Math.max(0, Number(editDraft.shippingFee) || 0),
      freeShipThreshold: editDraft.freeShipThreshold === '' ? null : Number(editDraft.freeShipThreshold),
      note: editDraft.note.trim() || undefined,
    });
    setEditingId(null);
    setError('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>添加店铺</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="店名">
            <input style={{ ...inputStyle, width: 140 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="如：毛线小铺" />
          </Field>
          <Field label="运费（元）">
            <input style={{ ...inputStyle, width: 90 }} type="number" min={0} step="0.01" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} />
          </Field>
          <Field label="满多少包邮（可空）">
            <input style={{ ...inputStyle, width: 120 }} type="number" min={0} step="0.01" value={freeShipThreshold} onChange={(e) => setFreeShipThreshold(e.target.value)} placeholder="空=不包邮" />
          </Field>
          <Field label="备注">
            <input style={{ ...inputStyle, width: 160 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="可空" />
          </Field>
          <button style={btnStyle('primary')} onClick={submit}>添加</button>
        </div>
        {error && <div style={{ color: colors.danger, fontSize: 13, marginTop: 8 }}>{error}</div>}
      </div>

      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>店铺列表（{shops.length}）</h3>
        {shops.length === 0 ? (
          <div style={{ color: colors.muted, fontSize: 14 }}>还没有店铺，先添加一家常问的店。</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>店名</th>
                <th style={thStyle}>运费</th>
                <th style={thStyle}>包邮门槛</th>
                <th style={thStyle}>报价数</th>
                <th style={thStyle}>订单数</th>
                <th style={thStyle}>备注</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => (
                <tr key={shop.id}>
                  {editingId === shop.id ? (
                    <>
                      <td style={tdStyle}><input style={{ ...inputStyle, width: 110 }} value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} /></td>
                      <td style={tdStyle}><input style={{ ...inputStyle, width: 70 }} type="number" min={0} step="0.01" value={editDraft.shippingFee} onChange={(e) => setEditDraft({ ...editDraft, shippingFee: e.target.value })} /></td>
                      <td style={tdStyle}><input style={{ ...inputStyle, width: 90 }} type="number" min={0} step="0.01" value={editDraft.freeShipThreshold} onChange={(e) => setEditDraft({ ...editDraft, freeShipThreshold: e.target.value })} placeholder="空=不包邮" /></td>
                      <td style={tdStyle} colSpan={2}></td>
                      <td style={tdStyle}><input style={{ ...inputStyle, width: 120 }} value={editDraft.note} onChange={(e) => setEditDraft({ ...editDraft, note: e.target.value })} /></td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={btnStyle('primary')} onClick={saveEdit}>保存</button>
                          <button style={btnStyle('ghost')} onClick={() => setEditingId(null)}>取消</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={tdStyle}><b>{shop.name}</b></td>
                      <td style={tdStyle}>{fmtMoney(shop.shippingFee)}</td>
                      <td style={tdStyle}>{shop.freeShipThreshold == null ? '不包邮' : `满 ${fmtMoney(shop.freeShipThreshold)} 包邮`}</td>
                      <td style={tdStyle}>{quotes.filter((q) => q.shopId === shop.id).length}</td>
                      <td style={tdStyle}>{orders.filter((o) => o.shopId === shop.id).length}</td>
                      <td style={{ ...tdStyle, color: colors.muted }}>{shop.note ?? '—'}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={btnStyle('outline')} onClick={() => startEdit(shop.id)}>编辑</button>
                          <button
                            style={btnStyle('danger')}
                            onClick={() => {
                              const err = deleteShop(shop.id);
                              setError(err ?? '');
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

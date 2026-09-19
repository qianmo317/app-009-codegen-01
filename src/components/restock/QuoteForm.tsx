import { useState } from 'react';
import { useRestockStore } from '../../store/restockStore';
import { btnPrimary, input, section, sectionTitle } from './styles';

const empty = {
  colorCode: '',
  shopName: '',
  pricePerSkein: '',
  minOrder: '1',
  shippingFee: '0',
  deliveryDays: '7',
  availableQty: '',
  validDays: '30',
};

export default function QuoteForm() {
  const addQuote = useRestockStore((s) => s.addQuote);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    const price = Number(form.pricePerSkein);
    const minOrder = Number(form.minOrder);
    const shipping = Number(form.shippingFee);
    const days = Number(form.deliveryDays);
    const valid = Number(form.validDays);
    const avail = form.availableQty.trim() === '' ? null : Number(form.availableQty);
    if (!form.colorCode.trim()) return setError('色号不能为空');
    if (!form.shopName.trim()) return setError('店家不能为空');
    if (!Number.isFinite(price) || price <= 0) return setError('单价要大于 0');
    if (!Number.isInteger(minOrder) || minOrder < 1) return setError('起订量至少 1 团');
    if (!Number.isFinite(shipping) || shipping < 0) return setError('运费不能为负');
    if (!Number.isInteger(days) || days < 0) return setError('到货天数不能为负');
    if (!Number.isInteger(valid) || valid < 1) return setError('有效期至少 1 天');
    if (avail != null && (!Number.isInteger(avail) || avail < 0)) return setError('可供团数不能为负');
    addQuote({
      colorCode: form.colorCode.trim(),
      shopName: form.shopName.trim(),
      pricePerSkein: price,
      minOrder,
      shippingFee: shipping,
      deliveryDays: days,
      availableQty: avail,
      validDays: valid,
    });
    setError('');
    setForm((f) => ({ ...empty, colorCode: f.colorCode }));
  };

  const fields: { key: keyof typeof empty; label: string; width: number; placeholder?: string }[] = [
    { key: 'colorCode', label: '色号', width: 90, placeholder: '如 804' },
    { key: 'shopName', label: '店家', width: 100, placeholder: '如 小羊家' },
    { key: 'pricePerSkein', label: '单价(元/团)', width: 80 },
    { key: 'minOrder', label: '起订(团)', width: 60 },
    { key: 'shippingFee', label: '运费(元)', width: 60 },
    { key: 'deliveryDays', label: '到货(天)', width: 60 },
    { key: 'availableQty', label: '可供(团)', width: 60, placeholder: '空=不限' },
    { key: 'validDays', label: '有效期(天)', width: 60 },
  ];

  return (
    <div style={section}>
      <h3 style={sectionTitle}>记一笔报价</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
        {fields.map((f) => (
          <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#888' }}>
            {f.label}
            <input
              value={form[f.key]}
              onChange={set(f.key)}
              placeholder={f.placeholder}
              type={f.key === 'colorCode' || f.key === 'shopName' ? 'text' : 'number'}
              style={{ ...input, width: f.width }}
            />
          </label>
        ))}
        <button onClick={submit} style={btnPrimary}>
          记下报价
        </button>
      </div>
      {error && <div style={{ marginTop: 8, fontSize: 12, color: '#e74c3c' }}>{error}</div>}
    </div>
  );
}

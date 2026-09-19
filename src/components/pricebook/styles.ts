import type { CSSProperties } from 'react';

export const colors = {
  accent: '#3498db',
  danger: '#e74c3c',
  ok: '#27ae60',
  warn: '#e67e22',
  muted: '#888',
  border: '#e0dcd5',
  bg: '#fff',
};

export const cardStyle: CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: 16,
  background: colors.bg,
};

export const inputStyle: CSSProperties = {
  padding: '6px 8px',
  border: `1px solid ${colors.border}`,
  borderRadius: 4,
  fontSize: 14,
  background: '#fff',
};

export function btnStyle(variant: 'primary' | 'outline' | 'danger' | 'ghost' = 'outline'): CSSProperties {
  const base: CSSProperties = {
    padding: '6px 14px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    border: `1px solid ${colors.border}`,
    background: '#fff',
    color: '#333',
  };
  if (variant === 'primary') return { ...base, border: `1px solid ${colors.accent}`, background: colors.accent, color: '#fff' };
  if (variant === 'danger') return { ...base, border: `1px solid ${colors.danger}`, color: colors.danger };
  if (variant === 'ghost') return { ...base, border: '1px solid transparent', color: colors.accent };
  return base;
}

export const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: `2px solid ${colors.border}`,
  fontSize: 13,
  color: colors.muted,
  whiteSpace: 'nowrap',
};

export const tdStyle: CSSProperties = {
  padding: '6px 8px',
  borderBottom: `1px solid ${colors.border}`,
  fontSize: 14,
  verticalAlign: 'middle',
};

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtMoney(n: number): string {
  return `¥${n.toFixed(2)}`;
}

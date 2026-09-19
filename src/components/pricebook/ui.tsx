import type { ReactNode } from 'react';
import type { YarnColor } from '../../types/priceBook';
import { colors } from './styles';

const tagColors: Record<string, { fg: string; bg: string }> = {
  blue: { fg: '#2980b9', bg: '#eaf4fb' },
  green: { fg: '#1e8449', bg: '#e9f7ef' },
  orange: { fg: '#ca6f1e', bg: '#fdf2e9' },
  red: { fg: '#c0392b', bg: '#fdedec' },
  gray: { fg: '#777', bg: '#f0eeea' },
};

export function Tag({ color, children }: { color: keyof typeof tagColors; children: ReactNode }) {
  const c = tagColors[color];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: 10,
        fontSize: 12,
        color: c.fg,
        background: c.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/** 色号展示：色卡点 + 线名 + 色号 */
export function ColorLabel({ color }: { color: YarnColor }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {color.hex && (
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: color.hex,
            border: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}
        />
      )}
      <span>
        {color.yarnName} <b>{color.colorCode}</b>
        {color.colorName ? `（${color.colorName}）` : ''}
      </span>
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: colors.muted }}>
      {label}
      {children}
    </label>
  );
}

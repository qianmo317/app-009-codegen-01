import type { CSSProperties } from 'react';

export const section: CSSProperties = {
  background: '#fff',
  border: '1px solid #e0dcd5',
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};

export const sectionTitle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 15,
  fontWeight: 600,
};

export const input: CSSProperties = {
  padding: '6px 8px',
  fontSize: 12,
  border: '1px solid #d5d0c8',
  borderRadius: 4,
  background: '#fff',
};

export const btnPrimary: CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  borderRadius: 4,
  border: '1px solid #3498db',
  background: '#3498db',
  color: '#fff',
  cursor: 'pointer',
};

export const btnGhost: CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  borderRadius: 4,
  border: '1px solid #bdc3c7',
  background: '#fff',
  color: '#555',
  cursor: 'pointer',
};

export const btnDanger: CSSProperties = {
  ...btnGhost,
  border: '1px solid #e74c3c',
  color: '#e74c3c',
};

export const table: CSSProperties = {
  width: '100%',
  fontSize: 12,
  borderCollapse: 'collapse',
};

export const th: CSSProperties = {
  textAlign: 'left',
  padding: '4px 6px',
  borderBottom: '1px solid #e0dcd5',
  color: '#888',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

export const td: CSSProperties = {
  padding: '4px 6px',
  borderBottom: '1px solid #f0eeea',
  whiteSpace: 'nowrap',
};

export function badge(color: string): CSSProperties {
  return {
    display: 'inline-block',
    padding: '1px 8px',
    fontSize: 11,
    borderRadius: 10,
    border: `1px solid ${color}`,
    color,
    background: '#fff',
  };
}

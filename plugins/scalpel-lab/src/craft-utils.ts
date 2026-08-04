import type { CSSProperties } from 'react'

export function pct(n: number): string {
  return `${(n * 100).toFixed(n >= 0.01 ? 1 : n >= 0.001 ? 2 : 3)}%`
}

export function matchesSearch(query: string, ...fields: Array<string | undefined>): boolean {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  const hay = fields.filter(Boolean).join(' ').toLowerCase()
  return hay.includes(q)
}

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.25)',
  color: 'inherit',
  fontSize: 12,
}

export const selectStyle: CSSProperties = {
  padding: '7px 10px',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.35)',
  color: 'inherit',
  fontSize: 12,
}

export const tabStyle = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.12)',
  background: active ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.2)',
  color: 'inherit',
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
})

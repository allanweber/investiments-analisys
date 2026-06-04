export function toDateInputValue(v: unknown): string {
  if (v == null) return ''
  const d = v instanceof Date ? v : new Date(String(v))
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function fmtQuantity(q: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(q)
}

export function parseAdditionalQty(raw: string): number {
  const s = raw.replace(/\s/g, '').replace(',', '.')
  if (!s) return 0
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

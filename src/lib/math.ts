export function normalizeHoldingCurrency(c: string | null | undefined): string | null {
  const t = (c ?? '').trim().toUpperCase()
  return t.length ? t : null
}

export function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}

export function num(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) return n
  if (typeof n === 'string') {
    const v = Number(n)
    return Number.isFinite(v) ? v : 0
  }
  return 0
}

export function toMoney(n: number): number {
  return Number.isFinite(n) ? n : 0
}

export function computePct(part: number, total: number): number {
  if (total <= 0) return 0
  return (part / total) * 100
}

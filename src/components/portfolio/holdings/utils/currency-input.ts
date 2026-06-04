export type MoneyPartsMeta = {
  locale: string
  decimal: string
  group: string
  currencySymbol: string
}

export function localeForCurrency(currency: string): string {
  if (currency === 'BRL') return 'pt-BR'
  if (currency === 'EUR') return 'de-DE'
  return 'en-US'
}

export function moneyMeta(currency: string): MoneyPartsMeta {
  const locale = localeForCurrency(currency)
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(1234567.89)
    return {
      locale,
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
      currencySymbol: (parts.find((p) => p.type === 'currency')?.value ?? '').trim(),
    }
  } catch {
    return { locale: 'en-US', decimal: '.', group: ',', currencySymbol: '' }
  }
}

export function round2(n: number): number {
  const x = Number.isFinite(n) ? n : 0
  return Math.round(Math.max(0, x) * 100) / 100
}

export function formatCurrencyFixed2(n: number, currency: string): string {
  const locale = localeForCurrency(currency)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(round2(n))
  } catch {
    return `${round2(n).toFixed(2)} ${currency}`
  }
}

export function sanitizeAvgCostTyping(raw: string, meta: MoneyPartsMeta): string {
  let s = raw.replace(/ /g, ' ')
  if (meta.currencySymbol) {
    const esc = meta.currencySymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    s = s.replace(new RegExp(esc, 'g'), '')
  }
  s = s.replace(/\s/g, '').replaceAll(meta.group, '').replace(/-/g, '')

  const d = meta.decimal
  const filtered = [...s].filter((ch) => (ch >= '0' && ch <= '9') || ch === d).join('')
  const first = filtered.indexOf(d)
  if (first === -1) {
    if (filtered.length > 14) return filtered.slice(0, 14)
    return filtered
  }
  const intPart = filtered.slice(0, first).replace(/\D/g, '').slice(0, 12)
  const fracPart = filtered
    .slice(first + 1)
    .replace(/\D/g, '')
    .slice(0, 2)
  return `${intPart}${d}${fracPart}`
}

export function parseAvgCostDraft(draft: string, meta: MoneyPartsMeta): number {
  const d = meta.decimal
  const s = draft.trim()
  if (!s) return 0
  const di = s.indexOf(d)
  if (di === -1) {
    const intPart = s.replace(/\D/g, '').slice(0, 12)
    const whole = intPart === '' ? 0 : parseInt(intPart, 10)
    return round2(whole)
  }
  const intPart = s.slice(0, di).replace(/\D/g, '').slice(0, 12)
  const frac = s.slice(di + d.length).replace(/\D/g, '').slice(0, 2)
  const whole = intPart === '' ? 0 : parseInt(intPart, 10)
  const fracVal = frac.length ? parseInt(frac, 10) / 10 ** frac.length : 0
  return round2(whole + fracVal)
}

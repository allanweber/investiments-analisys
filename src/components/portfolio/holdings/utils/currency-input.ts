function localeForCurrency(currency: string): string {
  if (currency === 'BRL') return 'pt-BR'
  if (currency === 'EUR') return 'de-DE'
  return 'en-US'
}

export function round2(n: number): number {
  const x = Number.isFinite(n) ? n : 0
  return Math.round(Math.max(0, x) * 100) / 100
}

export function formatCurrencyFixed(n: number, currency: string): string {
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

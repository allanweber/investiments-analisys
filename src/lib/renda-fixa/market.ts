import { buildTaxBreakdown } from './core'

export type TreasuryPrefixadoMtmInput = {
  capital: number
  contractedAnnualRate: number
  marketAnnualRate: number
  daysToMaturity: number
  daysPassed: number
  hasIof?: boolean
  isTaxExempt?: boolean
}

export type TreasuryIpcaMtmInput = {
  capital: number
  contractedRealAnnualRate: number
  marketRealAnnualRate: number
  daysToMaturity: number
  daysPassed: number
  vnaCurrent: number
  vnaBase?: number
  hasIof?: boolean
  isTaxExempt?: boolean
}

/** Calculates Treasury fixed-rate mark-to-market redemption values. */
export function calculateTreasuryFixedRateMtm(input: TreasuryPrefixadoMtmInput) {
  const daysRemaining = Math.max(input.daysToMaturity - input.daysPassed, 0)
  const purchasePrice = 1000 / (1 + input.contractedAnnualRate) ** (input.daysToMaturity / 365)
  const marketPrice = 1000 / (1 + input.marketAnnualRate) ** (daysRemaining / 365)
  const units = input.capital / purchasePrice
  const grossAmount = units * marketPrice

  return {
    ...buildTaxBreakdown({
      capital: input.capital,
      grossAmount,
      calendarDays: input.daysPassed,
      hasIof: input.hasIof ?? true,
      isTaxExempt: input.isTaxExempt ?? false,
    }),
    purchasePrice,
    marketPrice,
    units,
    daysRemaining,
  }
}

/** Calculates Treasury IPCA mark-to-market redemption values. */
export function calculateTreasuryIpcaMtm(input: TreasuryIpcaMtmInput) {
  const daysRemaining = Math.max(input.daysToMaturity - input.daysPassed, 0)
  const vnaBase = input.vnaBase ?? 1000
  const purchasePrice = vnaBase / (1 + input.contractedRealAnnualRate) ** (input.daysToMaturity / 365)
  const marketPrice = input.vnaCurrent / (1 + input.marketRealAnnualRate) ** (daysRemaining / 365)
  const units = input.capital / purchasePrice
  const grossAmount = units * marketPrice

  return {
    ...buildTaxBreakdown({
      capital: input.capital,
      grossAmount,
      calendarDays: input.daysPassed,
      hasIof: input.hasIof ?? true,
      isTaxExempt: input.isTaxExempt ?? false,
    }),
    purchasePrice,
    marketPrice,
    units,
    daysRemaining,
    vnaCurrent: input.vnaCurrent,
  }
}

import { buildTaxBreakdown, roundMoney } from './core'

export type TreasuryMtmInput =
  | {
      kind: 'fixed-rate'
      capital: number
      contractedAnnualRate: number
      marketAnnualRate: number
      daysToMaturity: number
      daysPassed: number
      hasIof?: boolean
      isTaxExempt?: boolean
    }
  | {
      kind: 'indexed'
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

/** Calculates Treasury mark-to-market redemption values. */
export function calculateTreasuryMtm(input: TreasuryMtmInput) {
  const daysRemaining = Math.max(input.daysToMaturity - input.daysPassed, 0)

  if (input.kind === 'fixed-rate') {
    const purchasePrice = roundMoney(1000 / (1 + input.contractedAnnualRate) ** (input.daysToMaturity / 365))
    const marketPrice = roundMoney(1000 / (1 + input.marketAnnualRate) ** (daysRemaining / 365))
    const units = input.capital / purchasePrice
    const grossAmount = roundMoney(units * marketPrice)

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

  const vnaBase = input.vnaBase ?? 1000
  const purchasePrice = roundMoney(vnaBase / (1 + input.contractedRealAnnualRate) ** (input.daysToMaturity / 365))
  const marketPrice = roundMoney(input.vnaCurrent / (1 + input.marketRealAnnualRate) ** (daysRemaining / 365))
  const units = input.capital / purchasePrice
  const grossAmount = roundMoney(units * marketPrice)

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

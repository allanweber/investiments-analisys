import { buildTaxBreakdown, compoundByAnnualRate, type TaxedReturn } from './core'

export type FixedRateInvestmentInput = {
  capital: number
  annualRate: number
  calendarDays: number
  hasIof?: boolean
  isTaxExempt?: boolean
}

/** Calculates a fixed-rate investment using calendar-day compounding. */
export function calculateFixedRateInvestment(input: FixedRateInvestmentInput): TaxedReturn {
  const grossAmount = compoundByAnnualRate(input.capital, input.annualRate, input.calendarDays)
  return buildTaxBreakdown({
    capital: input.capital,
    grossAmount,
    calendarDays: input.calendarDays,
    hasIof: input.hasIof ?? true,
    isTaxExempt: input.isTaxExempt ?? false,
  })
}

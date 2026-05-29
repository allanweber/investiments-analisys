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

/** Calculates an early redemption scenario for a fixed-rate product. */
export function calculateFixedRateEarlyRedemption(input: FixedRateInvestmentInput): TaxedReturn {
  return calculateFixedRateInvestment(input)
}

/** Calculates a taxable CDB fixed-rate investment. */
export function calculateFixedRateCdbInvestment(
  input: Omit<FixedRateInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateFixedRateInvestment({ ...input, hasIof: true, isTaxExempt: false })
}

/** Calculates a tax-exempt LCI fixed-rate investment. */
export function calculateFixedRateLciInvestment(
  input: Omit<FixedRateInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateFixedRateInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a tax-exempt LCA fixed-rate investment. */
export function calculateFixedRateLcaInvestment(
  input: Omit<FixedRateInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateFixedRateInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a tax-exempt CRI fixed-rate investment. */
export function calculateFixedRateCriInvestment(
  input: Omit<FixedRateInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateFixedRateInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a tax-exempt CRA fixed-rate investment. */
export function calculateFixedRateCraInvestment(
  input: Omit<FixedRateInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateFixedRateInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a taxable Treasury fixed-rate investment. */
export function calculateTreasuryFixedRateInvestment(
  input: Omit<FixedRateInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateFixedRateInvestment({ ...input, hasIof: true, isTaxExempt: false })
}

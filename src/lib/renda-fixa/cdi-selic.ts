import {
  annualRateToDailyRate,
  buildTaxBreakdown,
  compoundByDailyRate,
  compoundChain,
  type CompoundChainPeriod,
  type TaxedReturn,
} from './core'

export type CdiInvestmentInput = {
  capital: number
  annualCdiRate: number
  cdiMultiplier: number
  businessDays: number
  calendarDays: number
  hasIof?: boolean
  isTaxExempt?: boolean
}

export type SelicInvestmentInput = {
  capital: number
  annualSelicRate: number
  businessDays: number
  calendarDays: number
  hasIof?: boolean
  isTaxExempt?: boolean
}

export type VariableCdiSelicPeriod = CompoundChainPeriod & {
  cdiMultiplier?: number
}

export type VariableCdiSelicInvestmentInput = {
  capital: number
  periods: readonly VariableCdiSelicPeriod[]
  calendarDays: number
  hasIof?: boolean
  isTaxExempt?: boolean
}

/** Calculates a CDI-based investment using a constant annual CDI rate. */
export function calculateCdiInvestment(input: CdiInvestmentInput): TaxedReturn {
  const dailyRate = annualRateToDailyRate(input.annualCdiRate) * input.cdiMultiplier
  const grossAmount = compoundByDailyRate(input.capital, dailyRate, input.businessDays)
  return buildTaxBreakdown({
    capital: input.capital,
    grossAmount,
    calendarDays: input.calendarDays,
    hasIof: input.hasIof ?? true,
    isTaxExempt: input.isTaxExempt ?? false,
  })
}

/** Calculates a Selic-based investment using a constant annual Selic rate. */
export function calculateSelicInvestment(input: SelicInvestmentInput): TaxedReturn {
  const dailyRate = annualRateToDailyRate(input.annualSelicRate)
  const grossAmount = compoundByDailyRate(input.capital, dailyRate, input.businessDays)
  return buildTaxBreakdown({
    capital: input.capital,
    grossAmount,
    calendarDays: input.calendarDays,
    hasIof: input.hasIof ?? true,
    isTaxExempt: input.isTaxExempt ?? false,
  })
}

/** Calculates a CDI/Selic investment with multiple chained periods. */
export function calculateVariableCdiSelicInvestment(
  input: VariableCdiSelicInvestmentInput,
): TaxedReturn {
  const grossAmount = compoundChain(
    input.capital,
    input.periods.map((period) => ({
      annualRate: period.annualRate,
      businessDays: period.businessDays,
      multiplier: period.cdiMultiplier ?? period.multiplier ?? 1,
    })),
  )

  return buildTaxBreakdown({
    capital: input.capital,
    grossAmount,
    calendarDays: input.calendarDays,
    hasIof: input.hasIof ?? true,
    isTaxExempt: input.isTaxExempt ?? false,
  })
}

/** Calculates a taxable CDB indexed to CDI. */
export function calculateCdbFromCdiInvestment(
  input: Omit<CdiInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateCdiInvestment({ ...input, hasIof: true, isTaxExempt: false })
}

/** Calculates a tax-exempt LCI indexed to CDI. */
export function calculateLciFromCdiInvestment(
  input: Omit<CdiInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateCdiInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a tax-exempt LCA indexed to CDI. */
export function calculateLcaFromCdiInvestment(
  input: Omit<CdiInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateCdiInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a tax-exempt CRI indexed to CDI. */
export function calculateCriFromCdiInvestment(
  input: Omit<CdiInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateCdiInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a tax-exempt CRA indexed to CDI. */
export function calculateCraFromCdiInvestment(
  input: Omit<CdiInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateCdiInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a taxable Treasury Selic investment. */
export function calculateTreasurySelicInvestment(
  input: Omit<SelicInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): TaxedReturn {
  return calculateSelicInvestment({ ...input, hasIof: true, isTaxExempt: false })
}

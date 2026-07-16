import {
  annualRateToDailyRate,
  buildTaxBreakdown,
  compoundByDailyRate,
  compoundChain,
} from './core'
import type { CompoundChainPeriod, TaxedReturn } from './core'

export type DailyRateInvestmentInput = {
  capital: number
  annualRate: number
  businessDays: number
  calendarDays: number
  multiplier?: number
  hasIof?: boolean
  isTaxExempt?: boolean
}

export type VariableDailyRateInvestmentInput = {
  capital: number
  periods: readonly CompoundChainPeriod[]
  calendarDays: number
  hasIof?: boolean
  isTaxExempt?: boolean
}

/** Calculates a daily-rate investment using an annual rate and optional multiplier. */
export function calculateDailyRateInvestment(
  input: DailyRateInvestmentInput,
): TaxedReturn {
  const dailyRate =
    annualRateToDailyRate(input.annualRate) * (input.multiplier ?? 1)
  const grossAmount = compoundByDailyRate(
    input.capital,
    dailyRate,
    input.businessDays,
  )
  return buildTaxBreakdown({
    capital: input.capital,
    grossAmount,
    calendarDays: input.calendarDays,
    hasIof: input.hasIof ?? true,
    isTaxExempt: input.isTaxExempt ?? false,
  })
}

/** Calculates a daily-rate investment with multiple chained periods. */
export function calculateVariableDailyRateInvestment(
  input: VariableDailyRateInvestmentInput,
): TaxedReturn {
  const grossAmount = compoundChain(input.capital, input.periods)

  return buildTaxBreakdown({
    capital: input.capital,
    grossAmount,
    calendarDays: input.calendarDays,
    hasIof: input.hasIof ?? true,
    isTaxExempt: input.isTaxExempt ?? false,
  })
}

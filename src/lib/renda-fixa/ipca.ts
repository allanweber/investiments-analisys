import {
  annualRateToDailyRate,
  buildAccumulatedIndexFactor,
  buildTaxBreakdown,
  compoundByDailyRate,
  roundMoney,
  type TaxedReturn,
} from './core'

export type IndexedInvestmentInput = {
  capital: number
  indexRate?: number
  monthlyRates?: readonly number[]
  realAnnualRate: number
  businessDays: number
  calendarDays: number
  hasIof?: boolean
  isTaxExempt?: boolean
}

export type IndexedMtmInput = {
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

/** Calculates an indexed investment using either a fixed index rate or monthly chained rates. */
export function calculateIndexedInvestment(input: IndexedInvestmentInput): TaxedReturn & {
  indexFactor: number
  realFactor: number
  vnaFinal: number
} {
  const indexFactor = input.monthlyRates
    ? buildAccumulatedIndexFactor(input.monthlyRates)
    : 1 + (input.indexRate ?? 0)
  const realFactor = compoundByDailyRate(
    1,
    annualRateToDailyRate(input.realAnnualRate),
    input.businessDays,
  )
  const vnaFinal = input.capital * indexFactor
  const grossAmount = vnaFinal * realFactor

  return {
    ...buildTaxBreakdown({
      capital: input.capital,
      grossAmount,
      calendarDays: input.calendarDays,
      hasIof: input.hasIof ?? true,
      isTaxExempt: input.isTaxExempt ?? false,
    }),
    indexFactor,
    realFactor,
    vnaFinal: roundMoney(vnaFinal),
  }
}

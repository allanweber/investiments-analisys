import {
  annualRateToDailyRate,
  buildAccumulatedIndexFactor,
  buildTaxBreakdown,
  compoundByDailyRate,
  type TaxedReturn,
} from './core'

export type IndexedInvestmentInput = {
  capital: number
  indexRate: number
  realAnnualRate: number
  businessDays: number
  calendarDays: number
  hasIof?: boolean
  isTaxExempt?: boolean
}

export type VariableIndexedInvestmentInput = {
  capital: number
  monthlyRates: readonly number[]
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

/** Calculates a fixed IPCA+ investment using the provided index and real rate. */
export function calculateIpcaPlusInvestment(input: IndexedInvestmentInput): TaxedReturn & {
  indexFactor: number
  realFactor: number
  vnaFinal: number
} {
  const indexFactor = 1 + input.indexRate
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
    vnaFinal,
  }
}

/** Calculates a fixed IGPM+ investment using the provided index and real rate. */
export function calculateIgpmPlusInvestment(input: IndexedInvestmentInput): TaxedReturn & {
  indexFactor: number
  realFactor: number
  vnaFinal: number
} {
  return calculateIpcaPlusInvestment(input)
}

/** Calculates an IPCA investment with monthly index chaining. */
export function calculateVariableIpcaInvestment(input: VariableIndexedInvestmentInput): TaxedReturn & {
  indexFactor: number
  realFactor: number
  vnaFinal: number
} {
  const indexFactor = buildAccumulatedIndexFactor(input.monthlyRates)
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
    vnaFinal,
  }
}

/** Calculates a taxable CDB indexed to IPCA. */
export function calculateCdbFromIpcaInvestment(
  input: Omit<IndexedInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): ReturnType<typeof calculateIpcaPlusInvestment> {
  return calculateIpcaPlusInvestment({ ...input, hasIof: true, isTaxExempt: false })
}

/** Calculates a tax-exempt LCI indexed to IPCA. */
export function calculateLciFromIpcaInvestment(
  input: Omit<IndexedInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): ReturnType<typeof calculateIpcaPlusInvestment> {
  return calculateIpcaPlusInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a tax-exempt LCA indexed to IPCA. */
export function calculateLcaFromIpcaInvestment(
  input: Omit<IndexedInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): ReturnType<typeof calculateIpcaPlusInvestment> {
  return calculateIpcaPlusInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a tax-exempt CRI indexed to IPCA. */
export function calculateCriFromIpcaInvestment(
  input: Omit<IndexedInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): ReturnType<typeof calculateIpcaPlusInvestment> {
  return calculateIpcaPlusInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a tax-exempt CRA indexed to IPCA. */
export function calculateCraFromIpcaInvestment(
  input: Omit<IndexedInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): ReturnType<typeof calculateIpcaPlusInvestment> {
  return calculateIpcaPlusInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a tax-exempt CRA indexed to IGPM. */
export function calculateCraFromIgpmInvestment(
  input: Omit<IndexedInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): ReturnType<typeof calculateIgpmPlusInvestment> {
  return calculateIgpmPlusInvestment({ ...input, hasIof: false, isTaxExempt: true })
}

/** Calculates a taxable Treasury indexed to IPCA. */
export function calculateTreasuryIpcaInvestment(
  input: Omit<IndexedInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): ReturnType<typeof calculateIpcaPlusInvestment> {
  return calculateIpcaPlusInvestment({ ...input, hasIof: true, isTaxExempt: false })
}

/** Calculates the accumulation phase for Treasury Income A using IPCA+ rules. */
export function calculateTreasuryIncomeAAccumulation(
  input: Omit<IndexedInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): ReturnType<typeof calculateIpcaPlusInvestment> {
  return calculateTreasuryIpcaInvestment(input)
}

/** Calculates the accumulation phase for Treasury Education using IPCA+ rules. */
export function calculateTreasuryEducationAccumulation(
  input: Omit<IndexedInvestmentInput, 'hasIof' | 'isTaxExempt'>,
): ReturnType<typeof calculateIpcaPlusInvestment> {
  return calculateTreasuryIpcaInvestment(input)
}

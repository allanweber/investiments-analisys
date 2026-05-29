export type TaxBreakdown = {
  hasIof: boolean
  isTaxExempt: boolean
  iofRate: number
  iofBase: number
  irRate: number
  irBase: number
}

export type TaxedReturn = {
  capital: number
  grossAmount: number
  grossProfit: number
  grossRate: number
  iof: number
  ir: number
  netAmount: number
  netProfit: number
  netRate: number
  calendarDays: number
  taxBreakdown: TaxBreakdown
}

export type CompoundChainPeriod = {
  annualRate: number
  businessDays: number
  multiplier?: number
}

const IR_TABLE = [
  { min: 1, max: 180, rate: 0.225 },
  { min: 181, max: 360, rate: 0.2 },
  { min: 361, max: 720, rate: 0.175 },
  { min: 721, max: Number.POSITIVE_INFINITY, rate: 0.15 },
] as const

const IOF_TABLE: Record<number, number> = {
  1: 0.96,
  2: 0.93,
  3: 0.9,
  4: 0.86,
  5: 0.83,
  6: 0.8,
  7: 0.76,
  8: 0.73,
  9: 0.7,
  10: 0.66,
  11: 0.63,
  12: 0.6,
  13: 0.56,
  14: 0.53,
  15: 0.5,
  16: 0.46,
  17: 0.43,
  18: 0.4,
  19: 0.36,
  20: 0.33,
  21: 0.3,
  22: 0.26,
  23: 0.23,
  24: 0.2,
  25: 0.16,
  26: 0.13,
  27: 0.1,
  28: 0.06,
  29: 0.03,
}

/** Returns the Brazilian income tax rate for a holding period in calendar days. */
export function getIrRateByDays(calendarDays: number): number {
  if (!Number.isFinite(calendarDays) || calendarDays <= 0) return 0
  for (const band of IR_TABLE) {
    if (calendarDays >= band.min && calendarDays <= band.max) return band.rate
  }
  return 0
}

/** Returns the IOF rate for redemptions within the first 29 calendar days. */
export function getIofRateByDays(calendarDays: number): number {
  if (!Number.isFinite(calendarDays) || calendarDays < 1) return 0
  if (calendarDays >= 30) return 0
  return IOF_TABLE[Math.trunc(calendarDays)] ?? 0
}

/** Converts an annual rate to an equivalent daily rate using the given base. */
export function annualRateToDailyRate(annualRate: number, baseDays = 252): number {
  return (1 + annualRate) ** (1 / baseDays) - 1
}

/** Compounds a principal using an annual rate over calendar days. */
export function compoundByAnnualRate(
  capital: number,
  annualRate: number,
  calendarDays: number,
  baseDays = 365,
): number {
  return capital * (1 + annualRate) ** (calendarDays / baseDays)
}

/** Compounds a principal using a daily rate over business days. */
export function compoundByDailyRate(capital: number, dailyRate: number, businessDays: number): number {
  return capital * (1 + dailyRate) ** businessDays
}

/** Compounds multiple periods by chaining each daily factor in sequence. */
export function compoundChain(
  capital: number,
  periods: readonly CompoundChainPeriod[],
  baseDays = 252,
): number {
  let amount = capital
  for (const period of periods) {
    if (!Number.isFinite(period.annualRate) || !Number.isFinite(period.businessDays) || period.businessDays <= 0) {
      continue
    }
    const dailyRate = annualRateToDailyRate(period.annualRate, baseDays) * (period.multiplier ?? 1)
    amount *= (1 + dailyRate) ** period.businessDays
  }
  return amount
}

/** Multiplies monthly index rates into a single accumulated factor. */
export function buildAccumulatedIndexFactor(monthlyRates: readonly number[]): number {
  let factor = 1
  for (const rate of monthlyRates) {
    if (!Number.isFinite(rate)) continue
    factor *= 1 + rate
  }
  return factor
}

export function buildTaxBreakdown(input: {
  capital: number
  grossAmount: number
  calendarDays: number
  hasIof?: boolean
  isTaxExempt?: boolean
}): TaxedReturn {
  const capital = input.capital
  const grossAmount = input.grossAmount
  const calendarDays = input.calendarDays
  const hasIof = input.hasIof ?? true
  const isTaxExempt = input.isTaxExempt ?? false

  const grossProfit = grossAmount - capital
  const grossRate = capital !== 0 ? grossProfit / capital : 0

  const iofRate = hasIof ? getIofRateByDays(calendarDays) : 0
  const iofBase = grossProfit > 0 ? grossProfit : 0
  const iof = iofBase * iofRate

  const irRate = isTaxExempt || grossProfit <= 0 ? 0 : getIrRateByDays(calendarDays)
  const irBase = grossProfit > 0 ? grossProfit - iof : 0
  const ir = irBase * irRate

  const netAmount = grossAmount - iof - ir
  const netProfit = netAmount - capital
  const netRate = capital !== 0 ? netProfit / capital : 0

  return {
    capital,
    grossAmount,
    grossProfit,
    grossRate,
    iof,
    ir,
    netAmount,
    netProfit,
    netRate,
    calendarDays,
    taxBreakdown: {
      hasIof,
      isTaxExempt,
      iofRate,
      iofBase,
      irRate,
      irBase,
    },
  }
}

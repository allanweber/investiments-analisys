import { describe, expect, it } from 'vitest'

import { computeGrowthCheck, computeLevelCheck } from '@/lib/fundamentals/checks'
import type { MetricPoint } from '@/lib/fundamentals/checks'

function point(fiscalYear: number, value: number | null): MetricPoint {
  return { fiscalYear, value }
}

describe('computeLevelCheck', () => {
  it('returns null when there is no data', () => {
    expect(computeLevelCheck([point(2020, null)], 'gt', 5, null)).toEqual({
      pass: null,
      detail: 'Sem dados disponíveis para este indicador.',
    })
  })

  it('passes when the value clears the bar in every available year (gt)', () => {
    const series = [point(2020, 6), point(2021, 8)]
    expect(computeLevelCheck(series, 'gt', 5, null).pass).toBe(true)
  })

  it('fails when the value dips below the bar in any year (gt)', () => {
    const series = [point(2020, 6), point(2021, 3)]
    expect(computeLevelCheck(series, 'gt', 5, null).pass).toBe(false)
  })

  it('passes when the value stays below the bar every year (lt)', () => {
    const series = [point(2023, 1.5), point(2024, 1.8)]
    expect(computeLevelCheck(series, 'lt', 2, null).pass).toBe(true)
  })

  it('fails when the value exceeds the bar in any year (lt)', () => {
    const series = [point(2023, 1.5), point(2024, 2.5)]
    expect(computeLevelCheck(series, 'lt', 2, null).pass).toBe(false)
  })

  it('only considers the last windowYears', () => {
    const series = [point(2010, 10), point(2024, 1.0)]
    expect(computeLevelCheck(series, 'lt', 2, 1).pass).toBe(true)
  })
})

describe('computeGrowthCheck', () => {
  it('returns null with fewer than 2 years of history', () => {
    expect(computeGrowthCheck([point(2024, 100)], 'gt', 5, null).pass).toBe(null)
  })

  it('passes when growth clears the bar every year', () => {
    const series = [point(2022, 100), point(2023, 110), point(2024, 130)]
    expect(computeGrowthCheck(series, 'gt', 5, null).pass).toBe(true)
  })

  it('fails when growth misses the bar in some year', () => {
    const series = [point(2022, 100), point(2023, 101)]
    expect(computeGrowthCheck(series, 'gt', 5, null).pass).toBe(false)
  })

  it('only considers the last windowYears + 1 years', () => {
    const series = [
      point(2010, 100),
      point(2011, 1), // huge drop, outside window
      point(2022, 100),
      point(2023, 110),
    ]
    expect(computeGrowthCheck(series, 'gt', 1, 1).pass).toBe(true)
  })
})

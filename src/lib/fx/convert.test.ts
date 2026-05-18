import { describe, expect, it } from 'vitest'

import { buildRateMatrix, convertMoney, findMissingFxPairs, getFxRate } from './convert'

const rows = [
  { baseCurrency: 'USD', quoteCurrency: 'BRL', rate: 5 },
  { baseCurrency: 'EUR', quoteCurrency: 'BRL', rate: 6 },
  { baseCurrency: 'EUR', quoteCurrency: 'USD', rate: 1.2 },
]

describe('convertMoney', () => {
  const matrix = buildRateMatrix(rows)

  it('returns same amount for identity', () => {
    expect(convertMoney(100, 'BRL', 'BRL', matrix)).toEqual({ value: 100, rate: 1 })
  })

  it('converts using direct pair', () => {
    expect(convertMoney(10, 'USD', 'BRL', matrix).value).toBe(50)
  })

  it('converts using inverse pair', () => {
    const r = convertMoney(50, 'BRL', 'USD', matrix)
    expect(r.value).toBeCloseTo(10, 8)
  })

  it('triangulates via BRL when direct pair missing', () => {
    const rate = getFxRate(matrix, 'USD', 'EUR')
    expect(rate).toBeCloseTo(5 / 6, 8)
    expect(convertMoney(60, 'EUR', 'USD', matrix).value).toBeCloseTo(72, 4)
  })

  it('returns null when conversion impossible', () => {
    const empty = buildRateMatrix([])
    expect(convertMoney(1, 'USD', 'BRL', empty).value).toBeNull()
  })
})

describe('findMissingFxPairs', () => {
  it('lists pairs that cannot be converted', () => {
    const matrix = buildRateMatrix([{ baseCurrency: 'USD', quoteCurrency: 'BRL', rate: 5 }])
    expect(findMissingFxPairs(['USD', 'EUR'], 'BRL', matrix)).toEqual(['EUR->BRL'])
  })
})

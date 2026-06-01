import { describe, expect, it, vi, beforeEach } from 'vitest'

import * as http from '../http'
import { fetchBcbRates } from './bcb'

vi.mock('../http', () => ({
  fetchJson: vi.fn(),
  asNumber: (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    return null
  },
}))

const mockFetchJson = vi.mocked(http.fetchJson)

describe('fetchBcbRates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses selic, cdi, ipca, igpm correctly', async () => {
    // Selic: 10.50 %/ano
    const selicEntries = [{ data: '01/05/2025', valor: '10.50' }]
    // CDI: 0.040417 %/dia (roughly (1.105)^(1/252)-1 * 100)
    const cdiDailyPct = ((1.105) ** (1 / 252) - 1) * 100
    const cdiEntries = Array.from({ length: 252 }, () => ({ data: '01/05/2025', valor: String(cdiDailyPct) }))
    // IPCA: 12 months around 0.4% each
    const ipcaEntries = Array.from({ length: 12 }, (_, idx) => ({
      data: `01/${String(idx + 1).padStart(2, '0')}/2025`,
      valor: '0.40',
    }))
    // IGPM: 12 months around 0.3% each
    const igpmEntries = Array.from({ length: 12 }, (_, idx) => ({
      data: `01/${String(idx + 1).padStart(2, '0')}/2025`,
      valor: '0.30',
    }))

    mockFetchJson
      .mockResolvedValueOnce(selicEntries)  // selic
      .mockResolvedValueOnce(cdiEntries)    // cdi
      .mockResolvedValueOnce(ipcaEntries)   // ipca
      .mockResolvedValueOnce(igpmEntries)   // igpm

    const rates = await fetchBcbRates()

    expect(rates.selicAnnual).toBeCloseTo(0.105, 4)
    // CDI annual should be close to 10.5% when compounded
    expect(rates.cdiAnnual).toBeCloseTo(0.105, 2)
    expect(rates.ipcaMonthly).toHaveLength(12)
    // Each monthly rate is 0.40/100 = 0.004
    expect(rates.ipcaMonthly[0]).toBeCloseTo(0.004, 4)
    // Accumulated IPCA: (1.004)^12 - 1 ≈ 0.04908
    expect(rates.ipcaAccumulated12m).toBeCloseTo((1.004 ** 12) - 1, 3)
    expect(rates.igpmMonthly).toHaveLength(12)
    expect(rates.igpmMonthly[0]).toBeCloseTo(0.003, 4)
    expect(rates.asOf).not.toBeNull()
  })

  it('parses DD/MM/YYYY date format into a Date', async () => {
    const selicEntries = [{ data: '15/03/2025', valor: '10.50' }]
    const cdiEntries = [{ data: '15/03/2025', valor: '0.040417' }]
    const ipcaEntries = [{ data: '15/03/2025', valor: '0.40' }]
    const igpmEntries = [{ data: '15/03/2025', valor: '0.30' }]

    mockFetchJson
      .mockResolvedValueOnce(selicEntries)
      .mockResolvedValueOnce(cdiEntries)
      .mockResolvedValueOnce(ipcaEntries)
      .mockResolvedValueOnce(igpmEntries)

    const rates = await fetchBcbRates()
    expect(rates.asOf).toBeInstanceOf(Date)
    const asOf = rates.asOf!
    expect(asOf.getUTCFullYear()).toBe(2025)
    expect(asOf.getUTCMonth()).toBe(2) // March = index 2
    expect(asOf.getUTCDate()).toBe(15)
  })

  it('returns fallback constants when fetch throws', async () => {
    mockFetchJson.mockRejectedValue(new Error('network error'))

    const rates = await fetchBcbRates()

    expect(rates.cdiAnnual).toBe(0.105)
    expect(rates.selicAnnual).toBe(0.105)
    expect(rates.ipcaAccumulated12m).toBe(0.0483)
    expect(rates.igpmAccumulated12m).toBe(0.035)
    expect(rates.asOf).toBeNull()
  })

  it('accumulated IPCA from documented rf_09 example: 12x 0.45%/month ≈ 5.53%', async () => {
    const monthlyPct = 0.45
    const ipcaEntries = Array.from({ length: 12 }, () => ({
      data: '01/05/2025',
      valor: String(monthlyPct),
    }))

    mockFetchJson
      .mockResolvedValueOnce([{ data: '01/05/2025', valor: '10.50' }]) // selic
      .mockResolvedValueOnce([{ data: '01/05/2025', valor: '0.040417' }]) // cdi
      .mockResolvedValueOnce(ipcaEntries) // ipca
      .mockResolvedValueOnce([{ data: '01/05/2025', valor: '0.30' }]) // igpm (1 entry)

    const rates = await fetchBcbRates()
    const expected = (1.0045 ** 12) - 1
    expect(rates.ipcaAccumulated12m).toBeCloseTo(expected, 4)
  })
})

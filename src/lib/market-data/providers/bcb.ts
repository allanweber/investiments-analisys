import { asNumber, fetchJson } from '../http'

/** BCB SGS series codes used for Brazilian fixed-income indexers. */
const SERIES = {
  selic: 432,  // Meta Selic %/ano
  cdi: 12,     // CDI diário %/dia
  ipca: 433,   // IPCA %/mês
  igpm: 189,   // IGPM %/mês
} as const

const BCB_BASE = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs'

function isBcbLogEnabled(): boolean {
  const v = (process.env.MARKET_DATA_LOG ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function logBcbEvent(event: Record<string, unknown>) {
  const payload = { ts: new Date().toISOString(), scope: 'marketData', provider: 'bcb', ...event }
  const line = JSON.stringify(payload)
  const level = typeof event.level === 'string' ? event.level : 'info'
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

type BcbEntry = { data: string; valor: string }

function parseBcbDate(ddmmyyyy: string): Date | null {
  const parts = ddmmyyyy.split('/')
  if (parts.length !== 3) return null
  const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

async function fetchSeries(code: number, n: number): Promise<BcbEntry[]> {
  const url = `${BCB_BASE}.${code}/dados/ultimos/${n}?formato=json`
  if (isBcbLogEnabled()) {
    logBcbEvent({ level: 'info', msg: 'bcb -> http_request', code, url })
  }
  const data = await fetchJson(url, { timeoutMs: 15_000 })
  if (!Array.isArray(data)) throw new Error('BCB response is not an array')
  return data as BcbEntry[]
}

export type BcbRates = {
  /** Annual CDI as decimal (e.g. 0.1050) derived from daily CDI compounded to 252bd/year. */
  cdiAnnual: number
  /** Selic meta annual rate as decimal (e.g. 0.1050). */
  selicAnnual: number
  /** Last 12 monthly IPCA rates as decimals. */
  ipcaMonthly: readonly number[]
  /** IPCA accumulated over last 12 months. */
  ipcaAccumulated12m: number
  /** Last 12 monthly IGPM rates as decimals. */
  igpmMonthly: readonly number[]
  /** IGPM accumulated over last 12 months. */
  igpmAccumulated12m: number
  /** Date of the most recent data point fetched. */
  asOf: Date | null
}

/** Accumulates monthly rates (as decimals) into a single factor, returns rate. */
function accumulate(rates: readonly number[]): number {
  let factor = 1
  for (const r of rates) factor *= 1 + r
  return factor - 1
}

/** Fetches current BCB SGS indexer rates. Returns null fields for series that fail. */
export async function fetchBcbRates(): Promise<BcbRates> {
  const FALLBACK: BcbRates = {
    cdiAnnual: 0.105,
    selicAnnual: 0.105,
    ipcaMonthly: [],
    ipcaAccumulated12m: 0.0483,
    igpmMonthly: [],
    igpmAccumulated12m: 0.035,
    asOf: null,
  }

  try {
    const [selicEntries, cdiEntries, ipcaEntries, igpmEntries] = await Promise.all([
      fetchSeries(SERIES.selic, 1).catch(() => [] as BcbEntry[]),
      fetchSeries(SERIES.cdi, 252).catch(() => [] as BcbEntry[]),
      fetchSeries(SERIES.ipca, 12).catch(() => [] as BcbEntry[]),
      fetchSeries(SERIES.igpm, 12).catch(() => [] as BcbEntry[]),
    ])

    // Selic: already annual %/ano → divide by 100
    const selicAnnual = selicEntries.length > 0
      ? (asNumber(selicEntries[selicEntries.length - 1]?.valor) ?? 10.5) / 100
      : FALLBACK.selicAnnual

    // CDI: daily %/dia → compound 252 business days to annual
    let cdiAnnual = FALLBACK.cdiAnnual
    if (cdiEntries.length > 0) {
      const lastDailyPct = asNumber(cdiEntries[cdiEntries.length - 1]?.valor)
      if (lastDailyPct != null) {
        const dailyDecimal = lastDailyPct / 100
        cdiAnnual = (1 + dailyDecimal) ** 252 - 1
      }
    }

    // IPCA: monthly %/mês → divide by 100 each
    const ipcaMonthly = ipcaEntries
      .map((e) => asNumber(e.valor))
      .filter((v): v is number => v != null)
      .map((v) => v / 100)
    const ipcaAccumulated12m = ipcaMonthly.length > 0 ? accumulate(ipcaMonthly) : FALLBACK.ipcaAccumulated12m

    // IGPM: monthly %/mês → divide by 100 each
    const igpmMonthly = igpmEntries
      .map((e) => asNumber(e.valor))
      .filter((v): v is number => v != null)
      .map((v) => v / 100)
    const igpmAccumulated12m = igpmMonthly.length > 0 ? accumulate(igpmMonthly) : FALLBACK.igpmAccumulated12m

    const latestDateStr = [
      selicEntries[selicEntries.length - 1]?.data,
      cdiEntries[cdiEntries.length - 1]?.data,
      ipcaEntries[ipcaEntries.length - 1]?.data,
      igpmEntries[igpmEntries.length - 1]?.data,
    ].filter(Boolean).sort().pop()
    const asOf = latestDateStr ? parseBcbDate(latestDateStr) : null

    if (isBcbLogEnabled()) {
      logBcbEvent({
        level: 'info',
        msg: 'bcb -> rates_fetched',
        selicAnnual,
        cdiAnnual,
        ipcaAccumulated12m,
        igpmAccumulated12m,
        asOf: asOf?.toISOString(),
      })
    }

    return { cdiAnnual, selicAnnual, ipcaMonthly, ipcaAccumulated12m, igpmMonthly, igpmAccumulated12m, asOf }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'BCB fetch error'
    logBcbEvent({ level: 'error', msg: 'bcb -> fetch_error', error: msg })
    return FALLBACK
  }
}

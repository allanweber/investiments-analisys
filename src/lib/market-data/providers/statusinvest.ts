import { fetchJson } from '../http'

const SEARCH_URL = 'https://statusinvest.com.br/home/mainsearchquery'
const DRE_URL = 'https://statusinvest.com.br/acao/getdre'
const BALANCE_SHEET_URL = 'https://statusinvest.com.br/acao/getativos'

function isStatusInvestLogEnabled(): boolean {
  const v = (process.env.MARKET_DATA_LOG ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function logStatusInvestEvent(event: Record<string, unknown>) {
  const payload = { ts: new Date().toISOString(), scope: 'marketData', provider: 'statusinvest', ...event }
  const line = JSON.stringify(payload)
  const level = typeof event.level === 'string' ? event.level : 'info'
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Referer: 'https://statusinvest.com.br/',
  'X-Requested-With': 'XMLHttpRequest',
}

/**
 * pt-BR formatted number with an optional Brazilian magnitude suffix, e.g. "24,20%" → 24.20,
 * "498.091,00 M" → 498091000000, "-3.293,29 M" → -3293290000. Returns null for "-"/empty.
 */
function parsePtBrNumber(v: unknown): number | null {
  if (typeof v !== 'string') return null
  let trimmed = v.trim()
  if (!trimmed || trimmed === '-') return null

  let multiplier = 1
  const suffixMatch = trimmed.match(/\s([KMB])$/i)
  if (suffixMatch) {
    const suffix = suffixMatch[1].toUpperCase()
    multiplier = suffix === 'K' ? 1e3 : suffix === 'M' ? 1e6 : 1e9
    trimmed = trimmed.slice(0, suffixMatch.index).trim()
  }

  const cleaned = trimmed.replace(/%/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n * multiplier : null
}

async function resolveAssetId(ticker: string): Promise<number | null> {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(ticker)}`
  const payload = await fetchJson(url, { timeoutMs: 10_000, headers: BROWSER_HEADERS })
  if (!Array.isArray(payload)) return null
  const match = payload.find(
    (r: any) => typeof r?.code === 'string' && r.code.toUpperCase() === ticker.toUpperCase(),
  )
  const parentId = match?.parentId
  return typeof parentId === 'number' ? parentId : null
}

/** One fiscal year's worth of line items/ratios, keyed by their raw provider label. */
export type FundamentalYear = {
  fiscalYear: number
  metrics: Record<string, number | null>
}

function rowLabel(row: any): string {
  return row?.columns?.[0]?.value ?? ''
}

/**
 * Parses one metric row from a StatusInvest grid response into a year → value map.
 *
 * Column layout per row: [label, then repeating (DATA, AH, AV) triples per period]. Flow/stock
 * rows (money amounts) include an extra leading "Últ. 12M" DATA column that ratio rows (ROE,
 * margins) don't — so after filtering to `name === 'DATA'` columns, we drop as many leading
 * columns as needed to match `years.length` (the surplus, if any, is always the last-12-months
 * column(s), never a real fiscal year).
 */
function extractYearValuesFromRow(row: any, years: number[]): Map<number, number | null> {
  const out = new Map<number, number | null>()
  let dataCols = row.columns.slice(1).filter((c: any) => c.name === 'DATA')
  const surplus = dataCols.length - years.length
  if (surplus > 0) dataCols = dataCols.slice(surplus)

  const descYears = [...years].reverse()
  for (let i = 0; i < dataCols.length && i < descYears.length; i++) {
    out.set(descYears[i], parsePtBrNumber(dataCols[i].value))
  }
  return out
}

function extractYearValues(grid: any[], years: number[], labelPrefix: string): Map<number, number | null> {
  const row = grid.find((r) => !r.isHeader && rowLabel(r).startsWith(labelPrefix))
  if (!row) return new Map()
  return extractYearValuesFromRow(row, years)
}

/** Every non-header row in a grid, keyed by its raw label — not limited to a fixed field list. */
function extractAllRows(grid: any[], years: number[]): Map<string, Map<number, number | null>> {
  const out = new Map<string, Map<number, number | null>>()
  for (const row of grid) {
    if (row.isHeader) continue
    const label = rowLabel(row).trim()
    if (!label) continue
    out.set(label, extractYearValuesFromRow(row, years))
  }
  return out
}

async function fetchGrid(
  url: string,
  ticker: string,
  assetId: number,
  minYear: number,
  maxYear: number,
): Promise<{ years: number[]; grid: any[] }> {
  const fullUrl = `${url}?code=${encodeURIComponent(ticker)}&assetId=${assetId}&range.min=${minYear}&range.max=${maxYear}`
  if (isStatusInvestLogEnabled()) {
    logStatusInvestEvent({ level: 'info', msg: 'statusinvest -> http_request', ticker, url: fullUrl })
  }
  const payload: any = await fetchJson(fullUrl, { timeoutMs: 15_000, headers: BROWSER_HEADERS })
  const years: number[] = Array.isArray(payload?.data?.years) ? payload.data.years : []
  const grid: any[] = Array.isArray(payload?.data?.grid) ? payload.data.grid : []
  return { years, grid }
}

/** Canonical labels for our own derived (not directly reported) metrics. */
export const DERIVED_NET_DEBT_LABEL = 'Dívida Líquida'
export const DERIVED_NET_DEBT_EBITDA_LABEL = 'Dívida Líquida/Ebitda'

/**
 * Fetches the full available annual fundamentals history for a B3 ticker from StatusInvest,
 * exposing every DRE + balance sheet line item/ratio generically (keyed by its raw label) so
 * arbitrary user questions can reference any of them, not just a fixed list.
 *
 * Net debt is derived ourselves (Dívida Bruta − Caixa e Equivalentes) and overwrites
 * StatusInvest's own "Dívida Líquida"/"Dívida Líquida/Ebitda" DRE rows, which are only populated
 * for the most recent period, not historically — Dívida Bruta (DRE) and Caixa e Equivalentes
 * (balance sheet) both have full history.
 */
export async function fetchStatusInvestFundamentals(ticker: string): Promise<FundamentalYear[]> {
  const assetId = await resolveAssetId(ticker)
  if (assetId == null) {
    if (isStatusInvestLogEnabled()) {
      logStatusInvestEvent({ level: 'warn', msg: 'statusinvest -> ticker_not_found', ticker })
    }
    return []
  }

  const maxYear = new Date().getFullYear()
  const minYear = maxYear - 10

  const [dre, balanceSheet] = await Promise.all([
    fetchGrid(DRE_URL, ticker, assetId, minYear, maxYear),
    fetchGrid(BALANCE_SHEET_URL, ticker, assetId, minYear, maxYear),
  ])
  if (dre.years.length === 0 || dre.grid.length === 0) return []

  const dreRows = extractAllRows(dre.grid, dre.years)
  const balanceSheetRows =
    balanceSheet.years.length > 0 ? extractAllRows(balanceSheet.grid, balanceSheet.years) : new Map()

  const ebitda = extractYearValues(dre.grid, dre.years, 'EBITDA')
  const grossDebt = extractYearValues(dre.grid, dre.years, 'Dívida Bruta')
  const cash =
    balanceSheet.years.length > 0
      ? extractYearValues(balanceSheet.grid, balanceSheet.years, 'Caixa e Equivalentes')
      : new Map<number, number | null>()

  return dre.years.map((fiscalYear) => {
    const metrics: Record<string, number | null> = {}
    for (const [label, values] of dreRows) metrics[label] = values.get(fiscalYear) ?? null
    for (const [label, values] of balanceSheetRows) metrics[label] = values.get(fiscalYear) ?? null

    const gross = grossDebt.get(fiscalYear) ?? null
    const cashValue = cash.get(fiscalYear) ?? null
    const ebitdaValue = ebitda.get(fiscalYear) ?? null
    const netDebt = gross != null && cashValue != null ? gross - cashValue : null
    const netDebtEbitda = netDebt != null && ebitdaValue ? netDebt / ebitdaValue : null
    metrics[DERIVED_NET_DEBT_LABEL] = netDebt
    metrics[DERIVED_NET_DEBT_EBITDA_LABEL] = netDebtEbitda

    return { fiscalYear, metrics }
  })
}

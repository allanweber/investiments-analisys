export type MetricComparator = 'gt' | 'lt'

export type MetricPoint = {
  fiscalYear: number
  value: number | null
}

export type FundamentalCheckResult = {
  /** null means insufficient data to decide (mirrors AI scoring's "unknown"). */
  pass: boolean | null
  /** pt-BR one-liner summarizing the years checked — reuses the AI suggestion panel's reasoning slot. */
  detail: string
}

function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')
}

function compare(value: number, comparator: MetricComparator, threshold: number): boolean {
  return comparator === 'gt' ? value > threshold : value < threshold
}

function comparatorSymbol(comparator: MetricComparator): string {
  return comparator === 'gt' ? '>' : '<'
}

/** Last N fiscal years present in `series` (already expected sorted ascending), oldest first. */
function lastYears<T extends { fiscalYear: number }>(series: readonly T[], windowYears: number | null): T[] {
  if (windowYears == null) return [...series]
  return series.slice(Math.max(0, series.length - windowYears))
}

/**
 * Value comparison in every year of the window — "every year must pass", no fixed metric list.
 * windowYears null means all available history (e.g. "ROE historicamente").
 */
export function computeLevelCheck(
  series: readonly MetricPoint[],
  comparator: MetricComparator,
  threshold: number,
  windowYears: number | null,
): FundamentalCheckResult {
  const window = lastYears(series, windowYears).filter((y) => y.value != null)
  if (window.length === 0) {
    return { pass: null, detail: 'Sem dados disponíveis para este indicador.' }
  }

  const pass = window.every((y) => compare(y.value!, comparator, threshold))
  const detail = window
    .map((y) => {
      const ok = compare(y.value!, comparator, threshold)
      return `${y.fiscalYear}=${formatValue(y.value!)}${ok ? '' : ' (falha)'}`
    })
    .join(' · ')
  return { pass, detail: `${comparatorSymbol(comparator)} ${formatValue(threshold)}: ${detail}` }
}

/**
 * Year-over-year % growth of a single metric, compared in every year of the window.
 * windowYears null means all available history.
 */
export function computeGrowthCheck(
  series: readonly MetricPoint[],
  comparator: MetricComparator,
  threshold: number,
  windowYears: number | null,
): FundamentalCheckResult {
  const window = lastYears(series, windowYears == null ? null : windowYears + 1)
  if (window.length < 2) {
    return { pass: null, detail: 'Sem histórico suficiente para calcular crescimento.' }
  }

  const rows: { fiscalYear: number; growth: number | null }[] = []
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1]
    const curr = window[i]
    const growth =
      prev.value != null && prev.value !== 0 && curr.value != null
        ? ((curr.value - prev.value) / Math.abs(prev.value)) * 100
        : null
    rows.push({ fiscalYear: curr.fiscalYear, growth })
  }

  const withData = rows.filter((r) => r.growth != null)
  if (withData.length === 0) {
    return { pass: null, detail: 'Sem histórico suficiente para calcular crescimento.' }
  }

  const pass = withData.every((r) => compare(r.growth!, comparator, threshold))
  const detail = withData
    .map((r) => `${r.fiscalYear}=${formatValue(r.growth!)}%${compare(r.growth!, comparator, threshold) ? '' : ' (falha)'}`)
    .join(' · ')
  return { pass, detail: `Crescimento ${comparatorSymbol(comparator)} ${formatValue(threshold)}%: ${detail}` }
}

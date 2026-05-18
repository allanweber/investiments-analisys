import { fmtMoney, fmtPct } from '#/components/portfolio/format'
import { messages as m } from '#/messages'

type NativeBreakdownRow = {
  currency: string
  marketValueNative: number
  marketValueDisplay: number
  holdingCount: number
  pctOfPortfolio: number
}

type Props = {
  rows: NativeBreakdownRow[]
  displayCurrency: string
}

export function PortfolioByCurrency({ rows, displayCurrency }: Props) {
  if (rows.length === 0) return null

  return (
    <section id="por-moeda" className="mb-10">
      <h2 className="font-headline text-xl font-extrabold text-on-surface">{m.portfolio.byCurrencyTitle}</h2>
      <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{m.portfolio.byCurrencySubtitle}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.currency}
            className="rounded-2xl bg-surface p-5 shadow-md ring-1 ring-outline-variant/10"
          >
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-outline">
              {row.currency}
            </p>
            <p className="mt-2 font-headline text-2xl font-extrabold text-on-surface">
              {fmtMoney(row.marketValueNative, row.currency)}
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">
              {m.portfolio.byCurrencyHoldings(row.holdingCount)} · {fmtPct(row.pctOfPortfolio)}{' '}
              {m.portfolio.byCurrencyPctLabel(displayCurrency)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

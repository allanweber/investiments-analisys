import { fmtMoney } from '@/components/portfolio/format'

type TypeBreakdownEntry = {
  name: string
  mv: number
  pl: number
}

type Props = {
  displayCurrency: string
  marketValue: number
  lastUpdatedAt: Date | null
  quotesStale: boolean
  typeBreakdown: TypeBreakdownEntry[]
}

export function HoldingsSummaryStrip({
  displayCurrency,
  marketValue,
  lastUpdatedAt,
  quotesStale,
  typeBreakdown,
}: Props) {
  return (
    <>
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-label text-[10px] font-bold uppercase tracking-widest text-outline">
              Patrimônio total
            </p>
            {quotesStale && (
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-outline">
                Defasado
              </span>
            )}
          </div>
          <p className="mt-2 font-headline text-4xl font-extrabold text-on-surface sm:text-5xl">
            {fmtMoney(marketValue, displayCurrency)}
          </p>
          {lastUpdatedAt && (
            <p className="mt-2 flex items-center gap-1 text-xs text-outline">
              <span className="material-symbols-outlined text-sm">schedule</span>
              Última atualização: {lastUpdatedAt.toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      </section>

      {typeBreakdown.length > 0 && (
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {typeBreakdown.slice(0, 3).map((t) => {
            const pctType = t.mv > 0 ? (t.pl / t.mv) * 100 : 0
            const up = t.pl >= 0
            return (
              <div
                key={t.name}
                className="rounded-2xl bg-surface p-5 shadow-md ring-1 ring-outline-variant/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="material-symbols-outlined text-outline">show_chart</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      quotesStale
                        ? 'bg-error-container/55 text-error'
                        : 'bg-tertiary-fixed-dim/25 text-on-tertiary-container'
                    }`}
                  >
                    {quotesStale ? 'Atrasado' : 'OK'}
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-outline">{t.name}</p>
                <p className="mt-1 font-headline text-xl font-extrabold text-on-surface">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(t.mv)}
                </p>
                <p className={`mt-2 text-sm font-bold ${up ? 'text-tertiary-fixed-dim' : 'text-error'}`}>
                  {up ? '+' : ''}
                  {pctType.toFixed(1)}%
                </p>
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}

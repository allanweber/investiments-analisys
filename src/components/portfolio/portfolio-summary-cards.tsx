import { fmtMoney, fmtPct, fmtSignedMoney } from '#/components/portfolio/format'

type Props = {
  total: number
  unrealized: number
  currency: string | null
  /** Share of P/L vs portfolio (for subtitle). */
  plSharePct: number
  lastUpdatedAt: Date | null
  /** Sum of target % (expect 100 when targets configured). */
  totalTargetPct: number
}

export function PortfolioSummaryCards({
  total,
  unrealized,
  currency,
  plSharePct,
  lastUpdatedAt,
  totalTargetPct,
}: Props) {
  return (
    <section className="mb-8 flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
      <div className="min-w-[min(100%,280px)] shrink-0 rounded-2xl bg-surface p-6 shadow-md ring-1 ring-outline-variant/10 md:min-w-0">
        <p className="font-label text-[10px] font-bold uppercase tracking-widest text-outline">Patrimônio total</p>
        <p className="mt-2 font-headline text-3xl font-extrabold text-on-surface">
          {fmtMoney(total, currency)}
        </p>
        {total > 0 && (
          <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-tertiary-fixed-dim">
            <span className="material-symbols-outlined text-base">trending_up</span>
            {plSharePct >= 0 ? '+' : ''}
            {plSharePct.toFixed(1)}%
          </p>
        )}
        {lastUpdatedAt && (
          <p className="mt-2 text-xs text-outline">
            Última atualização: {lastUpdatedAt.toLocaleString('pt-BR')}
          </p>
        )}
      </div>
      <div className="min-w-[min(100%,280px)] shrink-0 rounded-2xl bg-surface p-6 shadow-md ring-1 ring-outline-variant/10 md:min-w-0">
        <p className="font-label text-[10px] font-bold uppercase tracking-widest text-outline">P/L não realizado</p>
        <p
          className={`mt-2 font-headline text-3xl font-extrabold ${
            unrealized >= 0 ? 'text-tertiary-fixed-dim' : 'text-error'
          }`}
        >
          {fmtSignedMoney(unrealized, currency)}
        </p>
        <p className="mt-2 text-xs text-outline">Histórico consolidado</p>
      </div>
      <div className="min-w-[min(100%,280px)] shrink-0 rounded-2xl bg-surface p-6 shadow-md ring-1 ring-outline-variant/10 md:min-w-0">
        <p className="font-label text-[10px] font-bold uppercase tracking-widest text-outline">Total alvo</p>
        <p className="mt-2 font-headline text-3xl font-extrabold text-on-surface">{fmtPct(totalTargetPct)}</p>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-inverse-primary"
            style={{ width: `${Math.min(100, totalTargetPct)}%` }}
          />
        </div>
      </div>
    </section>
  )
}

import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  AporteResults,
  formatCurrency,
} from '@/components/portfolio/aporte-results'
import { confirm } from '@/lib/confirm'
import {
  deleteAporteRunFn,
  getAporteRunFn,
  listAporteRunsFn,
} from '@/lib/aporte-run-server'
import { messages as m } from '@/messages'

export const Route = createFileRoute('/portfolio/aporte/historico')({
  component: HistoricoPage,
  loader: async () => ({ runs: await listAporteRunsFn() }),
})

type RunDetail = Extract<
  Awaited<ReturnType<typeof getAporteRunFn>>,
  { ok: true }
>['run']

function HistoricoPage() {
  const router = useRouter()
  const { runs } = Route.useLoaderData()
  const [open, setOpen] = useState<RunDetail | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function openRun(id: string) {
    setOpeningId(id)
    try {
      const res = await getAporteRunFn({ data: { id } })
      if (res.ok) setOpen(res.run)
    } finally {
      setOpeningId(null)
    }
  }

  async function removeRun(id: string, name: string) {
    if (!(await confirm(m.aporte.historyDeleteConfirm(name)))) return
    setBusyId(id)
    try {
      await deleteAporteRunFn({ data: { id } })
      toast.success(m.aporte.historyDeleted)
      await router.invalidate()
    } catch {
      toast.error(m.aporte.historyDeleteError)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="w-full max-w-4xl px-4 py-8 sm:p-8">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
          {m.aporte.historyTitle}
        </h1>
        <Link
          to="/portfolio/aporte"
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-outline-variant/30 px-3.5 py-2 font-body text-sm font-semibold text-on-surface-variant no-underline transition-colors hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-lg leading-none">
            add
          </span>
          {m.aporte.historyBackToAporte}
        </Link>
      </div>
      <p className="mb-8 text-sm text-on-surface-variant">
        {m.aporte.historySubtitle}
      </p>

      {runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant/35 bg-surface-container-low/50 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-high">
            <span className="material-symbols-outlined text-2xl text-outline">
              bookmark
            </span>
          </div>
          <p className="font-headline text-lg font-semibold text-on-surface">
            {m.aporte.historyEmpty}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-on-surface-variant">
            {m.aporte.historyEmptyHint}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {runs.map((run) => (
            <li
              key={run.id}
              className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0">
                  <p className="truncate font-headline text-base font-bold text-on-surface">
                    {run.name}
                  </p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {m.aporte.historySimulatedAt}{' '}
                    <span className="tabular-nums">
                      {new Date(run.simulatedAt).toLocaleDateString('pt-BR')}
                    </span>{' '}
                    · {m.aporte.historySuggestionCount(run.suggestionCount)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums text-on-surface">
                    {formatCurrency(run.amount, run.currency)}
                  </span>
                  {run.appliedCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-wide text-on-primary-container">
                      {m.aporte.historyAppliedBadge(
                        run.appliedCount,
                        run.suggestionCount,
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-outline-variant/15 pt-3">
                <button
                  type="button"
                  onClick={() => void openRun(run.id)}
                  disabled={openingId === run.id}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container/25 px-3 py-2.5 font-body text-sm font-semibold text-on-surface transition-colors hover:bg-primary-container/45 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-lg leading-none">
                    visibility
                  </span>
                  {m.aporte.historyOpen}
                </button>
                <button
                  type="button"
                  onClick={() => void removeRun(run.id, run.name)}
                  disabled={busyId === run.id}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 font-body text-sm font-semibold text-error transition-colors hover:bg-error-container/25 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-lg leading-none">
                    delete
                  </span>
                  {m.aporte.historyDelete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-10"
          onClick={() => setOpen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-detail-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-surface px-4 pb-8 pt-6 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:px-6 sm:pt-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="history-detail-title"
                  className="truncate font-headline text-xl font-bold text-on-surface"
                >
                  {open.name}
                </h2>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {m.aporte.historySimulatedAt}{' '}
                  {new Date(open.simulatedAt).toLocaleDateString('pt-BR')} ·{' '}
                  {formatCurrency(open.amount, open.currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label={m.aporte.historyClose}
                className="shrink-0 rounded-full p-1 text-on-surface-variant transition-opacity hover:opacity-70"
              >
                <span className="material-symbols-outlined text-xl leading-none">
                  close
                </span>
              </button>
            </div>
            <p className="mb-4 rounded-xl bg-surface-variant/40 px-3 py-2 text-xs text-on-surface-variant">
              {m.aporte.historyReadOnly}
            </p>
            <AporteResults
              suggestions={open.snapshot.suggestions}
              typeProjections={open.snapshot.typeProjections}
              unallocatedAmount={open.snapshot.unallocatedAmount}
              currency={open.currency}
              appliedIds={new Set(open.snapshot.appliedInvestmentIds)}
              readOnly
            />
          </div>
        </div>
      )}
    </main>
  )
}

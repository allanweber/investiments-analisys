import { Link, createFileRoute, Navigate } from '@tanstack/react-router'
import { useMemo, useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  clearSelectedInvestments,
  getBulkRunServerState,
  getBulkRunState,
  runBulkAiScoring,
  selectAllInvestments,
  subscribeBulkRun,
  toggleGroupSelected,
  toggleSelected,
} from '@/lib/ai/bulk-run-store'
import type { RunStatus } from '@/lib/ai/bulk-run-store'
import { authClient } from '@/lib/auth-client'
import { listInvestmentsOverviewFn } from '@/lib/scoring-server'
import { messages as m } from '@/messages'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/investimentos/ia-em-lote')({
  component: BulkAiPage,
  loader: async () => ({ rows: await listInvestmentsOverviewFn() }),
})

function StatusBadge({
  status,
  checkedAt,
}: {
  status: RunStatus | undefined
  checkedAt?: string | null
}) {
  if (!status) return null

  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
        {m.ai.bulkPending}
      </span>
    )
  }

  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-wide text-on-secondary-container">
        <span
          className="h-3 w-3 animate-spin rounded-full border-2 border-on-secondary-container/30 border-t-on-secondary-container"
          aria-hidden
        />
        {m.ai.running}
      </span>
    )
  }

  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-wide text-on-primary-container">
        <span className="material-symbols-outlined text-sm leading-none">
          check_circle
        </span>
        {m.ai.bulkDone}
        {checkedAt && (
          <span className="font-normal normal-case tracking-normal opacity-80">
            · {new Date(checkedAt).toLocaleDateString('pt-BR')}
          </span>
        )}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-wide text-on-error-container">
      <span className="material-symbols-outlined text-sm leading-none">
        error
      </span>
      {m.ai.errorGeneric}
    </span>
  )
}

function BulkAiPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const { rows } = Route.useLoaderData()
  const [filterTypeId, setFilterTypeId] = useState<string>('all')
  const { selected, running, statusById, doneCount, total } =
    useSyncExternalStore(
      subscribeBulkRun,
      getBulkRunState,
      getBulkRunServerState,
    )

  const types = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.investmentTypeId, r.typeName)
    return [...map.entries()]
  }, [rows])

  const filteredRows = useMemo(() => {
    if (filterTypeId === 'all') return rows
    return rows.filter((r) => r.investmentTypeId === filterTypeId)
  }, [rows, filterTypeId])

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { typeName: string; typeSortOrder: number; items: typeof filteredRows }
    >()
    for (const r of filteredRows) {
      if (!map.has(r.investmentTypeId)) {
        map.set(r.investmentTypeId, {
          typeName: r.typeName,
          typeSortOrder: r.typeSortOrder,
          items: [],
        })
      }
      map.get(r.investmentTypeId)!.items.push(r)
    }
    return [...map.entries()]
      .sort((a, b) => a[1].typeSortOrder - b[1].typeSortOrder)
      .map(([typeId, g]) => ({
        typeId,
        ...g,
        items: [...g.items].sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR'),
        ),
      }))
  }, [filteredRows])

  if (sessionPending) {
    return (
      <main
        role="status"
        className="flex flex-col items-center justify-center gap-2 px-4 py-24"
      >
        <span className="sr-only">{m.common.loading}</span>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
          aria-hidden
        />
      </main>
    )
  }

  if (!session?.user) return <Navigate to="/login" />

  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <main className="w-full max-w-6xl px-4 py-8 sm:p-8 lg:p-12">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-sm text-outline">
        <Link to="/dashboard" className="no-underline hover:text-on-surface">
          {m.common.admin}
        </Link>
        <span className="text-surface-dim">/</span>
        <Link
          to="/investimentos"
          className="no-underline hover:text-on-surface"
        >
          {m.common.crumbInvestimentos}
        </Link>
        <span className="text-surface-dim">/</span>
        <span className="text-on-surface">{m.ai.bulkPageTitle}</span>
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-on-primary-fixed">
          <span className="material-symbols-outlined text-xl leading-none">
            auto_awesome
          </span>
        </span>
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">
            {m.ai.bulkPageTitle}
          </h1>
          <p className="mt-2 max-w-xl font-body text-on-surface-variant">
            {m.ai.bulkPageSubtitle}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 sm:min-w-[280px]">
            <span className="mb-2 block font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              {m.common.labelTipoInvestimento}
            </span>
            <Select value={filterTypeId} onValueChange={setFilterTypeId}>
              <SelectTrigger className="h-11 w-full min-w-[240px] border-outline-variant/30 bg-surface-container-highest">
                <SelectValue placeholder={m.investments.filterAllPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {m.investments.filterAllTypes}
                </SelectItem>
                {types.map(([typeId, typeName]) => (
                  <SelectItem key={typeId} value={typeId}>
                    {typeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-outline-variant/30"
              onClick={() =>
                selectAllInvestments(filteredRows.map((r) => r.id))
              }
              disabled={running}
            >
              {m.ai.bulkSelectAll}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-outline-variant/30"
              onClick={clearSelectedInvestments}
              disabled={running}
            >
              {m.ai.bulkClearSelection}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-outline-variant/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-sm text-on-surface-variant">
            {selected.size}{' '}
            {selected.size === 1
              ? m.investments.listCountOne
              : m.investments.listCountMany}{' '}
            {m.ai.bulkSelectedSuffix}
          </p>
          <Button
            type="button"
            className="h-12 gap-2 rounded-xl bg-primary-container px-6 font-headline text-base font-bold text-on-primary shadow-md transition-transform hover:scale-[1.02] disabled:scale-100"
            onClick={() => void runBulkAiScoring()}
            disabled={running || selected.size === 0}
          >
            {running ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/30 border-t-on-primary"
                aria-hidden
              />
            ) : (
              <span className="material-symbols-outlined text-xl leading-none">
                bolt
              </span>
            )}
            {running
              ? m.ai.bulkRunning(doneCount, total)
              : m.ai.bulkRunSelected(selected.size)}
          </Button>
        </div>

        {running && (
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-8 space-y-6">
        {groups.map((group) => {
          const groupIds = group.items.map((r) => r.id)
          const allGroupSelected = groupIds.every((id) => selected.has(id))
          return (
            <section
              key={group.typeId}
              className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-1"
            >
              <div className="flex items-center justify-between gap-3 rounded-t-xl px-4 pt-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-lg font-bold tracking-tight text-on-surface">
                    {group.typeName}
                  </h2>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-label text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                    {group.items.length}
                  </span>
                </div>
                <button
                  type="button"
                  className="font-body text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                  onClick={() => toggleGroupSelected(groupIds)}
                  disabled={running}
                >
                  {allGroupSelected
                    ? m.ai.bulkClearSelection
                    : m.ai.bulkSelectAll}
                </button>
              </div>
              <ul className="space-y-2 p-3 sm:p-4">
                {group.items.map((r) => {
                  const liveStatus = statusById[r.id]
                  const status: RunStatus | undefined =
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- statusById is Record<string, RunStatus> (no noUncheckedIndexedAccess), but it only has entries for investments touched by a batch run, so liveStatus is genuinely undefined otherwise
                    liveStatus ?? (r.lastAiCheckedAt ? 'ok' : undefined)
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-xl bg-surface-container-lowest p-3 shadow-float transition-colors',
                        status === 'running' &&
                          'ring-1 ring-inset ring-secondary-token/40',
                        status === 'ok' && 'ring-1 ring-inset ring-primary/30',
                        status === 'error' && 'ring-1 ring-inset ring-error/30',
                      )}
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelected(r.id)}
                          disabled={running}
                          className="h-4 w-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0 truncate font-body text-sm font-medium text-on-surface">
                          {r.name}
                        </span>
                        <span
                          className="ml-1 inline-flex shrink-0 items-center gap-2 font-label text-[11px] tabular-nums text-on-surface-variant"
                          title={`${m.common.labelPontos}: ${r.score} · ${m.common.labelRespAtivasShort}: ${r.answeredActiveCount}/${r.activeQuestionCount}`}
                        >
                          <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-semibold">
                            {r.score} {m.common.labelPontos.toLowerCase()}
                          </span>
                          <span className="rounded-full bg-surface-container-high px-2 py-0.5">
                            {r.answeredActiveCount}/{r.activeQuestionCount}
                          </span>
                        </span>
                      </label>
                      <div className="flex shrink-0 items-center gap-3">
                        <StatusBadge
                          status={status}
                          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- same statusById Record<string,...> gap as above; liveStatus is genuinely undefined for investments not touched by a batch run
                          checkedAt={liveStatus ? null : r.lastAiCheckedAt}
                        />
                        <Link
                          to="/investimentos/$id/pontuacao"
                          params={{ id: r.id }}
                          className="inline-flex items-center gap-1 font-body text-sm font-semibold text-primary no-underline hover:underline"
                        >
                          {m.ai.bulkOpenLink}
                          <span className="material-symbols-outlined text-base leading-none">
                            arrow_forward
                          </span>
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </main>
  )
}

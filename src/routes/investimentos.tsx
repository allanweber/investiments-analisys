import {
  Link,
  Outlet,
  createFileRoute,
  Navigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { FaDetailsCard, FaMobilePanel } from '@/components/fa/details-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { authClient } from '@/lib/auth-client'
import { messages as m } from '@/messages'
import {
  createInvestmentFn,
  deleteInvestmentFn,
  setInvestmentActiveFn,
  updateInvestmentFn,
} from '@/lib/investment-server'
import { listInvestmentTypesOptionsFn } from '@/lib/investment-type-server'
import { listInvestmentsOverviewFn } from '@/lib/scoring-server'

export const Route = createFileRoute('/investimentos')({
  component: InvestimentosPage,
  loader: async () => ({
    rows: await listInvestmentsOverviewFn(),
    types: await listInvestmentTypesOptionsFn(),
  }),
})

type OverviewRow = Awaited<
  ReturnType<typeof listInvestmentsOverviewFn>
>[number]

function InvestimentosPage() {
  const router = useRouter()
  const isInvestimentosIndex = useRouterState({
    select: (s) => {
      const p = s.location.pathname
      return p === '/investimentos' || p === '/investimentos/'
    },
  })
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const { rows, types } = Route.useLoaderData()
  const [filterTypeId, setFilterTypeId] = useState<string>('all')
  const [newName, setNewName] = useState('')
  const [newTicker, setNewTicker] = useState('')
  const [newTypeId, setNewTypeId] = useState<string>(types[0]?.id ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editTicker, setEditTicker] = useState('')
  const [editTypeId, setEditTypeId] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const newTypeIsFixed = useMemo(
    () => Boolean(types.find((t) => t.id === newTypeId)?.fixedIncome),
    [types, newTypeId],
  )
  const editTypeIsFixed = useMemo(
    () => Boolean(types.find((t) => t.id === editTypeId)?.fixedIncome),
    [types, editTypeId],
  )

  const filteredRows = useMemo(() => {
    if (filterTypeId === 'all') return rows
    return rows.filter((r) => r.investmentTypeId === filterTypeId)
  }, [rows, filterTypeId])

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { typeName: string; typeSortOrder: number; items: OverviewRow[] }
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
      .map(([typeId, g]) => {
        g.items.sort((a, b) => a.position - b.position)
        return { typeId, ...g }
      })
  }, [filteredRows])

  const visibleInvestmentCount = filteredRows.length

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

  const refresh = () => router.invalidate()

  const alertForCode = (code: string) => {
    if (code === 'MISSING_TICKER') alert(m.investments.tickerRequired)
    else if (code === 'UNRESOLVED_TICKER') alert(m.investments.tickerUnresolved)
    else if (code === 'DUPLICATE_TICKER') alert(m.investments.tickerDuplicate)
    else if (code === 'HAS_ANSWERS_TYPE_LOCKED') alert(m.investments.typeChangeBlocked)
    else alert(m.investments.invalidType)
  }

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTypeId) {
      if (types.length === 0) alert(m.investments.createTypeFirst)
      return
    }
    if (!newName.trim()) return
    if (!newTypeIsFixed && !newTicker.trim()) {
      alert(m.investments.tickerRequired)
      return
    }
    setBusy('create')
    try {
      const res = await createInvestmentFn({
        data: {
          name: newName.trim(),
          ticker: newTicker.trim() ? newTicker.trim() : null,
          investmentTypeId: newTypeId,
        },
      })
      if (!res.ok) {
        alertForCode(res.code)
        return
      }
      setNewName('')
      setNewTicker('')
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const startEdit = (row: OverviewRow) => {
    setEditId(row.id)
    setEditName(row.name)
    setEditTicker(row.ticker ?? '')
    setEditTypeId(row.investmentTypeId)
  }

  const onSaveEdit = async () => {
    if (!editId || !editName.trim() || !editTypeId) return
    if (!editTypeIsFixed && !editTicker.trim()) {
      alert(m.investments.tickerRequired)
      return
    }
    setBusy(editId)
    try {
      const res = await updateInvestmentFn({
        data: {
          id: editId,
          name: editName.trim(),
          ticker: editTicker.trim() ? editTicker.trim() : null,
          investmentTypeId: editTypeId,
        },
      })
      if (!res.ok) {
        alertForCode(res.code)
        return
      }
      setEditId(null)
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const onDelete = async (id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!confirm(m.investments.deleteConfirm(row?.name ?? id))) return
    setBusy(id)
    try {
      await deleteInvestmentFn({ data: { id } })
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const onToggleActive = async (id: string, active: boolean) => {
    setBusy(id)
    try {
      await setInvestmentActiveFn({ data: { id, active } })
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
    {isInvestimentosIndex ? (
    <main className="w-full max-w-6xl px-4 py-8 sm:p-8 lg:py-12">
      <header className="mb-10 lg:mb-12">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 font-body text-sm text-outline">
            <Link to="/dashboard" className="no-underline hover:text-on-surface">
              {m.common.admin}
            </Link>
            <span className="text-surface-dim">/</span>
            <span className="text-on-surface">{m.common.crumbInvestimentos}</span>
          </div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">
            {m.investments.pageTitle}
          </h1>
          <p className="mt-3 max-w-xl font-body leading-relaxed text-on-surface-variant">
            {m.investments.pageSubtitle}
          </p>
          <Link
            to="/investimentos/ia-em-lote"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 font-body text-sm font-semibold text-on-primary no-underline shadow-sm transition-colors hover:opacity-90"
          >
            <span className="material-symbols-outlined text-lg leading-none">
              auto_awesome
            </span>
            {m.ai.bulkPageTitle}
          </Link>
        </div>
      </header>

      {types.length === 0 ? (
        <p className="rounded-xl bg-error-container/40 p-4 font-body text-sm text-on-error-container">
          {m.investments.noTypesBodyBeforeLink}{' '}
          <Link to="/tipos" className="font-semibold underline">
            {m.investments.noTypesLink}
          </Link>{' '}
          {m.investments.noTypesBodyAfterLink}
        </p>
      ) : (
        <section
          className="mb-12 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-1 shadow-sm sm:mb-14"
          aria-labelledby="add-investments-title"
        >
          <div className="rounded-[calc(1rem-2px)] bg-surface-container-lowest">
            <button
              type="button"
              className={`flex w-full flex-wrap items-start justify-between gap-3 rounded-[calc(1rem-2px)] px-5 pt-6 text-left transition-colors hover:bg-surface-container-high/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest sm:px-8 sm:pt-7 ${!addOpen ? 'pb-6 sm:pb-7' : ''}`}
              aria-expanded={addOpen}
              aria-controls="add-investments-panel"
              onClick={() => setAddOpen((o) => !o)}
            >
              <span className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-on-primary-fixed">
                  <span className="material-symbols-outlined text-xl leading-none">
                    add
                  </span>
                </span>
                <span className="min-w-0">
                  <span
                    id="add-investments-title"
                    className="font-headline block text-lg font-bold text-on-surface sm:text-xl"
                  >
                    {m.investments.addInvestmentsTitle}
                  </span>
                  <span className="mt-1 block max-w-lg font-body text-sm text-on-surface-variant">
                    {m.investments.addInvestmentsHint}
                  </span>
                </span>
              </span>
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/25 bg-surface-container-high text-on-surface-variant transition-colors pointer-events-none"
                aria-hidden
              >
                <span
                  className={`material-symbols-outlined text-2xl leading-none transition-transform duration-200 ${
                    addOpen ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </span>
            </button>
            <div
              id="add-investments-panel"
              hidden={!addOpen}
              className="border-t border-outline-variant/15 px-5 pb-6 pt-6 sm:px-8 sm:pb-7 sm:pt-7"
            >
            <form onSubmit={onCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="flex min-w-0 flex-col gap-2 lg:flex-1">
                  <Label
                    htmlFor="inv-new-name"
                    className="h-4 font-label text-xs font-semibold uppercase leading-none tracking-wider text-on-surface-variant"
                  >
                    {m.common.labelNome}
                  </Label>
                  <Input
                    id="inv-new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-11 border-outline-variant/30 bg-surface-container-high"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-2 lg:flex-1">
                  <Label
                    htmlFor="inv-new-ticker"
                    className="h-4 font-label text-xs font-semibold uppercase leading-none tracking-wider text-on-surface-variant"
                  >
                    {m.investments.labelTicker}
                    {!newTypeIsFixed && <span className="ml-1 text-error">*</span>}
                  </Label>
                  <Input
                    id="inv-new-ticker"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-11 border-outline-variant/30 bg-surface-container-high font-semibold"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-2 lg:flex-1">
                  <Label
                    htmlFor="inv-new-type"
                    className="h-4 font-label text-xs font-semibold uppercase leading-none tracking-wider text-on-surface-variant"
                  >
                    {m.common.labelTipoInvestimento}
                  </Label>
                  <Select value={newTypeId} onValueChange={setNewTypeId}>
                    <SelectTrigger
                      id="inv-new-type"
                      className="h-11! w-full min-w-0 border-outline-variant/30 bg-surface-container-highest"
                    >
                      <SelectValue placeholder={m.investments.selectTypePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  disabled={busy === 'create' || !newTypeId || !newName.trim()}
                  className="h-11 w-full shrink-0 rounded-xl bg-primary-container font-headline font-semibold text-on-primary lg:w-auto lg:min-w-[10rem]"
                >
                  <span className="material-symbols-outlined mr-1 shrink-0 text-lg leading-none">
                    add
                  </span>
                  {busy === 'create' ? m.common.saving : m.investments.createListSubmit}
                </Button>
              </div>
              <p className="font-body text-xs text-on-surface-variant">
                {m.investments.tickerHint}
              </p>
            </form>
            </div>
          </div>
        </section>
      )}

      {types.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-8 sm:gap-y-2 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1 sm:min-w-[320px] sm:max-w-2xl">
            <Label
              htmlFor="filtro-tipo"
              className="mb-2 block font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
            >
              {m.common.labelTipoInvestimento}
            </Label>
            <Select value={filterTypeId} onValueChange={(v) => setFilterTypeId(v)}>
              <SelectTrigger
                id="filtro-tipo"
                className="h-11 w-full min-w-[280px] border-outline-variant/30 bg-surface-container-highest"
              >
                <SelectValue placeholder={m.investments.filterAllPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{m.investments.filterAllTypes}</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="font-body text-xs text-on-surface-variant sm:pb-2.5">
            {visibleInvestmentCount}{' '}
            {visibleInvestmentCount === 1
              ? m.investments.listCountOne
              : m.investments.listCountMany}
          </p>
        </div>
      )}

      <div className="space-y-12 sm:space-y-14">
        {rows.length === 0 && types.length > 0 && (
          <div className="rounded-2xl border border-dashed border-outline-variant/35 bg-surface-container-low/50 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-high">
              <span className="material-symbols-outlined text-2xl text-outline">
                savings
              </span>
            </div>
            <p className="font-headline text-lg font-semibold text-on-surface">
              {m.investments.emptyTitle}
            </p>
            <p className="mx-auto mt-2 max-w-sm font-body text-sm text-on-surface-variant">
              {m.investments.emptyBody}
            </p>
          </div>
        )}

        {groups.map((group) => (
          <section key={group.typeId} className="scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant/15 pb-4">
              <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
                {group.typeName}
              </h2>
              <span className="font-label text-xs font-semibold uppercase tracking-wider text-outline">
                {group.items.length}{' '}
                {group.items.length === 1
                  ? m.investments.groupCountOne
                  : m.investments.groupCountMany}
              </span>
            </div>
            <div className="space-y-3 md:hidden">
              {group.items.map((row) =>
                editId === row.id ? (
                  <FaMobilePanel key={row.id}>
                    <div className="space-y-4">
                      <div>
                        <span className="mb-1 block font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                          {m.common.labelNome}
                        </span>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-10 border-outline-variant/30 bg-surface-container-high"
                        />
                      </div>
                      <div>
                        <span className="mb-1 block font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                          {m.investments.labelTicker}
                          {!editTypeIsFixed && <span className="ml-1 text-error">*</span>}
                        </span>
                        <Input
                          value={editTicker}
                          onChange={(e) => setEditTicker(e.target.value.toUpperCase())}
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                          className="h-10 border-outline-variant/30 bg-surface-container-high font-semibold"
                        />
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                            {m.common.labelPontos}
                          </dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-on-surface">
                            {row.score}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                            {m.common.labelRespAtivasShort}
                          </dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-on-surface-variant">
                            {row.answeredActiveCount}/{row.activeQuestionCount}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                            {m.common.labelPosicao}
                          </dt>
                          <dd className="mt-0.5 text-on-surface-variant">
                            {row.activeQuestionCount === 0 ? (
                              <span className="text-outline">{m.common.dash}</span>
                            ) : (
                              <span className="whitespace-nowrap font-medium tabular-nums">
                                {row.position}{m.common.ordinalSuffix}
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                      <div>
                        <span className="mb-1 block font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                          {m.common.labelTipo}
                        </span>
                        <Select
                          value={editTypeId}
                          onValueChange={setEditTypeId}
                        >
                          <SelectTrigger className="h-10 w-full border-outline-variant/30 bg-surface-container-highest">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {types.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          className="flex-1 bg-primary-container text-on-primary"
                          onClick={() => void onSaveEdit()}
                          disabled={busy === row.id}
                        >
                          {m.common.save}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 border-outline-variant/30"
                          onClick={() => setEditId(null)}
                        >
                          {m.common.cancel}
                        </Button>
                      </div>
                    </div>
                  </FaMobilePanel>
                ) : (
                  <FaDetailsCard
                    key={row.id}
                    summary={
                      <>
                        <span
                          onClick={(e) => e.stopPropagation()}
                          className="flex shrink-0 items-center gap-1.5"
                        >
                          <Switch
                            checked={row.active}
                            disabled={busy === row.id}
                            title={m.investments.toggleActiveTitle(row.active)}
                            onCheckedChange={(checked) =>
                              void onToggleActive(row.id, checked)
                            }
                            className="border-outline-variant/50 data-[state=unchecked]:bg-surface-container-highest"
                          />
                          <span className="font-label text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                            {row.active ? m.common.statusAtiva : m.common.statusInativa}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-semibold text-on-surface">
                            {row.name}
                          </span>
                          {row.ticker && (
                            <span className="font-label text-[11px] font-medium text-on-surface-variant">
                              {row.ticker}
                              {row.currency ? ` (${row.currency})` : ''}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-on-surface-variant">
                          {m.common.scorePtsAbbrev(row.score)}
                        </span>
                        <span
                          className="material-symbols-outlined shrink-0 text-xl leading-none text-on-surface-variant transition-transform duration-200 group-open:rotate-180"
                          aria-hidden
                        >
                          expand_more
                        </span>
                      </>
                    }
                  >
                    <dl className="space-y-2.5 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">{m.common.labelPontos}</dt>
                        <dd className="font-semibold tabular-nums text-on-surface">
                          {row.score}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">
                          {m.common.labelRespondidasAtivas}
                        </dt>
                        <dd className="font-medium tabular-nums text-on-surface-variant">
                          {row.answeredActiveCount}/{row.activeQuestionCount}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">{m.common.labelPosicao}</dt>
                        <dd className="text-on-surface-variant">
                          {row.activeQuestionCount === 0 ? (
                            <span className="text-outline">{m.common.dash}</span>
                          ) : (
                            <span className="whitespace-nowrap font-medium tabular-nums">
                              {row.position}{m.common.ordinalSuffix}
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-outline-variant/15 pt-4">
                      <Link
                        to="/investimentos/$id/pontuacao"
                        params={{ id: row.id }}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary-container/20 px-3 py-2.5 font-body text-sm font-semibold text-on-surface no-underline transition-colors hover:bg-primary-container/35"
                      >
                        <span className="material-symbols-outlined text-xl leading-none">
                          analytics
                        </span>
                        {m.common.pontuar}
                      </Link>
                      <button
                        type="button"
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-outline-variant/30 px-3 py-2.5 font-body text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
                        title={m.common.edit}
                        onClick={() => startEdit(row)}
                      >
                        <span className="material-symbols-outlined text-xl leading-none">
                          edit
                        </span>
                        {m.common.edit}
                      </button>
                      <button
                        type="button"
                        className="inline-flex flex-1 min-w-[6rem] items-center justify-center gap-1 rounded-xl px-3 py-2.5 font-body text-sm font-semibold text-error transition-colors hover:bg-error-container/25"
                        title={m.common.delete}
                        onClick={() => void onDelete(row.id)}
                        disabled={busy === row.id}
                      >
                        <span className="material-symbols-outlined text-xl leading-none">
                          delete
                        </span>
                        {m.common.delete}
                      </button>
                    </div>
                  </FaDetailsCard>
                ),
              )}
            </div>
            <div className="fa-table-shell hidden md:block">
              <div className="fa-table-inner px-2 pb-2 pt-1">
                <table className="fa-table">
                  <thead>
                    <tr className="fa-th">
                      <th className="min-w-[11rem] text-left">{m.investments.thNome}</th>
                      <th className="text-left">{m.investments.thPontos}</th>
                      <th className="text-left">{m.common.labelRespondidasAtivas}</th>
                      <th className="text-left">{m.common.labelPosicao}</th>
                      <th className="text-left">{m.common.labelAtiva}</th>
                      <th className="text-right">{m.investments.thAcoes}</th>
                    </tr>
                  </thead>
                  <tbody className="font-body text-sm">
                    {group.items.map((row) => (
                      <tr key={row.id} className="fa-tr">
                        <td className="min-w-[11rem] font-semibold text-on-surface [overflow-wrap:anywhere]">
                          {editId === row.id ? (
                            <div className="flex flex-col gap-1.5">
                              <div>
                                <span className="mb-0.5 block font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                                  {m.common.labelNome}
                                </span>
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="h-9 min-w-[10rem] border-none bg-surface-container-high"
                                />
                              </div>
                              <div>
                                <span className="mb-0.5 block font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                                  {m.investments.labelTicker}
                                  {!editTypeIsFixed && <span className="ml-1 text-error">*</span>}
                                </span>
                                <Input
                                  value={editTicker}
                                  onChange={(e) => setEditTicker(e.target.value.toUpperCase())}
                                  autoCapitalize="characters"
                                  autoCorrect="off"
                                  spellCheck={false}
                                  className="h-9 min-w-[10rem] border-none bg-surface-container-high"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span>{row.name}</span>
                              {row.ticker && (
                                <span className="font-label text-[11px] font-medium text-on-surface-variant">
                                  {row.ticker}
                                  {row.currency ? ` (${row.currency})` : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap tabular-nums text-on-surface">
                          {row.score}
                        </td>
                        <td className="whitespace-nowrap text-on-surface-variant">
                          {row.answeredActiveCount}/{row.activeQuestionCount}
                        </td>
                        <td className="whitespace-nowrap text-on-surface-variant">
                          {row.activeQuestionCount === 0 ? (
                            <span className="text-outline">{m.common.dash}</span>
                          ) : (
                            <span className="inline-block whitespace-nowrap">
                              {row.position}{m.common.ordinalSuffix}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={row.active}
                              disabled={busy === row.id}
                              title={m.investments.toggleActiveTitle(row.active)}
                              onCheckedChange={(checked) =>
                                void onToggleActive(row.id, checked)
                              }
                              className="border-outline-variant/50 data-[state=unchecked]:bg-surface-container-highest"
                            />
                            <span className="font-label text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                              {row.active ? m.common.statusAtiva : m.common.statusInativa}
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          {editId === row.id ? (
                            <div className="flex flex-nowrap items-center justify-end gap-2">
                              <Select
                                value={editTypeId}
                                onValueChange={setEditTypeId}
                              >
                                <SelectTrigger className="h-9 w-[180px] border-outline-variant/30 bg-surface-container-highest">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {types.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void onSaveEdit()}
                                disabled={busy === row.id}
                                className="bg-primary-container text-on-primary"
                              >
                                {m.common.save}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-outline-variant/30"
                                onClick={() => setEditId(null)}
                              >
                                {m.common.cancel}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-nowrap items-center justify-end gap-0.5">
                              <Link
                                to="/investimentos/$id/pontuacao"
                                params={{ id: row.id }}
                                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 font-body text-xs font-semibold text-on-surface-variant no-underline transition-colors hover:bg-surface-container-high hover:text-primary"
                                title={m.investments.titlePontuar}
                              >
                                <span className="material-symbols-outlined text-xl leading-none">
                                  analytics
                                </span>
                                {m.common.pontuar}
                              </Link>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                                title={m.common.edit}
                                onClick={() => startEdit(row)}
                              >
                                <span className="material-symbols-outlined text-xl leading-none">
                                  edit
                                </span>
                              </button>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-error-container/30 hover:text-error"
                                title={m.common.delete}
                                onClick={() => void onDelete(row.id)}
                                disabled={busy === row.id}
                              >
                                <span className="material-symbols-outlined text-xl leading-none">
                                  delete
                                </span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
    ) : null}
    <Outlet />
    </>
  )
}

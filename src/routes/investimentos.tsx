import {
  Link,
  Outlet,
  createFileRoute,
  Navigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { FaDetailsCard, FaMobilePanel } from '#/components/fa/details-card'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { authClient } from '#/lib/auth-client'
import { messages } from '#/messages'
import {
  createInvestmentsBulkFn,
  deleteInvestmentFn,
  listInvestmentTypesOptionsFn,
  listInvestmentsOverviewFn,
  updateInvestmentFn,
} from '#/lib/investment-server'

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
  const [bulkNames, setBulkNames] = useState('')
  const [newTypeId, setNewTypeId] = useState<string>(types[0]?.id ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editTypeId, setEditTypeId] = useState('')
  const [bulkAddOpen, setBulkAddOpen] = useState(false)

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

  const draftLineCount = useMemo(() => {
    return bulkNames
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean).length
  }, [bulkNames])

  const visibleInvestmentCount = filteredRows.length

  if (sessionPending) {
    return (
      <main className="flex items-center justify-center px-4 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
      </main>
    )
  }

  if (!session?.user) return <Navigate to="/login" />

  const refresh = () => router.invalidate()

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTypeId) {
      if (types.length === 0) {
        alert(messages.investments.createTypeFirst)
      }
      return
    }
    const lines = bulkNames
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    const names = lines.slice(0, 100)
    if (lines.length > 100) {
      alert(messages.investments.bulkMaxLines)
    }
    if (names.length === 0) {
      alert('Indique pelo menos um nome (um por linha).')
      return
    }
    setBusy('create')
    try {
      const res = await createInvestmentsBulkFn({
        data: { investmentTypeId: newTypeId, names },
      })
      if (!res.ok) {
        alert(
          res.code === 'BAD_TYPE'
            ? messages.investments.bulkInvalidType
            : messages.investments.bulkNoValidNames,
        )
        return
      }
      setBulkNames('')
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const startEdit = (row: OverviewRow) => {
    setEditId(row.id)
    setEditName(row.name)
    setEditTypeId(row.investmentTypeId)
  }

  const onSaveEdit = async () => {
    if (!editId || !editName.trim() || !editTypeId) return
    setBusy(editId)
    try {
      const res = await updateInvestmentFn({
        data: {
          id: editId,
          name: editName.trim(),
          investmentTypeId: editTypeId,
        },
      })
      if (!res.ok) {
        if (res.code === 'HAS_ANSWERS_TYPE_LOCKED') {
          alert(messages.investments.typeChangeBlocked)
        } else if (res.code === 'BAD_TYPE') {
          alert(messages.investments.invalidType)
        }
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
    if (!confirm(messages.investments.deleteConfirm(row?.name ?? id))) return
    setBusy(id)
    try {
      await deleteInvestmentFn({ data: { id } })
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
              Admin
            </Link>
            <span className="text-surface-dim">/</span>
            <span className="text-on-surface">Investimentos</span>
          </div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">
            Lista e ranking
          </h1>
          <p className="mt-3 max-w-xl font-body leading-relaxed text-on-surface-variant">
            Compare pontuações dentro de cada tipo. Filtre a lista abaixo ou
            adicione vários nomes de uma vez no formulário.
          </p>
        </div>
      </header>

      {types.length === 0 ? (
        <p className="rounded-xl bg-error-container/40 p-4 font-body text-sm text-on-error-container">
          Ainda não há tipos.{' '}
          <Link to="/tipos" className="font-semibold underline">
            Crie tipos
          </Link>{' '}
          antes de adicionar investimentos.
        </p>
      ) : (
        <section
          className="mb-12 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-1 shadow-sm sm:mb-14"
          aria-labelledby="add-investments-title"
        >
          <div className="rounded-[calc(1rem-2px)] bg-surface-container-lowest">
            <button
              type="button"
              className={`flex w-full flex-wrap items-start justify-between gap-3 rounded-[calc(1rem-2px)] px-5 pt-6 text-left transition-colors hover:bg-surface-container-high/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest sm:px-8 sm:pt-7 ${!bulkAddOpen ? 'pb-6 sm:pb-7' : ''}`}
              aria-expanded={bulkAddOpen}
              aria-controls="add-investments-panel"
              onClick={() => setBulkAddOpen((o) => !o)}
            >
              <span className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-on-primary-fixed">
                  <span className="material-symbols-outlined text-xl leading-none">
                    playlist_add
                  </span>
                </span>
                <span className="min-w-0">
                  <span
                    id="add-investments-title"
                    className="font-headline block text-lg font-bold text-on-surface sm:text-xl"
                  >
                    Adicionar investimentos
                  </span>
                  <span className="mt-1 block max-w-lg font-body text-sm text-on-surface-variant">
                    Um nome por linha no mesmo tipo. Máximo 100 linhas por envio.
                  </span>
                </span>
              </span>
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/25 bg-surface-container-high text-on-surface-variant transition-colors pointer-events-none"
                aria-hidden
              >
                <span
                  className={`material-symbols-outlined text-2xl leading-none transition-transform duration-200 ${
                    bulkAddOpen ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </span>
            </button>
            <div
              id="add-investments-panel"
              hidden={!bulkAddOpen}
              className="border-t border-outline-variant/15 px-5 pb-6 pt-6 sm:px-8 sm:pb-7 sm:pt-7"
            >
            <form
              onSubmit={onCreate}
              className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,420px)] lg:items-stretch"
            >
              <div className="flex min-h-0 min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label
                    htmlFor="inv-names-bulk"
                    className="font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
                  >
                    Nomes
                  </Label>
                  {draftLineCount > 0 && (
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                      {draftLineCount} linha{draftLineCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <Textarea
                  id="inv-names-bulk"
                  value={bulkNames}
                  onChange={(e) => setBulkNames(e.target.value)}
                  placeholder={
                    'Ex.:\nFundos X\nTítulos Y\nUm nome por linha…'
                  }
                  rows={6}
                  className="min-h-[140px] flex-1 resize-y rounded-xl border-outline-variant/30 bg-surface-container-high font-body text-sm leading-relaxed placeholder:text-outline"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-4 lg:justify-between">
                <div className="grid min-w-0 gap-2">
                  <Label
                    htmlFor="inv-new-type"
                    className="font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
                  >
                    Tipo de investimento
                  </Label>
                  <Select value={newTypeId} onValueChange={setNewTypeId}>
                    <SelectTrigger
                      id="inv-new-type"
                      className="h-11 w-full min-w-0 border-outline-variant/30 bg-surface-container-highest sm:min-w-[280px]"
                    >
                      <SelectValue placeholder="Escolher tipo" />
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
                  disabled={busy === 'create' || !newTypeId}
                  className="h-11 w-full rounded-xl bg-primary-container font-headline font-semibold text-on-primary lg:mt-auto"
                >
                  <span className="material-symbols-outlined mr-1 shrink-0 text-lg leading-none">
                    add
                  </span>
                  {busy === 'create' ? 'Salvando…' : 'Criar na lista'}
                </Button>
              </div>
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
              Tipo de investimento
            </Label>
            <Select value={filterTypeId} onValueChange={(v) => setFilterTypeId(v)}>
              <SelectTrigger
                id="filtro-tipo"
                className="h-11 w-full min-w-[280px] border-outline-variant/30 bg-surface-container-highest"
              >
                <SelectValue placeholder="Todos ou um tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
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
              ? 'investimento nesta lista'
              : 'investimentos nesta lista'}
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
              Ainda sem investimentos
            </p>
            <p className="mx-auto mt-2 max-w-sm font-body text-sm text-on-surface-variant">
              Use o formulário acima para colar ou escrever os nomes e escolher
              o tipo.
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
                {group.items.length === 1 ? 'investimento' : 'investimentos'}
              </span>
            </div>
            <div className="space-y-3 md:hidden">
              {group.items.map((row) =>
                editId === row.id ? (
                  <FaMobilePanel key={row.id}>
                    <div className="space-y-4">
                      <div>
                        <span className="mb-1 block font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                          Nome
                        </span>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-10 border-outline-variant/30 bg-surface-container-high"
                        />
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                            Pontos
                          </dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-on-surface">
                            {row.score}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                            Resp. / ativas
                          </dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-on-surface-variant">
                            {row.answeredActiveCount}/{row.activeQuestionCount}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                            Posição
                          </dt>
                          <dd className="mt-0.5 text-on-surface-variant">
                            {row.activeQuestionCount === 0 ? (
                              <span className="text-outline">—</span>
                            ) : (
                              <span className="whitespace-nowrap font-medium tabular-nums">
                                {row.position}º
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                      <div>
                        <span className="mb-1 block font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                          Tipo
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
                          Salvar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 border-outline-variant/30"
                          onClick={() => setEditId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </FaMobilePanel>
                ) : (
                  <FaDetailsCard
                    key={row.id}
                    summary={
                      <>
                        <span className="min-w-0 flex-1 font-semibold text-on-surface">
                          {row.name}
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-on-surface-variant">
                          {row.score} pts
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
                        <dt className="text-on-surface-variant">Pontos</dt>
                        <dd className="font-semibold tabular-nums text-on-surface">
                          {row.score}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">
                          Respondidas / ativas
                        </dt>
                        <dd className="font-medium tabular-nums text-on-surface-variant">
                          {row.answeredActiveCount}/{row.activeQuestionCount}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">Posição</dt>
                        <dd className="text-on-surface-variant">
                          {row.activeQuestionCount === 0 ? (
                            <span className="text-outline">—</span>
                          ) : (
                            <span className="whitespace-nowrap font-medium tabular-nums">
                              {row.position}º
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
                        Pontuar
                      </Link>
                      <button
                        type="button"
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-outline-variant/30 px-3 py-2.5 font-body text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
                        title="Editar"
                        onClick={() => startEdit(row)}
                      >
                        <span className="material-symbols-outlined text-xl leading-none">
                          edit
                        </span>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="inline-flex flex-1 min-w-[6rem] items-center justify-center gap-1 rounded-xl px-3 py-2.5 font-body text-sm font-semibold text-error transition-colors hover:bg-error-container/25"
                        title="Excluir"
                        onClick={() => void onDelete(row.id)}
                        disabled={busy === row.id}
                      >
                        <span className="material-symbols-outlined text-xl leading-none">
                          delete
                        </span>
                        Excluir
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
                      <th className="min-w-[11rem] text-left">Nome</th>
                      <th className="text-left">Pontos</th>
                      <th className="text-left">Respondidas / ativas</th>
                      <th className="text-left">Posição</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="font-body text-sm">
                    {group.items.map((row) => (
                      <tr key={row.id} className="fa-tr">
                        <td className="min-w-[11rem] font-semibold text-on-surface [overflow-wrap:anywhere]">
                          {editId === row.id ? (
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-9 min-w-[10rem] border-none bg-surface-container-high"
                            />
                          ) : (
                            row.name
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
                            <span className="text-outline">—</span>
                          ) : (
                            <span className="inline-block whitespace-nowrap">
                              {row.position}º
                            </span>
                          )}
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
                                Salvar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-outline-variant/30"
                                onClick={() => setEditId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-nowrap items-center justify-end gap-0.5">
                              <Link
                                to="/investimentos/$id/pontuacao"
                                params={{ id: row.id }}
                                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 font-body text-xs font-semibold text-on-surface-variant no-underline transition-colors hover:bg-surface-container-high hover:text-primary"
                                title="Pontuar"
                              >
                                <span className="material-symbols-outlined text-xl leading-none">
                                  analytics
                                </span>
                                Pontuar
                              </Link>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                                title="Editar"
                                onClick={() => startEdit(row)}
                              >
                                <span className="material-symbols-outlined text-xl leading-none">
                                  edit
                                </span>
                              </button>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-error-container/30 hover:text-error"
                                title="Excluir"
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

import {
  Link,
  Outlet,
  createFileRoute,
  Navigate,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import {
  createInvestmentTypeFn,
  deleteInvestmentTypeFn,
  listInvestmentTypesWithCounts,
  updateInvestmentTypeFn,
} from '#/lib/investment-server'

export const Route = createFileRoute('/tipos')({
  component: TiposPage,
  loader: async () => await listInvestmentTypesWithCounts(),
})

function TiposPage() {
  const router = useRouter()
  const isTiposIndex = useRouterState({
    select: (s) => {
      const p = s.location.pathname
      return p === '/tipos' || p === '/tipos/'
    },
  })
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const types = Route.useLoaderData()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrder, setEditOrder] = useState(0)

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
    if (!name.trim()) return
    setBusy('create')
    try {
      await createInvestmentTypeFn({ data: { name: name.trim() } })
      setName('')
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const startEdit = (row: (typeof types)[number]) => {
    setEditId(row.id)
    setEditName(row.name)
    setEditOrder(row.sortOrder)
  }

  const cancelEdit = () => setEditId(null)

  const onSaveEdit = async () => {
    if (!editId || !editName.trim()) return
    setBusy(editId)
    try {
      await updateInvestmentTypeFn({
        data: { id: editId, name: editName.trim(), sortOrder: editOrder },
      })
      setEditId(null)
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const onDelete = async (id: string) => {
    const row = types.find((t) => t.id === id)
    const label = row?.name ?? id
    if (
      !confirm(
        `Excluir o tipo "${label}"? Só é possível se não tiver perguntas nem investimentos.`,
      )
    )
      return
    setBusy(id)
    try {
      const res = await deleteInvestmentTypeFn({ data: { id } })
      if (!res.ok) {
        if (res.code === 'HAS_QUESTIONS') {
          alert('Não é possível excluir: existem perguntas neste tipo.')
        } else if (res.code === 'HAS_INVESTMENTS') {
          alert('Não é possível excluir: existem investimentos neste tipo.')
        }
        return
      }
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
    {isTiposIndex ? (
    <main className="w-full max-w-6xl px-4 py-8 sm:p-8 lg:p-12">
      <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 font-body text-sm text-outline">
            <Link
              to="/dashboard"
              className="no-underline hover:text-on-surface"
            >
              Admin
            </Link>
            <span className="text-surface-dim">/</span>
            <span className="text-on-surface">Tipos</span>
          </div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">
            Tipos de investimento
          </h1>
          <p className="mt-2 max-w-lg text-on-surface-variant">
            Gerencie as categorias de ativos do seu portfólio. Defina a ordem de
            exibição e configure os questionários de avaliação.
          </p>
        </div>
      </div>

      <form
        onSubmit={onCreate}
        className="mb-10 flex flex-wrap items-end gap-3 rounded-xl bg-surface-container-low p-4"
      >
        <div className="grid min-w-[200px] flex-1 gap-2">
          <Label
            htmlFor="new-type-name"
            className="font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
          >
            Novo tipo
          </Label>
          <Input
            id="new-type-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Renda fixa"
            className="border-none bg-surface-container-highest"
          />
        </div>
        <Button
          type="submit"
          disabled={busy === 'create'}
          className="rounded-xl bg-primary-container font-headline font-semibold text-on-primary"
        >
          <span className="material-symbols-outlined mr-1 shrink-0 text-lg leading-none">
            add
          </span>
          {busy === 'create' ? 'Salvando…' : 'Adicionar'}
        </Button>
      </form>

      <div className="fa-table-shell">
        <div className="fa-table-inner overflow-x-auto px-2 pb-2 pt-1">
          <table className="fa-table">
            <thead>
              <tr className="fa-th">
                <th className="text-left">Nome</th>
                <th className="text-left">Ordem</th>
                <th className="text-left">Nº de perguntas</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="font-body text-sm">
              {types.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-12 text-center text-on-surface-variant"
                  >
                    Ainda sem tipos. Adicione acima ou cadastre-se para receber
                    tipos sugeridos.
                  </td>
                </tr>
              )}
              {types.map((row) => (
                <tr key={row.id} className="fa-tr">
                  <td className="font-semibold text-on-surface">
                    {editId === row.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-9 border-none bg-surface-container-high"
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-fixed text-on-primary-fixed">
                          <span className="material-symbols-outlined text-lg leading-none">
                            trending_up
                          </span>
                        </div>
                        {row.name}
                      </div>
                    )}
                  </td>
                  <td className="font-medium text-on-surface-variant">
                    {editId === row.id ? (
                      <Input
                        type="number"
                        value={editOrder}
                        onChange={(e) =>
                          setEditOrder(Number.parseInt(e.target.value, 10) || 0)
                        }
                        className="h-9 w-20 border-none bg-surface-container-high"
                      />
                    ) : (
                      String(row.sortOrder).padStart(2, '0')
                    )}
                  </td>
                  <td>
                    <span className="inline-flex items-center rounded-full bg-tertiary-fixed-dim px-2.5 py-0.5 font-label text-xs font-bold text-on-tertiary-fixed-variant">
                      {row.questionCount} perguntas
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {editId === row.id ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void onSaveEdit()}
                            disabled={busy === row.id}
                            className="rounded-lg bg-primary-container text-on-primary"
                          >
                            Salvar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            className="border-outline-variant/30"
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Link
                            to="/tipos/$typeId/perguntas"
                            params={{ typeId: row.id }}
                            className="rounded-lg p-2 text-on-surface-variant no-underline transition-colors hover:bg-surface-container-high hover:text-primary"
                            title="Gerenciar perguntas"
                          >
                            <span className="material-symbols-outlined text-xl leading-none">
                              quiz
                            </span>
                          </Link>
                          <button
                            type="button"
                            title="Editar"
                            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                            onClick={() => startEdit(row)}
                          >
                            <span className="material-symbols-outlined text-xl leading-none">
                              edit
                            </span>
                          </button>
                          <button
                            type="button"
                            title="Excluir"
                            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-error-container/30 hover:text-error"
                            onClick={() => void onDelete(row.id)}
                            disabled={busy === row.id}
                          >
                            <span className="material-symbols-outlined text-xl leading-none">
                              delete
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
    ) : null}
    <Outlet />
    </>
  )
}

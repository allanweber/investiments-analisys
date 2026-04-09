import {
  Link,
  createFileRoute,
  Navigate,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import { authClient } from '#/lib/auth-client'
import {
  createQuestionFn,
  deleteQuestionFn,
  listQuestionsForTypeFn,
  updateQuestionFn,
} from '#/lib/investment-server'

export const Route = createFileRoute('/tipos/$typeId/perguntas')({
  component: PerguntasPage,
  loader: async ({ params }) =>
    await listQuestionsForTypeFn({ data: { typeId: params.typeId } }),
})

function PerguntasPage() {
  const router = useRouter()
  const { typeId } = Route.useParams()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const loaderData = Route.useLoaderData()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editOrder, setEditOrder] = useState(0)
  const [editActive, setEditActive] = useState(true)

  if (sessionPending) {
    return (
      <main className="flex items-center justify-center px-4 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
      </main>
    )
  }

  if (!session?.user) return <Navigate to="/login" />

  const { type, questions } = loaderData
  const refresh = () => router.invalidate()

  if (!type) {
    return (
      <main className="w-full max-w-6xl px-4 py-8 sm:p-8 lg:p-12">
        <p className="font-body text-on-surface-variant">Tipo não encontrado.</p>
        <Link
          to="/tipos"
          className="mt-4 inline-block font-body text-sm font-semibold text-primary underline"
        >
          Voltar para os tipos
        </Link>
      </main>
    )
  }

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    setBusy('create')
    try {
      await createQuestionFn({
        data: { investmentTypeId: typeId, prompt: prompt.trim() },
      })
      setPrompt('')
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const startEdit = (q: (typeof questions)[number]) => {
    setEditId(q.id)
    setEditPrompt(q.prompt)
    setEditOrder(q.sortOrder)
    setEditActive(q.active)
  }

  const onSaveEdit = async () => {
    if (!editId || !editPrompt.trim()) return
    setBusy(editId)
    try {
      await updateQuestionFn({
        data: {
          id: editId,
          prompt: editPrompt.trim(),
          sortOrder: editOrder,
          active: editActive,
        },
      })
      setEditId(null)
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const onDelete = async (id: string) => {
    const q = questions.find((x) => x.id === id)
    if (
      !confirm(
        `Excluir esta pergunta? Se existirem respostas em investimentos, a exclusão será bloqueada.`,
      )
    )
      return
    setBusy(id)
    try {
      const res = await deleteQuestionFn({ data: { id } })
      if (!res.ok && res.code === 'HAS_ANSWERS') {
        alert(
          'Não é possível excluir: existem respostas. Desative a pergunta em vez de excluí-la.',
        )
        return
      }
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="w-full max-w-6xl px-4 py-8 sm:p-8 lg:p-12">
      <div className="mb-10">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-sm text-outline">
          <Link to="/dashboard" className="no-underline hover:text-on-surface">
            Admin
          </Link>
          <span className="text-surface-dim">/</span>
          <Link to="/tipos" className="no-underline hover:text-on-surface">
            Tipos
          </Link>
          <span className="text-surface-dim">/</span>
          <span className="text-on-surface">{type.name}</span>
          <span className="text-surface-dim">/</span>
          <span className="text-on-surface">Perguntas</span>
        </div>
        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">
          Perguntas — {type.name}
        </h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          Perguntas inativas não entram na pontuação; respostas antigas podem
          permanecer no banco de dados.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="mb-10 grid gap-3 rounded-xl bg-surface-container-low p-4"
      >
        <Label
          htmlFor="new-q"
          className="font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
        >
          Nova pergunta
        </Label>
        <Textarea
          id="new-q"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enunciado (sim/não)…"
          rows={3}
          className="border-outline-variant/30 bg-surface-container-highest"
        />
        <div>
          <Button
            type="submit"
            disabled={busy === 'create'}
            className="rounded-xl bg-primary-container font-headline font-semibold text-on-primary"
          >
            <span className="material-symbols-outlined mr-1 shrink-0 text-lg leading-none">
              add
            </span>
            {busy === 'create' ? 'Salvando…' : 'Adicionar pergunta'}
          </Button>
        </div>
      </form>

      <div className="fa-table-shell">
        <div className="fa-table-inner overflow-x-auto px-2 pb-2 pt-1">
          <table className="fa-table">
            <thead>
              <tr className="fa-th">
                <th className="text-left">Texto</th>
                <th className="text-left">Ordem</th>
                <th className="text-left">Ativa</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="font-body text-sm">
              {questions.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-12 text-center text-on-surface-variant"
                  >
                    Sem perguntas. As respostas aqui definem a pontuação dos
                    investimentos deste tipo.
                  </td>
                </tr>
              )}
              {questions.map((q) => (
                <tr key={q.id} className="fa-tr">
                  <td className="align-middle font-medium text-on-surface">
                    {editId === q.id ? (
                      <Textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={2}
                        className="border-outline-variant/30 bg-surface-container-high"
                      />
                    ) : (
                      <span className="line-clamp-2">{q.prompt}</span>
                    )}
                  </td>
                  <td className="align-middle text-on-surface-variant">
                    {editId === q.id ? (
                      <Input
                        type="number"
                        value={editOrder}
                        onChange={(e) =>
                          setEditOrder(Number.parseInt(e.target.value, 10) || 0)
                        }
                        className="h-9 w-20 border-none bg-surface-container-high"
                      />
                    ) : (
                      String(q.sortOrder).padStart(2, '0')
                    )}
                  </td>
                  <td className="align-middle">
                    {editId === q.id ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editActive}
                          onCheckedChange={(v) => setEditActive(!!v)}
                        />
                        <span className="font-label text-xs text-on-surface-variant">
                          {editActive ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    ) : (
                      <span
                        className={
                          q.active
                            ? 'inline-flex items-center rounded-full bg-tertiary-fixed-dim/30 px-2 py-0.5 font-label text-xs font-bold text-on-tertiary-fixed-variant'
                            : 'text-on-surface-variant'
                        }
                      >
                        {q.active ? 'Ativa' : 'Inativa'}
                      </span>
                    )}
                  </td>
                  <td className="align-middle text-right">
                    {editId === q.id ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void onSaveEdit()}
                          disabled={busy === q.id}
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
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          title="Editar"
                          className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
                          onClick={() => startEdit(q)}
                        >
                          <span className="material-symbols-outlined text-xl leading-none">
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-error-container/30 hover:text-error"
                          onClick={() => void onDelete(q.id)}
                          disabled={busy === q.id}
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
    </main>
  )
}

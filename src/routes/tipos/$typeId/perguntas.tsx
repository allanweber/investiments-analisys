import {
  Link,
  createFileRoute,
  Navigate,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'

import { FaDetailsCard, FaMobilePanel } from '#/components/fa/details-card'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import { hasDefaultQuestionPackForTypeName } from '#/db/default-question-bank'
import { authClient } from '#/lib/auth-client'
import { messages } from '#/messages'
import {
  createQuestionFn,
  deleteQuestionFn,
  listQuestionsForTypeFn,
  restoreDefaultQuestionsForTypeFn,
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
  const [restoreMsg, setRestoreMsg] = useState('')

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

  const onRestoreDefaults = async () => {
    if (!confirm(messages.questions.restoreConfirm)) return
    setRestoreMsg('')
    setBusy('restore')
    try {
      const res = await restoreDefaultQuestionsForTypeFn({ data: { typeId } })
      if (!res.ok) {
        if (res.code === 'NO_PACK') {
          setRestoreMsg(messages.questions.restoreNoPack)
        } else {
          setRestoreMsg(messages.questions.restoreFailed)
        }
        return
      }
      setRestoreMsg(
        res.inserted === 0
          ? 'Nada a restaurar: todas as perguntas padrão já existem.'
          : `${res.inserted} pergunta(s) padrão adicionada(s).`,
      )
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm(messages.questions.deleteConfirm)) return
    setBusy(id)
    try {
      const res = await deleteQuestionFn({ data: { id } })
      if (!res.ok && res.code === 'HAS_ANSWERS') {
        alert(messages.questions.deleteBlocked)
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
        {hasDefaultQuestionPackForTypeName(type.name) && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy === 'restore'}
              onClick={() => void onRestoreDefaults()}
              className="border-outline-variant/30"
            >
              <span className="material-symbols-outlined mr-1 shrink-0 text-lg leading-none">
                restore_page
              </span>
              {busy === 'restore'
                ? 'A restaurar…'
                : 'Restaurar perguntas padrão'}
            </Button>
          </div>
        )}
        {restoreMsg && (
          <p className="mt-3 font-body text-sm text-on-surface-variant">
            {restoreMsg}
          </p>
        )}
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

      {questions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-outline-variant/35 bg-surface-container-low/50 py-12 text-center md:hidden">
          <p className="px-4 font-body text-sm text-on-surface-variant">
            Sem perguntas. As respostas aqui definem a pontuação dos
            investimentos deste tipo.
          </p>
        </div>
      )}

      <div className="space-y-3 md:hidden">
        {questions.map((q) =>
          editId === q.id ? (
            <FaMobilePanel key={q.id}>
              <div className="space-y-4">
                <div>
                  <span className="mb-1 block font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                    Texto
                  </span>
                  <Textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={4}
                    className="border-outline-variant/30 bg-surface-container-high"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="mb-1 block font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                      Ordem
                    </span>
                    <Input
                      type="number"
                      value={editOrder}
                      onChange={(e) =>
                        setEditOrder(Number.parseInt(e.target.value, 10) || 0)
                      }
                      className="h-10 border-outline-variant/30 bg-surface-container-high"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <span className="mb-1 block font-label text-[10px] font-bold uppercase tracking-wider text-outline">
                      Ativa
                    </span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editActive}
                        onCheckedChange={(v) => setEditActive(!!v)}
                      />
                      <span className="font-label text-xs text-on-surface-variant">
                        {editActive ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    className="flex-1 bg-primary-container text-on-primary"
                    onClick={() => void onSaveEdit()}
                    disabled={busy === q.id}
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
              key={q.id}
              summary={
                <>
                  <span className="min-w-0 flex-1 text-left font-medium text-on-surface line-clamp-2">
                    {q.prompt}
                  </span>
                  <span className="shrink-0 rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-on-surface-variant">
                    {String(q.sortOrder).padStart(2, '0')}
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
              <p className="font-body text-sm leading-relaxed text-on-surface">
                {q.prompt}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={
                    q.active
                      ? 'inline-flex items-center whitespace-nowrap rounded-full bg-tertiary-fixed-dim/30 px-2 py-0.5 font-label text-xs font-bold text-on-tertiary-fixed-variant'
                      : 'whitespace-nowrap font-label text-xs text-on-surface-variant'
                  }
                >
                  {q.active ? 'Ativa' : 'Inativa'}
                </span>
                <span className="text-on-surface-variant text-xs">
                  Ordem {String(q.sortOrder).padStart(2, '0')}
                </span>
              </div>
              <div className="mt-4 flex gap-2 border-t border-outline-variant/15 pt-4">
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-outline-variant/30 px-3 py-2.5 font-body text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
                  title="Editar"
                  onClick={() => startEdit(q)}
                >
                  <span className="material-symbols-outlined text-xl leading-none">
                    edit
                  </span>
                  Editar
                </button>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2.5 font-body text-sm font-semibold text-error transition-colors hover:bg-error-container/25"
                  title="Excluir"
                  onClick={() => void onDelete(q.id)}
                  disabled={busy === q.id}
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
                <th className="min-w-[18rem] text-left">Texto</th>
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
                  <td className="min-w-[18rem] align-middle font-medium text-on-surface [overflow-wrap:anywhere]">
                    {editId === q.id ? (
                      <Textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={2}
                        className="min-w-[16rem] border-outline-variant/30 bg-surface-container-high"
                      />
                    ) : (
                      <span className="line-clamp-2">{q.prompt}</span>
                    )}
                  </td>
                  <td className="align-middle whitespace-nowrap text-on-surface-variant w-24 min-w-[5.5rem]">
                    {editId === q.id ? (
                      <Input
                        type="number"
                        value={editOrder}
                        onChange={(e) =>
                          setEditOrder(Number.parseInt(e.target.value, 10) || 0)
                        }
                        className="h-9 w-20 shrink-0 border-none bg-surface-container-high"
                      />
                    ) : (
                      String(q.sortOrder).padStart(2, '0')
                    )}
                  </td>
                  <td className="align-middle w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem]">
                    {editId === q.id ? (
                      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                        <Switch
                          checked={editActive}
                          onCheckedChange={(v) => setEditActive(!!v)}
                          className="shrink-0"
                        />
                        <span className="font-label shrink-0 text-xs text-on-surface-variant">
                          {editActive ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    ) : (
                      <span
                        className={
                          q.active
                            ? 'inline-flex items-center whitespace-nowrap rounded-full bg-tertiary-fixed-dim/30 px-2 py-0.5 font-label text-xs font-bold text-on-tertiary-fixed-variant'
                            : 'whitespace-nowrap text-on-surface-variant'
                        }
                      >
                        {q.active ? 'Ativa' : 'Inativa'}
                      </span>
                    )}
                  </td>
                  <td className="align-middle text-right w-[12rem] min-w-[12rem] whitespace-nowrap">
                    {editId === q.id ? (
                      <div className="flex flex-nowrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void onSaveEdit()}
                          disabled={busy === q.id}
                          className="shrink-0 bg-primary-container text-on-primary"
                        >
                          Salvar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 border-outline-variant/30"
                          onClick={() => setEditId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-nowrap justify-end gap-1">
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

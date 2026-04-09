import { Link, createFileRoute, Navigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { authClient } from '#/lib/auth-client'
import {
  loadInvestmentScoringFn,
  saveInvestmentScoringFn,
} from '#/lib/investment-server'

type AnswerChoice = 'unanswered' | 'no' | 'yes'

export const Route = createFileRoute('/investimentos/$id/pontuacao')({
  component: PontuacaoPage,
  loader: async ({ params }) =>
    await loadInvestmentScoringFn({ data: { investmentId: params.id } }),
})

function PontuacaoPage() {
  const router = useRouter()
  const { id } = Route.useParams()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const data = Route.useLoaderData()
  const [choices, setChoices] = useState<Record<string, AnswerChoice>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!data) return
    const next: Record<string, AnswerChoice> = {}
    for (const q of data.questions) {
      const v = data.answerByQuestionId[q.id]
      if (v === undefined) next[q.id] = 'unanswered'
      else next[q.id] = v ? 'yes' : 'no'
    }
    setChoices(next)
  }, [data])

  if (sessionPending) {
    return (
      <main className="flex items-center justify-center px-4 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
      </main>
    )
  }

  if (!session?.user) return <Navigate to="/login" />

  if (!data) {
    return (
      <main className="w-full max-w-6xl px-4 py-8 sm:p-8 lg:p-12">
        <p className="font-body text-on-surface-variant">
          Investimento não encontrado.
        </p>
        <Link
          to="/investimentos"
          className="mt-4 inline-block font-body text-sm font-semibold text-primary underline"
        >
          Voltar para a lista
        </Link>
      </main>
    )
  }

  const { investment, questions } = data

  const liveTotal = questions.reduce((sum, q) => {
    const c = choices[q.id]
    if (c === 'yes') return sum + 1
    if (c === 'no') return sum - 1
    return sum
  }, 0)

  const onSave = async () => {
    setMsg('')
    const answers = questions.map((q) => {
      const c = choices[q.id]
      if (c === 'unanswered') return { questionId: q.id, valueYes: null as null }
      return { questionId: q.id, valueYes: c === 'yes' }
    })

    setBusy(true)
    try {
      const res = await saveInvestmentScoringFn({
        data: { investmentId: id, answers },
      })
      if (!res.ok) {
        setMsg(
          res.code === 'INVALID_QUESTIONS'
            ? 'Dados inválidos. Recarregue a página.'
            : 'Erro ao salvar.',
        )
        return
      }
      setMsg('Salvo.')
      await router.invalidate()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:p-8 lg:p-12">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-sm text-outline">
        <Link to="/dashboard" className="no-underline hover:text-on-surface">
          Admin
        </Link>
        <span className="text-surface-dim">/</span>
        <Link to="/investimentos" className="no-underline hover:text-on-surface">
          Investimentos
        </Link>
        <span className="text-surface-dim">/</span>
        <span className="text-on-surface">Pontuação</span>
      </div>

      <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">
        Pontuação
      </h1>
      <p className="mt-2 font-body text-on-surface-variant">
        <span className="font-semibold text-on-surface">{investment.name}</span>{' '}
        · {investment.typeName}
      </p>

      <div className="mt-6 rounded-xl bg-surface-container-low p-4">
        <p className="font-body text-sm text-on-surface-variant">
          Total (apenas perguntas respondidas):{' '}
          <span className="font-headline text-xl font-bold tabular-nums text-on-surface">
            {liveTotal}
          </span>{' '}
          pontos
        </p>
        <p className="mt-1 font-body text-xs text-outline">
          Sim = +1 · Não = −1 · Não respondida = 0 (não entra na soma)
        </p>
        <p className="mt-2 font-body text-xs text-outline">
          Perguntas ativas: {questions.length}
        </p>
      </div>

      {questions.length === 0 ? (
        <p className="mt-8 font-body text-on-surface-variant">
          Este tipo não tem perguntas ativas.{' '}
          <Link
            to="/tipos/$typeId/perguntas"
            params={{ typeId: investment.investmentTypeId }}
            className="font-semibold text-primary underline"
          >
            Gerenciar perguntas
          </Link>
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {questions.map((q) => (
            <li
              key={q.id}
              className="rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-4 shadow-sm"
            >
              <Label className="font-headline text-base font-semibold text-on-surface">
                {q.prompt}
              </Label>
              <div className="mt-3 max-w-xs">
                <Select
                  value={choices[q.id] ?? 'unanswered'}
                  onValueChange={(v: AnswerChoice) =>
                    setChoices((prev) => ({ ...prev, [q.id]: v }))
                  }
                >
                  <SelectTrigger className="border-outline-variant/30 bg-surface-container-highest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unanswered">Não respondida</SelectItem>
                    <SelectItem value="no">Não (−1)</SelectItem>
                    <SelectItem value="yes">Sim (+1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      )}

      {msg && (
        <p className="mt-6 font-body text-sm text-on-surface-variant">
          {msg}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={busy || questions.length === 0}
          className="rounded-xl bg-primary-container font-headline font-semibold text-on-primary"
        >
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button type="button" variant="outline" asChild className="border-outline-variant/30">
          <Link to="/investimentos">Voltar para a lista</Link>
        </Button>
      </div>
    </main>
  )
}

import { Link, createFileRoute, Navigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import {
  loadInvestmentScoringFn,
  saveInvestmentScoringFn,
} from '#/lib/investment-server'
import { messages as m } from '#/messages'
import { cn } from '#/lib/utils'

type AnswerChoice = 'unanswered' | 'no' | 'yes'

export const Route = createFileRoute('/investimentos/$id/pontuacao')({
  component: PontuacaoPage,
  loader: async ({ params }) =>
    await loadInvestmentScoringFn({ data: { investmentId: params.id } }),
})

function AnswerSegmented({
  value,
  onChange,
}: {
  value: AnswerChoice
  onChange: (v: AnswerChoice) => void
}) {
  const selectedSegment =
    'bg-secondary-container text-on-secondary-container shadow-sm ring-1 ring-inset ring-secondary-token/45'

  const seg = (v: AnswerChoice, label: string, sub?: string) => {
    const selected = value === v
    return (
      <button
        type="button"
        onClick={() => onChange(v)}
        className={cn(
          'flex min-h-[2.75rem] flex-1 flex-col items-center justify-center rounded-lg px-2 py-2 font-body text-sm font-semibold transition-colors',
          selected ? selectedSegment : 'text-on-surface-variant hover:bg-surface-container-high',
        )}
      >
        <span>{label}</span>
        {sub && (
          <span
            className={cn(
              'mt-0.5 font-label text-[10px] font-normal uppercase tracking-wide',
              selected ? 'text-on-secondary-container/85' : 'text-on-surface-variant/90',
            )}
          >
            {sub}
          </span>
        )}
      </button>
    )
  }

  return (
    <div
      className="flex w-full min-w-0 gap-1 rounded-xl bg-surface-container-highest p-1"
      role="group"
      aria-label={m.investments.segmentedAria}
    >
      {seg('unanswered', m.investments.unanswered, m.investments.subZero)}
      {seg('no', m.investments.answerNo, m.investments.subNegOne)}
      {seg('yes', m.investments.answerYes, m.investments.subPlusOne)}
    </div>
  )
}

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

  if (!data) {
    return (
      <main className="w-full max-w-6xl px-4 py-8 sm:p-8 lg:p-12">
        <p className="font-body text-on-surface-variant">
          {m.investments.notFound}
        </p>
        <Link
          to="/investimentos"
          className="mt-4 inline-block font-body text-sm font-semibold text-primary underline"
        >
          {m.investments.backToList}
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
            ? m.investments.saveErrorInvalid
            : m.investments.saveErrorGeneric,
        )
        return
      }
      await router.invalidate()
      await router.navigate({ to: '/investimentos' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="w-full max-w-6xl px-4 py-8 sm:p-8 lg:p-12">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-sm text-outline">
        <Link to="/dashboard" className="no-underline hover:text-on-surface">
          {m.common.admin}
        </Link>
        <span className="text-surface-dim">/</span>
        <Link to="/investimentos" className="no-underline hover:text-on-surface">
          {m.common.crumbInvestimentos}
        </Link>
        <span className="text-surface-dim">/</span>
        <span className="text-on-surface">{m.common.crumbPontuacao}</span>
      </div>

      <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">
        {m.common.crumbPontuacao}
      </h1>
      <p className="mt-2 font-body text-on-surface-variant">
        <span className="font-semibold text-on-surface">{investment.name}</span>{' '}
        · {investment.typeName}
      </p>

      <div className="mt-6 rounded-xl bg-surface-container-low p-4">
        <p className="font-body text-sm text-on-surface-variant">
          {m.investments.totalAnsweredOnly}{' '}
          <span className="font-headline text-xl font-bold tabular-nums text-on-surface">
            {liveTotal}
          </span>{' '}
          {m.investments.pointsWord}
        </p>
        <p className="mt-1 font-body text-xs text-outline">
          {m.scoring.legend}
        </p>
        <p className="mt-2 font-body text-xs text-outline">
          {m.investments.activeQuestionsCount(questions.length)}
        </p>
      </div>

      {questions.length === 0 ? (
        <p className="mt-8 font-body text-on-surface-variant">
          {m.investments.noActiveQuestions}{' '}
          <Link
            to="/tipos/$typeId/perguntas"
            params={{ typeId: investment.investmentTypeId }}
            className="font-semibold text-primary underline"
          >
            {m.investments.linkManageQuestions}
          </Link>
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {questions.map((q) => (
            <li
              key={q.id}
              className="min-w-0 rounded-xl bg-surface-container-lowest p-4 shadow-[0px_12px_32px_-4px_rgba(25,28,30,0.06)]"
            >
              <Label className="font-headline text-base font-semibold text-on-surface">
                {q.prompt}
              </Label>
              <div className="mt-3 w-full min-w-0">
                <AnswerSegmented
                  value={choices[q.id] ?? 'unanswered'}
                  onChange={(v) =>
                    setChoices((prev) => ({ ...prev, [q.id]: v }))
                  }
                />
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

      <div className="mt-8 flex w-full flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" asChild className="border-outline-variant/30">
          <Link to="/investimentos">{m.investments.backToList}</Link>
        </Button>
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={busy || questions.length === 0}
          className="rounded-xl bg-primary-container font-headline font-semibold text-on-primary"
        >
          {busy ? m.common.saving : m.common.save}
        </Button>
      </div>
    </main>
  )
}

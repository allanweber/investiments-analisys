import { Link, createFileRoute, Navigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { runAiScoringForInvestmentsFn } from '@/lib/ai/ai-scoring-server'
import { runComputedChecksForInvestmentsFn } from '@/lib/fundamentals/fundamentals-server'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { confirm } from '@/lib/confirm'
import {
  clearAiSuggestionsFn,
  loadInvestmentScoringFn,
  saveInvestmentScoringFn,
} from '@/lib/scoring-server'
import { messages as m } from '@/messages'
import { cn } from '@/lib/utils'

type AnswerChoice = 'unanswered' | 'no' | 'yes'

function aiErrorMessage(code: string): string {
  switch (code) {
    case 'missing_api_key':
      return m.ai.errorMissingKey
    case 'invalid_api_key':
      return m.ai.errorInvalidKey
    case 'rate_limited':
      return m.ai.errorRateLimited
    case 'refused':
      return m.ai.errorRefused
    case 'not_found':
      return m.ai.errorNotFound
    case 'no_questions':
      return m.ai.errorNoQuestions
    default:
      return m.ai.errorGeneric
  }
}

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
  const [aiRunning, setAiRunning] = useState(false)
  const [aiMsg, setAiMsg] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<
    Record<string, { suggestedYes: boolean | null; reasoning: string; checkedAt: string }>
  >({})
  const [clearingAi, setClearingAi] = useState(false)

  useEffect(() => {
    if (!data) return
    const next: Record<string, AnswerChoice> = {}
    for (const q of data.questions) {
      const v = data.answerByQuestionId[q.id]
      if (v === undefined) next[q.id] = 'unanswered'
      else next[q.id] = v ? 'yes' : 'no'
    }
    setChoices(next)
    setAiSuggestions(
      Object.fromEntries(
        Object.entries(data.aiSuggestionByQuestionId).map(([qId, s]) => [
          qId,
          {
            suggestedYes: s.suggestedYes,
            reasoning: s.reasoning ?? '',
            checkedAt: s.checkedAt ?? '',
          },
        ]),
      ),
    )
  }, [data])

  useEffect(() => {
    if (!data) return
    const hasComputed = data.questions.some((q) => q.kind === 'metric')
    if (!hasComputed) return

    let cancelled = false
    void runComputedChecksForInvestmentsFn({ data: { investmentIds: [id] } })
      .then(([item]) => {
        if (cancelled) return
        if (!item.result.ok) {
          if (item.result.code === 'fetch_error') setAiMsg(m.ai.errorGeneric)
          return
        }
        const suggestions = item.result.suggestions
        setAiSuggestions((prev) => {
          const next = { ...prev }
          for (const s of suggestions) {
            next[s.questionId] = {
              suggestedYes: s.suggestedYes,
              reasoning: s.reasoning,
              checkedAt: s.checkedAt,
            }
          }
          return next
        })
      })
      .catch(() => {
        if (!cancelled) setAiMsg(m.ai.errorGeneric)
      })
    return () => {
      cancelled = true
    }
  }, [data, id])

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
      window.history.back()
    } finally {
      setBusy(false)
    }
  }

  const onRunAi = async () => {
    setAiMsg('')
    setAiRunning(true)
    try {
      const [item] = await runAiScoringForInvestmentsFn({ data: { investmentIds: [id] } })
      const res = item.result
      if (!res.ok) {
        setAiMsg(aiErrorMessage(res.code))
        return
      }
      setAiSuggestions((prev) => {
        const next = { ...prev }
        for (const s of res.suggestions) {
          next[s.questionId] = {
            suggestedYes: s.suggestedYes,
            reasoning: s.reasoning,
            checkedAt: s.checkedAt,
          }
        }
        return next
      })

      // Questions may have just been classified as `kind: 'metric'` for the first time by the
      // call above — that classification is persisted server-side, but our already-loaded `data`
      // doesn't reflect it, so run computed checks unconditionally rather than relying on stale
      // `data.questions` to decide whether any exist.
      const [computedItem] = await runComputedChecksForInvestmentsFn({
        data: { investmentIds: [id] },
      })
      if (computedItem.result.ok) {
        const { suggestions: computedSuggestions } = computedItem.result
        setAiSuggestions((prev) => {
          const next = { ...prev }
          for (const s of computedSuggestions) {
            next[s.questionId] = {
              suggestedYes: s.suggestedYes,
              reasoning: s.reasoning,
              checkedAt: s.checkedAt,
            }
          }
          return next
        })
      } else if (computedItem.result.code === 'fetch_error') {
        setAiMsg(m.ai.errorGeneric)
      }

      // Refresh loader data so `question.kind` (possibly just classified server-side above)
      // is reflected in the suggestion card's icon/label.
      await router.invalidate()
    } catch {
      setAiMsg(m.ai.errorGeneric)
    } finally {
      setAiRunning(false)
    }
  }

  const persistChoices = async (next: Record<string, AnswerChoice>) => {
    const answers = questions.map((q) => {
      const c = next[q.id] ?? 'unanswered'
      return c === 'unanswered'
        ? { questionId: q.id, valueYes: null as null }
        : { questionId: q.id, valueYes: c === 'yes' }
    })
    const res = await saveInvestmentScoringFn({ data: { investmentId: id, answers } })
    if (!res.ok) {
      setMsg(
        res.code === 'INVALID_QUESTIONS'
          ? m.investments.saveErrorInvalid
          : m.investments.saveErrorGeneric,
      )
    }
  }

  const onApplySuggestion = (questionId: string, suggestedYes: boolean | null) => {
    if (suggestedYes === null) return
    const next = { ...choices, [questionId]: suggestedYes ? 'yes' : ('no' as AnswerChoice) }
    setChoices(next)
    void persistChoices(next)
  }

  const applicableSuggestionCount = questions.filter(
    (q) => aiSuggestions[q.id] && aiSuggestions[q.id].suggestedYes !== null,
  ).length

  const onApplyAllSuggestions = async () => {
    if (!(await confirm(m.ai.applyAllConfirm(applicableSuggestionCount)))) return

    const next = { ...choices }
    for (const q of questions) {
      const suggestion = aiSuggestions[q.id]
      if (suggestion && suggestion.suggestedYes !== null) {
        next[q.id] = suggestion.suggestedYes ? 'yes' : 'no'
      }
    }
    setChoices(next)
    await persistChoices(next)

    setClearingAi(true)
    try {
      const res = await clearAiSuggestionsFn({ data: { investmentId: id } })
      if (!res.ok) {
        toast.error(m.ai.clearAllError)
        return
      }
      setAiSuggestions({})
    } finally {
      setClearingAi(false)
    }
  }

  const hasAnySuggestion = questions.some((q) => aiSuggestions[q.id])

  const onClearAiSuggestions = async () => {
    if (!(await confirm(m.ai.clearAllConfirm))) return
    setClearingAi(true)
    try {
      const res = await clearAiSuggestionsFn({ data: { investmentId: id } })
      if (!res.ok) {
        toast.error(m.ai.clearAllError)
        return
      }
      setAiSuggestions({})
      toast.success(m.ai.clearAllSuccess)
    } finally {
      setClearingAi(false)
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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">
            {m.common.crumbPontuacao}
          </h1>
          <p className="mt-2 font-body text-on-surface-variant">
            <span className="font-semibold text-on-surface">{investment.name}</span>{' '}
            · {investment.typeName}
          </p>
        </div>
        <div className="sticky top-4 z-20 flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low/90 p-2 backdrop-blur supports-backdrop-filter:bg-surface-container-low/75">
          {applicableSuggestionCount > 0 && (
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl border-green-600/40 px-4 font-headline text-sm font-bold text-green-700 dark:border-green-500/40 dark:text-green-400"
              onClick={() => void onApplyAllSuggestions()}
              disabled={clearingAi}
            >
              <span className="material-symbols-outlined text-lg leading-none">done_all</span>
              {m.ai.applyAllButton(applicableSuggestionCount)}
            </Button>
          )}
          <Button
            type="button"
            className="h-11 gap-2 rounded-xl bg-primary-container px-5 font-headline text-sm font-bold text-on-primary shadow-md transition-transform hover:scale-[1.02] disabled:scale-100"
            onClick={() => void onRunAi()}
            disabled={aiRunning || questions.length === 0}
          >
            {aiRunning ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/30 border-t-on-primary"
                aria-hidden
              />
            ) : (
              <span className="material-symbols-outlined text-lg leading-none">auto_awesome</span>
            )}
            {aiRunning ? m.ai.running : m.ai.runButton}
          </Button>
          {hasAnySuggestion && (
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl border-error/40 px-4 font-headline text-sm font-bold text-error hover:bg-error-container/20 dark:border-error/50"
              onClick={() => void onClearAiSuggestions()}
              disabled={clearingAi}
            >
              {clearingAi ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-error/30 border-t-error"
                  aria-hidden
                />
              ) : (
                <span className="material-symbols-outlined text-lg leading-none">delete_sweep</span>
              )}
              {m.ai.clearAllButton}
            </Button>
          )}
        </div>
      </div>
      {aiMsg && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-error-container/40 p-3 font-body text-sm text-on-error-container">
          <span className="material-symbols-outlined shrink-0 text-lg leading-none">error</span>
          <span>
            {aiMsg}{' '}
            {(aiMsg === m.ai.errorInvalidKey || aiMsg === m.ai.errorMissingKey) && (
              <Link to="/account/settings" className="font-semibold underline">
                {m.ai.settingsLink}
              </Link>
            )}
          </span>
        </p>
      )}

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
              <p className="select-text font-headline text-base font-semibold text-on-surface">
                {q.prompt}
              </p>
              <div className="mt-3 w-full min-w-0">
                <AnswerSegmented
                  value={choices[q.id] ?? 'unanswered'}
                  onChange={(v) =>
                    setChoices((prev) => ({ ...prev, [q.id]: v }))
                  }
                />
              </div>
              {aiSuggestions[q.id] && (
                <div
                  className={cn(
                    'mt-3 rounded-xl border-l-4 p-3',
                    aiSuggestions[q.id].suggestedYes === null
                      ? 'border-outline-variant/50 bg-surface-container-high/60'
                      : aiSuggestions[q.id].suggestedYes
                        ? 'border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/40'
                        : 'border-error bg-error-container/20',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined shrink-0 text-lg leading-none text-on-surface-variant">
                      {q.kind === 'metric' ? 'calculate' : 'auto_awesome'}
                    </span>
                    <p className="font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      {q.kind === 'metric' ? m.ai.computedLabel : m.ai.suggestionLabel}
                    </p>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 font-label text-[11px] font-bold uppercase tracking-wide',
                        aiSuggestions[q.id].suggestedYes === null
                          ? 'bg-surface-container-highest text-on-surface-variant'
                          : aiSuggestions[q.id].suggestedYes
                            ? 'bg-green-600 text-white dark:bg-green-500'
                            : 'bg-error text-on-error',
                      )}
                    >
                      {aiSuggestions[q.id].suggestedYes === null
                        ? m.ai.suggestionUnknown
                        : aiSuggestions[q.id].suggestedYes
                          ? m.ai.suggestionYes
                          : m.ai.suggestionNo}
                    </span>
                  </div>
                  {aiSuggestions[q.id].reasoning && (
                    <p className="mt-2 font-body text-sm leading-relaxed text-on-surface">
                      {aiSuggestions[q.id].reasoning}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {aiSuggestions[q.id].checkedAt && (
                      <p className="font-body text-xs text-outline">
                        {m.ai.checkedAt(
                          new Date(aiSuggestions[q.id].checkedAt).toLocaleDateString('pt-BR'),
                        )}
                      </p>
                    )}
                    {aiSuggestions[q.id].suggestedYes !== null && (
                      <Button
                        type="button"
                        className={cn(
                          'h-8 gap-1 rounded-lg px-3 text-xs font-semibold',
                          aiSuggestions[q.id].suggestedYes
                            ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
                            : 'bg-primary-container text-on-primary',
                        )}
                        onClick={() =>
                          onApplySuggestion(q.id, aiSuggestions[q.id].suggestedYes)
                        }
                      >
                        <span className="material-symbols-outlined text-sm leading-none">
                          check
                        </span>
                        {m.ai.applyButton}
                      </Button>
                    )}
                  </div>
                </div>
              )}
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
        <Button type="button" variant="outline" className="border-outline-variant/30" onClick={() => window.history.back()}>
          {m.investments.backToList}
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

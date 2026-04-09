/**
 * Pure scoring rules: only **active** questions count; unanswered = 0 and excluded from answered count.
 * Kept separate from DB access for unit tests and a single source of truth with list/overview/scoring screens.
 */

export type ActiveQuestionScore = {
  score: number
  answeredActiveCount: number
  activeQuestionCount: number
}

/**
 * @param activeQuestionIds — IDs of active questions for the investment's type (order irrelevant)
 * @param answerByQuestionId — stored answers for this investment (`questionId` → Sim = true, Não = false); omit unanswered
 */
export function computeScoreFromActiveQuestions(
  activeQuestionIds: readonly string[],
  answerByQuestionId: ReadonlyMap<string, boolean>,
): ActiveQuestionScore {
  let score = 0
  let answeredActiveCount = 0
  for (const qId of activeQuestionIds) {
    const v = answerByQuestionId.get(qId)
    if (v === undefined) continue
    answeredActiveCount += 1
    score += v ? 1 : -1
  }
  return {
    score,
    answeredActiveCount,
    activeQuestionCount: activeQuestionIds.length,
  }
}

/** Ranking within a type: higher score first; tie-break by name (pt-BR locale). */
export function compareInvestmentsByRank(
  a: { score: number; name: string },
  b: { score: number; name: string },
): number {
  if (b.score !== a.score) return b.score - a.score
  return a.name.localeCompare(b.name, 'pt-BR')
}

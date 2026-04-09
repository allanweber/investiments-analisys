import { describe, expect, it } from 'vitest'

import {
  compareInvestmentsByRank,
  computeScoreFromActiveQuestions,
} from '#/lib/investment-scoring'

describe('computeScoreFromActiveQuestions', () => {
  it('returns zeros when there are no active questions', () => {
    expect(computeScoreFromActiveQuestions([], new Map())).toEqual({
      score: 0,
      answeredActiveCount: 0,
      activeQuestionCount: 0,
    })
  })

  it('treats unanswered active questions as 0 and does not count them', () => {
    const active = ['q1', 'q2', 'q3']
    const answers = new Map<string, boolean>([['q1', true]])
    expect(computeScoreFromActiveQuestions(active, answers)).toEqual({
      score: 1,
      answeredActiveCount: 1,
      activeQuestionCount: 3,
    })
  })

  it('uses +1 for Sim and −1 for Não', () => {
    const active = ['a', 'b', 'c', 'd']
    const answers = new Map<string, boolean>([
      ['a', true],
      ['b', false],
      ['c', true],
      ['d', false],
    ])
    expect(computeScoreFromActiveQuestions(active, answers)).toEqual({
      score: 0,
      answeredActiveCount: 4,
      activeQuestionCount: 4,
    })
  })

  it('ignores map entries that are not in the active id list (e.g. inactive historical answers)', () => {
    const active = ['q1']
    const answers = new Map<string, boolean>([
      ['q1', true],
      ['old-inactive', false],
    ])
    expect(computeScoreFromActiveQuestions(active, answers)).toEqual({
      score: 1,
      answeredActiveCount: 1,
      activeQuestionCount: 1,
    })
  })
})

describe('compareInvestmentsByRank', () => {
  it('orders by score descending', () => {
    const rows = [
      { name: 'A', score: 1 },
      { name: 'B', score: 3 },
      { name: 'C', score: 2 },
    ]
    rows.sort(compareInvestmentsByRank)
    expect(rows.map((r) => r.name)).toEqual(['B', 'C', 'A'])
  })

  it('tie-breaks by name with pt-BR collation', () => {
    const rows = [
      { name: 'zebra', score: 2 },
      { name: 'árvore', score: 2 },
    ]
    rows.sort(compareInvestmentsByRank)
    expect(rows.map((r) => r.name)).toEqual(['árvore', 'zebra'])
  })
})

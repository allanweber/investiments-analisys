import { describe, expect, it } from 'vitest'

import {
  compareInvestmentsByRank,
  computeScoreFromActiveQuestions,
  explainScore,
} from '@/lib/investment-scoring'

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

describe('explainScore', () => {
  it('returns empty drivers and unanswered for no active questions', () => {
    expect(explainScore([], new Map())).toEqual({ drivers: [], unanswered: [] })
  })

  it('splits answered (drivers) from unanswered, sorting drivers yes-then-no', () => {
    const questions = [
      { id: 'q1', prompt: 'Pergunta 1' },
      { id: 'q2', prompt: 'Pergunta 2' },
      { id: 'q3', prompt: 'Pergunta 3' },
    ]
    const answers = new Map([
      ['q1', { valueYes: false, note: null, aiReasoning: null }],
      ['q2', { valueYes: true, note: null, aiReasoning: null }],
    ])
    const result = explainScore(questions, answers)
    expect(result.drivers.map((d) => d.questionId)).toEqual(['q2', 'q1'])
    expect(result.drivers[0]).toEqual({
      questionId: 'q2',
      prompt: 'Pergunta 2',
      answer: true,
      note: null,
      aiReasoning: null,
      contribution: 1,
    })
    expect(result.drivers[1].contribution).toBe(-1)
    expect(result.unanswered).toEqual([
      {
        questionId: 'q3',
        prompt: 'Pergunta 3',
        answer: null,
        note: null,
        aiReasoning: null,
        contribution: 0,
      },
    ])
  })

  it('carries a note through with no aiReasoning, and vice versa', () => {
    const questions = [
      { id: 'q1', prompt: 'Tem nota' },
      { id: 'q2', prompt: 'Tem IA' },
    ]
    const answers = new Map([
      ['q1', { valueYes: true, note: 'minha nota', aiReasoning: null }],
      ['q2', { valueYes: false, note: null, aiReasoning: 'raciocínio da IA' }],
    ])
    const result = explainScore(questions, answers)
    const byId = new Map(result.drivers.map((d) => [d.questionId, d]))
    expect(byId.get('q1')?.note).toBe('minha nota')
    expect(byId.get('q1')?.aiReasoning).toBeNull()
    expect(byId.get('q2')?.note).toBeNull()
    expect(byId.get('q2')?.aiReasoning).toBe('raciocínio da IA')
  })
})

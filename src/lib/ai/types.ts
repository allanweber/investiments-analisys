import type { AiProvider } from '@/db/schema'

export type ScoringQuestionInput = {
  id: string
  prompt: string
}

export type ScoringAnswer = {
  questionId: string
  answer: 'yes' | 'no' | 'unknown'
  reasoning: string
}

export type AiScoringUsage = {
  inputTokens: number
  outputTokens: number
}

export type AiScoringBatchInvestment = {
  investmentId: string
  investmentName: string
  fixedIncome: boolean
  questions: ScoringQuestionInput[]
}

export type AiScoringBatchInput = {
  apiKey: string
  investments: AiScoringBatchInvestment[]
}

export type AiScoringBatchAnswers = {
  investmentId: string
  answers: ScoringAnswer[]
}

export type AiScoringBatchResult = {
  perInvestment: AiScoringBatchAnswers[]
  usage: AiScoringUsage
  model: string
}

/** One error the caller can react to distinctly; everything else collapses to `unknown_error`. */
export type AiScoringErrorCode =
  | 'invalid_api_key'
  | 'rate_limited'
  | 'refused'
  | 'unknown_error'

export class AiScoringError extends Error {
  code: AiScoringErrorCode

  constructor(code: AiScoringErrorCode, message: string) {
    super(message)
    this.name = 'AiScoringError'
    this.code = code
  }
}

/** Implemented per LLM provider (Claude today; OpenAI/Gemini to follow). */
export interface AiScoringProvider {
  scoreInvestments: (input: AiScoringBatchInput) => Promise<AiScoringBatchResult>
}

export type { AiProvider }

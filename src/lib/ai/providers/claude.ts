import Anthropic from '@anthropic-ai/sdk'

import { AiScoringError } from '@/lib/ai/types'
import type {
  AiScoringBatchInput,
  AiScoringBatchResult,
  AiScoringProvider,
  ScoringAnswer,
} from '@/lib/ai/types'

export const CLAUDE_SCORING_MODEL = 'claude-haiku-4-5'

const WEB_SEARCH_USES_PER_INVESTMENT = 2
const MAX_TOKENS_PER_INVESTMENT = 1536
const BASE_MAX_TOKENS = 1024
const MAX_TOKENS_CAP = 8192

const outputSchema = {
  type: 'object',
  properties: {
    investments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          investmentId: { type: 'string' },
          answers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                questionId: { type: 'string' },
                answer: { type: 'string', enum: ['yes', 'no', 'unknown'] },
                reasoning: { type: 'string' },
              },
              required: ['questionId', 'answer', 'reasoning'],
              additionalProperties: false,
            },
          },
        },
        required: ['investmentId', 'answers'],
        additionalProperties: false,
      },
    },
  },
  required: ['investments'],
  additionalProperties: false,
} as const

function sourceGuidanceFor(fixedIncome: boolean): string {
  return fixedIncome
    ? 'This is a Brazilian renda fixa instrument (Tesouro Direto, CDB, LCI/LCA, etc.). Prefer Tesouro Direto, the Banco Central (BCB), or the issuing institution as your primary sources.'
    : 'This may be a Brazilian equity, FII, or an international asset. For Brazilian tickers/FIIs, prefer Fundamentus or B3 first; for international tickers, prefer Yahoo Finance first. Only widen your search if the primary source has nothing useful.'
}

function buildSystemPrompt(): string {
  return `You are a financial research assistant. You will be given a list of investments; each has its own name, source guidance, and a list of yes/no questions about it (used to compute an investment score for the user).

For each investment, research it using web search and answer each of its questions "yes", "no", or "unknown".
- Use "unknown" only when you genuinely cannot find enough information to answer confidently — do not guess.
- Follow each investment's own sourceGuidance for where to look first.
- Be economical: you have a limited, shared search budget across all investments in this request — search only as needed to answer confidently, don't over-research any single investment.
- Give a one- or two-sentence reasoning per answer, citing what you found.
- Write the "reasoning" text in Brazilian Portuguese (pt-BR), regardless of the language of your sources.

Respond only with the structured JSON result — one entry per investment (using the exact investmentId provided), each with one answer entry per question (using the exact questionId provided), in the same order given.`
}

function mapAnthropicError(e: unknown): AiScoringError {
  if (e instanceof Anthropic.AuthenticationError) {
    return new AiScoringError('invalid_api_key', 'Claude API key is invalid.')
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new AiScoringError('rate_limited', 'Claude API rate limit reached.')
  }
  const message = e instanceof Error ? e.message : 'Unknown error'
  return new AiScoringError('unknown_error', message)
}

export class ClaudeScoringProvider implements AiScoringProvider {
  async scoreInvestments(input: AiScoringBatchInput): Promise<AiScoringBatchResult> {
    const client = new Anthropic({ apiKey: input.apiKey })
    const count = input.investments.length

    const userContent = JSON.stringify({
      investments: input.investments.map((inv) => ({
        investmentId: inv.investmentId,
        investmentName: inv.investmentName,
        sourceGuidance: sourceGuidanceFor(inv.fixedIncome),
        questions: inv.questions.map((q) => ({ questionId: q.id, prompt: q.prompt })),
      })),
    })

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: CLAUDE_SCORING_MODEL,
      max_tokens: Math.min(MAX_TOKENS_CAP, BASE_MAX_TOKENS + MAX_TOKENS_PER_INVESTMENT * count),
      system: buildSystemPrompt(),
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: WEB_SEARCH_USES_PER_INVESTMENT * count,
        },
      ],
      output_config: { format: { type: 'json_schema', schema: outputSchema } },
      messages: [{ role: 'user', content: userContent }],
    }

    let response: Anthropic.Message
    try {
      response = await client.messages.create(params)
    } catch (e) {
      throw mapAnthropicError(e)
    }

    if (response.stop_reason === 'refusal') {
      throw new AiScoringError('refused', 'Claude declined to answer this request.')
    }

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    )
    if (!textBlock) {
      throw new AiScoringError('unknown_error', 'Claude returned no answer text.')
    }

    let parsed: { investments: Array<{ investmentId: string; answers: ScoringAnswer[] }> }
    try {
      parsed = JSON.parse(textBlock.text)
    } catch {
      throw new AiScoringError('unknown_error', 'Claude returned malformed JSON.')
    }

    return {
      perInvestment: parsed.investments,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: CLAUDE_SCORING_MODEL,
    }
  }
}

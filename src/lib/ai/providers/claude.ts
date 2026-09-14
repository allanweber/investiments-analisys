import Anthropic from '@anthropic-ai/sdk'

import { debugRequest, debugWrite, errorDumpBody } from '@/lib/ai/llm-debug'
import { AiScoringError } from '@/lib/ai/types'
import type {
  AiScoringBatchAnswers,
  AiScoringBatchFailure,
  AiScoringBatchInput,
  AiScoringBatchResult,
  AiScoringProvider,
  AiScoringUsage,
  ScoringAnswer,
} from '@/lib/ai/types'

export const CLAUDE_SCORING_MODEL = 'claude-haiku-4-5'

// A FII/ETF easily has 8-10 distinct factual questions (property locations, vacancy, P/VP,
// dividend history, tenant concentration, ...) that each need their own search angle. Verified
// against real captured requests: with the old "be economical" prompt below, the model did ONE
// generic search for a 9-question FII and answered "unknown" on everything that single search
// didn't happen to cover — not because the budget was low (6 were available, 1 was used), but
// because the prompt told it to hold back. The budget increase alone was not the fix; wording it
// to actively spend the budget per distinct topic is (see buildSystemPrompt).
const WEB_SEARCH_USES_PER_INVESTMENT = 8
// Raised alongside the search budget above: every search's results are themselves response
// content and count against max_tokens, so a stingier per-investment budget quietly pressures the
// model back toward fewer searches to leave room for its final JSON — the opposite of what
// widening the search budget was for.
const MAX_TOKENS_PER_INVESTMENT = 2560
const BASE_MAX_TOKENS = 2048
const MAX_TOKENS_CAP = 8192

/**
 * Haiku 4.5's real output ceiling is ~8192 tokens (no 128K-output support), so
 * `MAX_TOKENS_CAP` above isn't a headroom margin — it's the model's actual limit.
 * A batch of investmentIds up to 10 (the UI's cap) crammed into one request would saturate that
 * cap well before the JSON answer for every question is written, cutting the model's output off
 * mid-JSON — the whole batch then reports as one generic "malformed JSON" failure with zero
 * suggestions for every investment in it. Splitting into several smaller Claude calls, each
 * safely under the cap, fixes that: one call's overflow or search-budget exhaustion no longer
 * takes out every other investment in the same user-facing "Verificar com IA" click. Kept at 2
 * (not 3) now that both budgets above are larger — 2048 + 2560*2 = 7168, still comfortably under
 * the cap with the bigger search budget's token cost included.
 */
const MAX_INVESTMENTS_PER_REQUEST = 2

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
- Use "unknown" only after you have actually searched for that specific fact and failed to find it — never as a default because you didn't look.
- Follow each investment's own sourceGuidance for where to look first.
- One generic search almost never answers every question about an investment. Group its questions by topic (e.g. for a FII: property portfolio/location, leverage/debt, vacancy, dividend history, valuation) and run a separate, specifically targeted search for each topic you don't already have an answer for — don't stop after the first search just because it returned something. You have enough search budget for this; use it.
- If a search attempt errors or returns nothing useful, don't give up on that topic — retry with a different, simpler query (drop qualifiers, try a different source, or search the fund/company's own site or investor-relations page directly). A single failed or unhelpful search is not evidence the information doesn't exist.
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

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

type ChunkResult = { perInvestment: AiScoringBatchAnswers[]; usage: AiScoringUsage }

export class ClaudeScoringProvider implements AiScoringProvider {
  async scoreInvestments(input: AiScoringBatchInput): Promise<AiScoringBatchResult> {
    const client = new Anthropic({ apiKey: input.apiKey })
    const chunks = chunk(input.investments, MAX_INVESTMENTS_PER_REQUEST)

    // allSettled, not all — one chunk truncating or hitting a rate limit must not
    // discard every other chunk's (unrelated investments') successful answers.
    const settled = await Promise.allSettled(chunks.map((c) => this.scoreChunk(client, c)))

    const perInvestment: AiScoringBatchAnswers[] = []
    const failures: AiScoringBatchFailure[] = []
    let inputTokens = 0
    let outputTokens = 0

    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        perInvestment.push(...result.value.perInvestment)
        inputTokens += result.value.usage.inputTokens
        outputTokens += result.value.usage.outputTokens
        return
      }
      const err =
        result.reason instanceof AiScoringError
          ? result.reason
          : new AiScoringError('unknown_error', String(result.reason))
      failures.push({
        investmentIds: chunks[i].map((inv) => inv.investmentId),
        code: err.code,
        message: err.message,
      })
    })

    return {
      perInvestment,
      failures,
      usage: { inputTokens, outputTokens },
      model: CLAUDE_SCORING_MODEL,
    }
  }

  private async scoreChunk(
    client: Anthropic,
    investments: AiScoringBatchInput['investments'],
  ): Promise<ChunkResult> {
    const count = investments.length

    const userContent = JSON.stringify({
      investments: investments.map((inv) => ({
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

    const debugFiles = debugRequest(JSON.stringify(params), 'score')

    let response: Anthropic.Message
    try {
      response = await client.messages.create(params)
    } catch (e) {
      debugWrite(debugFiles?.response, JSON.stringify(errorDumpBody(e)))
      throw mapAnthropicError(e)
    }
    debugWrite(debugFiles?.response, JSON.stringify(response))

    if (response.stop_reason === 'refusal') {
      throw new AiScoringError('refused', 'Claude declined to answer this request.')
    }
    if (response.stop_reason === 'max_tokens') {
      // Distinguish from "malformed JSON" below — this is truncation, not a bad
      // response, so the fix is a smaller MAX_INVESTMENTS_PER_REQUEST/token budget,
      // not a prompt fix. This used to silently fall through to JSON.parse and
      // surface as a generic "malformed JSON" error.
      throw new AiScoringError(
        'unknown_error',
        `Claude response truncated at max_tokens for a batch of ${count} investment(s).`,
      )
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
    }
  }
}

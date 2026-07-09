import type { AiProvider } from '@/db/schema'
import type { AiScoringUsage } from '@/lib/ai/types'

/** $ per million tokens. Update alongside `shared/models.md` pricing when it changes. */
const PRICING_PER_MILLION_TOKENS: Partial<
  Record<AiProvider, Partial<Record<string, { input: number; output: number }>>>
> = {
  claude: {
    'claude-haiku-4-5': { input: 1, output: 5 },
  },
}

function isAiUsageLoggingEnabled(): boolean {
  const v = (process.env.AI_USAGE_LOGGING ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function estimateCostUsd(
  provider: AiProvider,
  model: string,
  usage: AiScoringUsage,
): number | null {
  const price = PRICING_PER_MILLION_TOKENS[provider]?.[model]
  if (!price) return null
  return (
    (usage.inputTokens / 1_000_000) * price.input +
    (usage.outputTokens / 1_000_000) * price.output
  )
}

export function logAiScoringUsage(event: {
  provider: AiProvider
  model: string
  investmentIds: string[]
  usage: AiScoringUsage
}) {
  if (!isAiUsageLoggingEnabled()) return
  const costUsd = estimateCostUsd(event.provider, event.model, event.usage)
  const payload = {
    ts: new Date().toISOString(),
    scope: 'aiScoring',
    provider: event.provider,
    model: event.model,
    investmentIds: event.investmentIds,
    inputTokens: event.usage.inputTokens,
    outputTokens: event.usage.outputTokens,
    costUsd,
  }
  console.info(JSON.stringify(payload))
}

export function logAiScoringError(event: {
  provider: AiProvider
  model: string
  investmentIds: string[]
  code: string
  message: string
}) {
  if (!isAiUsageLoggingEnabled()) return
  const payload = {
    ts: new Date().toISOString(),
    scope: 'aiScoring',
    provider: event.provider,
    model: event.model,
    investmentIds: event.investmentIds,
    error: { code: event.code, message: event.message },
  }
  console.error(JSON.stringify(payload))
}

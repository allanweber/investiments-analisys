import type { AiProvider } from '@/db/schema'
import { ClaudeScoringProvider } from '@/lib/ai/providers/claude'
import type { AiScoringProvider } from '@/lib/ai/types'

export function getAiScoringProvider(provider: AiProvider): AiScoringProvider {
  switch (provider) {
    case 'claude':
      return new ClaudeScoringProvider()
    case 'openai':
    case 'gemini':
      throw new Error(`AI provider "${provider}" is not implemented yet.`)
    default:
      provider satisfies never
      throw new Error(`Unknown AI provider "${provider as string}".`)
  }
}

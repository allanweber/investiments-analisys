import Anthropic from '@anthropic-ai/sdk'

import type { MetricComparator, MetricMode, QuestionMetricSpec } from '@/db/schema'
import { CLAUDE_SCORING_MODEL } from '@/lib/ai/providers/claude'

export type QuestionClassification =
  | { kind: 'metric'; metricSpec: QuestionMetricSpec }
  | { kind: 'websearch'; metricSpec: null }

const outputSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['metric', 'websearch'] },
    metricLabel: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    mode: { anyOf: [{ type: 'string', enum: ['level', 'growth'] }, { type: 'null' }] },
    comparator: { anyOf: [{ type: 'string', enum: ['gt', 'lt'] }, { type: 'null' }] },
    threshold: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    windowYears: { anyOf: [{ type: 'number' }, { type: 'null' }] },
  },
  required: ['kind', 'metricLabel', 'mode', 'comparator', 'threshold', 'windowYears'],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You classify a yes/no investment screening question written by a user of a personal finance app.

Decide whether the question can be answered *deterministically* by looking up one specific line
item or ratio from a company's financial statements (income statement, balance sheet, or a
standard financial ratio) and comparing it against a numeric threshold across some number of
fiscal years — kind "metric". Otherwise — subjective judgment, qualitative facts, or anything not
found on a financial statement (e.g. management quality, leadership position, dividend history
as a boolean fact, sector age, corruption history) — kind "websearch".

The question is not limited to a fixed list of metrics — extract whatever specific line item or
ratio the question actually references, if any. Use the short Portuguese label as it would
literally appear on a Brazilian financial statement or ratio page (e.g. "ROE", "Receita Líquida",
"Lucro Líquido", "EBITDA", "Dívida Líquida/Ebitda", "Margem Líquida", "Margem Bruta", "Dívida
Líquida/Patrimônio Líquido", "P/L", "P/VP", "Dividend Yield").

When kind is "metric", also extract:
- metricLabel: the line item/ratio label described above.
- mode: "level" if the question compares the reported value itself; "growth" if it asks about
  year-over-year growth/increase of that line item.
- comparator: "gt" for "maior que" / "superior a" / "acima de"; "lt" for "menor que" / "inferior
  a" / "abaixo de".
- threshold: the plain numeric value mentioned (for percentages, the number before "%", e.g.
  "maior que 5%" → 5).
- windowYears: how many recent fiscal years must each satisfy the comparison — null if the
  question says "anos anteriores" / "historicamente" / doesn't specify a fixed window (meaning
  "check all available history"), or an integer N if it says "últimos N anos".

If you cannot confidently extract a specific metric label AND threshold AND comparator, classify
as "websearch" instead and set metricLabel/mode/comparator/threshold/windowYears to null.

Respond only with the structured JSON result.`

/** Cheap best-effort classification — callers should tolerate failure by leaving kind null. */
export async function classifyQuestionKind(input: {
  apiKey: string
  prompt: string
}): Promise<QuestionClassification | null> {
  const client = new Anthropic({ apiKey: input.apiKey })

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: CLAUDE_SCORING_MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: outputSchema } },
      messages: [{ role: 'user', content: input.prompt }],
    })
  } catch {
    return null
  }

  if (response.stop_reason === 'refusal') return null
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (!textBlock) return null

  let parsed: {
    kind: 'metric' | 'websearch'
    metricLabel: string | null
    mode: MetricMode | null
    comparator: MetricComparator | null
    threshold: number | null
    windowYears: number | null
  }
  try {
    parsed = JSON.parse(textBlock.text)
  } catch {
    return null
  }

  if (
    parsed.kind === 'metric' &&
    parsed.metricLabel &&
    parsed.mode &&
    parsed.comparator &&
    parsed.threshold != null
  ) {
    return {
      kind: 'metric',
      metricSpec: {
        metricLabel: parsed.metricLabel,
        mode: parsed.mode,
        comparator: parsed.comparator,
        threshold: parsed.threshold,
        windowYears: parsed.windowYears,
      },
    }
  }

  return { kind: 'websearch', metricSpec: null }
}

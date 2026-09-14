import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * `LLM_DEBUG_PROMPTS=1` writes the request/response of every Claude API call to
 * `.llm-debug/`: the exact `MessageCreateParams` body sent (serialized once and
 * reused for both the call and the dump — never re-stringified, so the dump
 * can't drift from what was actually sent), and the response.
 *
 * This project calls Claude through `@anthropic-ai/sdk`'s `messages.create()`,
 * not raw `fetch()`, so there is no literal wire-bytes response to capture
 * without reimplementing the SDK's own parsing (streaming, status-based error
 * classes) ourselves — too risky for a debug-only feature. The response file
 * is `JSON.stringify` of the SDK's parsed `Anthropic.Message` on success, or
 * of `{ name, message, status, error }` (the parsed API error body Anthropic's
 * `APIError` already carries) on failure — a direct field-for-field decode of
 * the JSON body in both cases, not reshaped.
 *
 * Off by default. Read per call (not cached), so flipping it in `.env` takes
 * effect on the next call with no restart. Never enable in production if
 * prompts can carry user PII — this writes them to disk in full, unredacted.
 */
export function promptDebugEnabled(): boolean {
  const raw = (process.env.LLM_DEBUG_PROMPTS ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/** Where the dumps land. Override with `LLM_DEBUG_PROMPTS_DIR`. */
export function promptDebugDir(): string {
  const configured = (process.env.LLM_DEBUG_PROMPTS_DIR ?? '').trim()
  return configured || path.join(process.cwd(), '.llm-debug')
}

/** Distinguishes two calls that start inside the same millisecond. */
let promptDebugSeq = 0

export type PromptDebugFiles = { request: string; response: string } | null

/**
 * Best-effort JSON-able snapshot of a failed SDK call, for the response dump.
 * Anthropic's `APIError` carries `status` and `error` (the parsed API error
 * body) — pull those out when present rather than just `error.message`.
 */
export function errorDumpBody(e: unknown): unknown {
  if (e instanceof Error) {
    const { name, message } = e
    const status = 'status' in e ? e.status : undefined
    const error = 'error' in e ? e.error : undefined
    return { name, message, status, error }
  }
  return { error: String(e) }
}

/** Writes one file, or gives up quietly — debugging must never fail a call. */
export function debugWrite(file: string | undefined, body: string): void {
  if (file === undefined) return
  try {
    writeFileSync(file, body)
  } catch (error) {
    console.warn('llm.debug_write_failed', { err: error, path: file })
  }
}

/**
 * Call this BEFORE `client.messages.create(params)`, with the exact
 * serialized body string you are about to send (not the object
 * re-serialized — reuse the same string for the call and the dump).
 *
 * `tag` is any short label for the call (e.g. `'score'`, `'classify'`) — it
 * only needs to make filenames legible.
 */
export function debugRequest(
  serializedBody: string,
  tag: string,
): PromptDebugFiles {
  if (!promptDebugEnabled()) return null
  const dir = promptDebugDir()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const seq = String(promptDebugSeq++).padStart(3, '0')
  const base = path.join(dir, `${stamp}-${seq}-${tag}`)
  const files = {
    request: `${base}.request.json`,
    response: `${base}.response.json`,
  }
  try {
    mkdirSync(dir, { recursive: true })
  } catch (error) {
    console.warn('llm.debug_write_failed', { err: error, path: dir })
    return null
  }
  debugWrite(files.request, serializedBody)
  // The one console line: short enough that nothing truncates it, and the
  // whole reason the rest went to a file instead of the terminal.
  console.info('llm.debug_prompt', { file: files.request })
  return files
}

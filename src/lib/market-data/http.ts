export async function fetchJson(
  url: string,
  opts?: {
    timeoutMs?: number
    headers?: Record<string, string>
  },
): Promise<unknown> {
  const timeoutMs = opts?.timeoutMs ?? 10_000
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        ...(opts?.headers ?? {}),
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP_${res.status}: ${text.slice(0, 500)}`)
    }
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

export function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}


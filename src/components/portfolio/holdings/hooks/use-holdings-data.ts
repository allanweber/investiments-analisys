import { useEffect, useMemo, useState } from 'react'

import { allocColorForType } from '#/components/portfolio/format'
import { authClient } from '#/lib/auth-client'
import { listPortfolioHoldingsFn, refreshPortfolioQuotesFn } from '#/lib/investment-server'

import type { DonutSegment, HoldingRow } from '../types'

type HoldingsData = Awaited<ReturnType<typeof listPortfolioHoldingsFn>>

type TypeBreakdownEntry = { name: string; mv: number; pl: number }

export type UseHoldingsDataResult = {
  data: HoldingsData | null
  loading: boolean
  isEmpty: boolean
  quotesStale: boolean
  displaySwitchLoading: boolean
  totals: { marketValue: number; lastUpdatedAt: Date | null }
  typeBreakdown: TypeBreakdownEntry[]
  donutSegments: DonutSegment[]
  rows: HoldingRow[]
  refresh: () => Promise<void>
  refreshQuotes: () => Promise<void>
}

export function useHoldingsData(displayCurrency: string): UseHoldingsDataResult {
  const { data: session } = authClient.useSession()
  const [data, setData] = useState<HoldingsData | null>(null)
  const [displaySwitchLoading, setDisplaySwitchLoading] = useState(false)

  useEffect(() => {
    if (!session?.user) return
    let cancelled = false
    setDisplaySwitchLoading(false)
    const t = window.setTimeout(() => {
      if (!cancelled) setDisplaySwitchLoading(true)
    }, 500)

    void listPortfolioHoldingsFn({ data: { displayCurrency } })
      .then((r) => {
        if (cancelled) return
        setData(r)
      })
      .finally(() => {
        window.clearTimeout(t)
        if (!cancelled) setDisplaySwitchLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [session?.user, displayCurrency])

  async function refresh() {
    const refreshed = await listPortfolioHoldingsFn({ data: { displayCurrency } })
    setData(refreshed)
  }

  async function refreshQuotes() {
    try {
      await refreshPortfolioQuotesFn({ data: { displayCurrency } })
    } catch {
      // Fall through to re-read cached quotes
    }
    const refreshed = await listPortfolioHoldingsFn({ data: { displayCurrency } })
    setData(refreshed)
  }

  const rows = data?.rows ?? []

  const totals = useMemo(() => {
    const mv = rows.reduce((acc, r) => acc + (r.marketValue ?? 0), 0)
    const fetched = rows
      .map((r) => (r.quoteFetchedAt ? new Date(r.quoteFetchedAt).getTime() : 0))
      .filter((t) => t > 0)
    const lastUpdatedAt = fetched.length === 0 ? null : new Date(Math.max(...fetched))
    return { marketValue: mv, lastUpdatedAt }
  }, [rows])

  const typeBreakdown = useMemo(() => {
    const map = new Map<string, TypeBreakdownEntry>()
    for (const r of rows) {
      const key = r.investmentTypeName
      const mv = r.marketValue ?? 0
      const pl = r.unrealizedPl ?? 0
      const prev = map.get(key) ?? { name: key, mv: 0, pl: 0 }
      prev.mv += mv
      prev.pl += pl
      map.set(key, prev)
    }
    return [...map.values()].sort((a, b) => b.mv - a.mv)
  }, [rows])

  const donutSegments = useMemo((): DonutSegment[] => {
    const total = rows.reduce((a, r) => a + (r.marketValue ?? 0), 0)
    if (total <= 0) return []
    const by = new Map<string, { investmentTypeId: string; label: string; mv: number }>()
    for (const r of rows) {
      const prev = by.get(r.investmentTypeId) ?? {
        investmentTypeId: r.investmentTypeId,
        label: r.investmentTypeName,
        mv: 0,
      }
      prev.mv += r.marketValue ?? 0
      by.set(r.investmentTypeId, prev)
    }
    return [...by.values()]
      .sort((a, b) => b.mv - a.mv)
      .map((entry) => ({
        investmentTypeId: entry.investmentTypeId,
        label: entry.label,
        pct: (entry.mv / total) * 100,
        color: allocColorForType(entry.investmentTypeId, entry.label),
      }))
  }, [rows])

  return {
    data,
    loading: data === null,
    isEmpty: data !== null && rows.length === 0,
    quotesStale: Boolean(data?.quotesStale),
    displaySwitchLoading,
    totals,
    typeBreakdown,
    donutSegments,
    rows,
    refresh,
    refreshQuotes,
  }
}

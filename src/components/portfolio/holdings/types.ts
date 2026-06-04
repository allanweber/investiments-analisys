import type { listPortfolioHoldingsFn } from '@/lib/portfolio-server'

export type HoldingRow = Awaited<ReturnType<typeof listPortfolioHoldingsFn>>['rows'][number]

export type PortfolioHoldingForm = {
  investmentId: string
  investmentTypeId: string
  ticker: string
  quantity: number
  avgCost: number
  broker: string
  currency: string
  lastOpDate: string
}

export type DonutSegment = {
  investmentTypeId: string
  label: string
  pct: number
  color: string
}

export const HOLDING_CURRENCY_OPTIONS = ['BRL', 'USD', 'EUR'] as const

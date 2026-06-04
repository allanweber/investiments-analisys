import { useEffect, useMemo, useState } from 'react'

import type { HoldingRow } from '../types'

export type UseHoldingsFiltersResult = {
  filterType: string
  setFilterType: (v: string) => void
  filterCurrency: string
  setFilterCurrency: (v: string) => void
  sortBy: 'valor' | 'nome'
  setSortBy: (v: 'valor' | 'nome') => void
  page: number
  setPage: (v: number | ((p: number) => number)) => void
  pageCount: number
  pageRows: HoldingRow[]
  processedRows: HoldingRow[]
  typeFilterOptions: string[]
  currencyFilterOptions: string[]
}

const PAGE_SIZE = 12

export function useHoldingsFilters(rows: HoldingRow[]): UseHoldingsFiltersResult {
  const [filterType, setFilterType] = useState('all')
  const [filterCurrency, setFilterCurrency] = useState('all')
  const [sortBy, setSortBy] = useState<'valor' | 'nome'>('valor')
  const [page, setPage] = useState(1)

  const typeFilterOptions = useMemo(() => {
    const names = [...new Set(rows.map((r) => r.investmentTypeName))]
    return names.sort((a, b) => a.localeCompare(b))
  }, [rows])

  const currencyFilterOptions = useMemo(() => {
    const codes = [...new Set(rows.map((r) => r.currency).filter(Boolean))]
    return codes.sort((a, b) => a.localeCompare(b))
  }, [rows])

  const processedRows = useMemo(() => {
    let result = [...rows]
    if (filterType !== 'all') result = result.filter((r) => r.investmentTypeName === filterType)
    if (filterCurrency !== 'all') result = result.filter((r) => r.currency === filterCurrency)
    result.sort((a, b) =>
      sortBy === 'valor'
        ? (b.marketValue ?? 0) - (a.marketValue ?? 0)
        : (a.ticker ?? a.investmentName).localeCompare(b.ticker ?? b.investmentName, 'pt-BR'),
    )
    return result
  }, [rows, filterType, filterCurrency, sortBy])

  const pageCount = Math.max(1, Math.ceil(processedRows.length / PAGE_SIZE))
  const pageRows = processedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(processedRows.length / PAGE_SIZE))
    setPage((p) => Math.min(p, maxPage))
  }, [processedRows.length])

  useEffect(() => {
    setPage(1)
  }, [filterType, filterCurrency, sortBy])

  return {
    filterType,
    setFilterType,
    filterCurrency,
    setFilterCurrency,
    sortBy,
    setSortBy,
    page,
    setPage,
    pageCount,
    pageRows,
    processedRows,
    typeFilterOptions,
    currencyFilterOptions,
  }
}

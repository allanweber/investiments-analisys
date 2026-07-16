import { memo } from 'react'

import { fmtMoney } from '@/components/portfolio/format'
import { messages as m } from '@/messages'

import type { HoldingRow } from './types'
import type { UseHoldingsFiltersResult } from './hooks/use-holdings-filters'
import { fmtQuantity } from './utils/holdings-format'
import { AssetAvatar } from './AssetAvatar'

type Props = {
  filters: UseHoldingsFiltersResult
  quotesStale: boolean
  displayCurrency: string
  deletingInvestmentId: string | null
  onEdit: (row: HoldingRow) => void
  onAddShares: (row: HoldingRow) => void
  onDelete: (row: HoldingRow) => void
}

function quoteStatusLabel(r: HoldingRow, quotesStale: boolean): string {
  if (r.quoteStatus === 'BOOK_VALUE') return 'Fixa'
  if (r.quoteStatus === 'OK') return quotesStale ? 'ATRASADO' : 'OK'
  if (r.quoteStatus === 'MISSING_QUOTE') return 'AUSENTE'
  return 'INCOMPLETO'
}

function varPctText(r: HoldingRow): string {
  if (r.quoteStatus === 'BOOK_VALUE') {
    const cap = r.rfCapital
    const gross = r.marketValueNative
    return cap > 0 && gross != null
      ? `${(((gross - cap) / cap) * 100).toFixed(1)}%`
      : '—'
  }
  return r.lastPrice != null && r.avgCost > 0
    ? `${(((r.lastPrice - r.avgCost) / r.avgCost) * 100).toFixed(1)}%`
    : '—'
}

function varDir(r: HoldingRow): 'up' | 'down' | null {
  if (r.quoteStatus === 'BOOK_VALUE') {
    const cap = r.rfCapital
    const gross = r.marketValueNative
    if (cap <= 0 || gross == null) return null
    return gross >= cap ? 'up' : 'down'
  }
  if (r.lastPrice == null || r.avgCost <= 0) return null
  return (r.lastPrice - r.avgCost) / r.avgCost >= 0 ? 'up' : 'down'
}

function varColorClass(r: HoldingRow): string {
  const dir = varDir(r)
  if (!dir) return 'text-on-surface'
  return dir === 'up' ? 'text-tertiary-fixed-dim' : 'text-error'
}

type RowProps = {
  r: HoldingRow
  quotesStale: boolean
  displayCurrency: string
  isDeleting: boolean
  onEdit: (row: HoldingRow) => void
  onAddShares: (row: HoldingRow) => void
  onDelete: (row: HoldingRow) => void
}

const HoldingCardRow = memo(function HoldingCardRowImpl({
  r,
  quotesStale,
  displayCurrency,
  isDeleting,
  onEdit,
  onAddShares,
  onDelete,
}: RowProps) {
  const label = quoteStatusLabel(r, quotesStale)
  const statusClass =
    r.quoteStatus === 'BOOK_VALUE' || label === 'OK'
      ? 'text-tertiary-fixed-dim'
      : label === 'AUSENTE'
        ? 'text-outline'
        : 'text-error'
  const dir = varDir(r)
  return (
    <div className="flex overflow-hidden rounded-2xl bg-surface-container-low">
      <div
        className="min-w-0 flex-1 cursor-pointer p-3 text-left outline-none transition-colors hover:bg-surface-container-high/30 focus-visible:ring-2 focus-visible:ring-primary"
        role="button"
        tabIndex={0}
        onClick={() => onEdit(r)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onEdit(r)
          }
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-headline text-base font-extrabold text-on-surface">
              {r.ticker ?? r.investmentName}
            </p>
            <p className="text-xs text-outline">{r.investmentTypeName}</p>
          </div>
          <span
            className={`shrink-0 whitespace-nowrap text-xs font-bold uppercase ${statusClass}`}
          >
            {label}
          </span>
        </div>
        <div className="mt-3 flex justify-between gap-2 text-sm">
          <span className="shrink-0 text-outline">Quantidade</span>
          <span className="whitespace-nowrap font-semibold tabular-nums text-on-surface">
            {fmtQuantity(r.quantity)}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2 text-sm">
          <span className="shrink-0 text-outline">Variação</span>
          <span
            className={`whitespace-nowrap font-semibold ${varColorClass(r)}`}
          >
            <span className="inline-flex items-center gap-0.5">
              {dir && (
                <span className="material-symbols-outlined text-[10px] leading-none">
                  {dir === 'up' ? 'north_east' : 'south_east'}
                </span>
              )}
              <span>{varPctText(r)}</span>
            </span>
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2 text-sm">
          <span className="shrink text-outline">Valor nativo</span>
          <span className="whitespace-nowrap font-bold text-on-surface">
            {r.marketValueNative == null
              ? '—'
              : fmtMoney(r.marketValueNative, r.currency)}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2 text-sm">
          <span className="shrink text-outline">Valor ({displayCurrency})</span>
          <span className="whitespace-nowrap font-bold text-on-surface">
            {r.fxUnavailable || r.marketValueDisplay == null
              ? '—'
              : fmtMoney(r.marketValueDisplay, displayCurrency)}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col justify-center gap-1 bg-surface-container px-1 py-2">
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-primary hover:bg-primary/10"
          aria-label="Adicionar cotas"
          onClick={(e) => {
            e.stopPropagation()
            onAddShares(r)
          }}
        >
          <span className="material-symbols-outlined text-[22px]">
            add_circle
          </span>
        </button>
        <button
          type="button"
          disabled={isDeleting}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-error hover:bg-error-container/45 disabled:opacity-45"
          aria-label={`Excluir posição ${r.ticker ?? r.investmentName}`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(r)
          }}
        >
          <span className="material-symbols-outlined text-[22px]">delete</span>
        </button>
      </div>
    </div>
  )
})

const HoldingTableRow = memo(function HoldingTableRowImpl({
  r,
  quotesStale,
  displayCurrency,
  isDeleting,
  onEdit,
  onAddShares,
  onDelete,
}: RowProps) {
  const label = quoteStatusLabel(r, quotesStale)
  const statusPillClass =
    r.quoteStatus === 'BOOK_VALUE' || label === 'OK'
      ? 'bg-tertiary-fixed-dim/25 text-on-tertiary-container'
      : 'bg-error-container/55 text-error'
  const dir = varDir(r)
  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-surface-container-high/25"
      tabIndex={0}
      onClick={() => onEdit(r)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit(r)
        }
      }}
    >
      <td className="py-3">
        <div className="flex items-center gap-2">
          <AssetAvatar
            logoUrl={r.quoteLogoUrl}
            label={r.ticker ?? r.investmentName}
          />
          <div className="min-w-0">
            <div className="truncate font-medium text-on-surface">
              {r.ticker ?? r.investmentName}
            </div>
            <div className="text-xs text-outline">{r.investmentTypeName}</div>
          </div>
        </div>
      </td>
      <td className="hidden py-3 text-right tabular-nums text-on-surface lg:table-cell">
        {fmtQuantity(r.quantity)}
      </td>
      <td className="py-3 text-right font-semibold text-on-surface">
        {r.marketValueNative == null
          ? '—'
          : fmtMoney(r.marketValueNative, r.currency)}
      </td>
      <td className="py-3 text-right font-semibold text-on-surface">
        {r.fxUnavailable || r.marketValueDisplay == null
          ? '—'
          : fmtMoney(r.marketValueDisplay, displayCurrency)}
      </td>
      <td className={`py-3 text-right font-semibold ${varColorClass(r)}`}>
        <span className="inline-flex items-center justify-end gap-1">
          {dir && (
            <span className="material-symbols-outlined text-[13px] leading-none">
              {dir === 'up' ? 'north_east' : 'south_east'}
            </span>
          )}
          <span>{varPctText(r)}</span>
        </span>
      </td>
      <td className="hidden py-3 text-right text-on-surface lg:table-cell">
        {r.quoteStatus === 'BOOK_VALUE'
          ? r.marketValueNative == null
            ? '—'
            : fmtMoney(r.marketValueNative, r.currency)
          : r.lastPrice == null
            ? '—'
            : fmtMoney(r.lastPrice, r.currency)}
      </td>
      <td className="py-3 text-right">
        <span
          className={`whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusPillClass}`}
        >
          {label}
        </span>
      </td>
      <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary/10"
            aria-label="Adicionar cotas"
            onClick={() => onAddShares(r)}
          >
            <span className="material-symbols-outlined text-[22px]">
              add_circle
            </span>
          </button>
          <button
            type="button"
            disabled={isDeleting}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-error hover:bg-error-container/50 disabled:opacity-45"
            aria-label={`Excluir posição ${r.ticker ?? r.investmentName}`}
            onClick={() => onDelete(r)}
          >
            <span className="material-symbols-outlined text-[20px]">
              delete
            </span>
          </button>
        </div>
      </td>
    </tr>
  )
})

export function HoldingsListSection({
  filters,
  quotesStale,
  displayCurrency,
  deletingInvestmentId,
  onEdit,
  onAddShares,
  onDelete,
}: Props) {
  const {
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
  } = filters

  return (
    <section className="rounded-2xl bg-surface-container-lowest p-3 md:p-8 lg:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-headline text-base font-extrabold text-on-surface">
          Principais Ativos
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface">
            <span className="text-outline">Classe</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="max-w-[10rem] border-0 bg-transparent text-xs font-bold text-on-surface outline-none"
            >
              <option value="all">Todas</option>
              {typeFilterOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface">
            <span className="text-outline">Moeda</span>
            <select
              value={filterCurrency}
              onChange={(e) => setFilterCurrency(e.target.value)}
              className="max-w-[6rem] border-0 bg-transparent text-xs font-bold text-on-surface outline-none"
            >
              <option value="all">Todas</option>
              {currencyFilterOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface">
            <span className="text-outline">Ordenar</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'valor' | 'nome')}
              className="border-0 bg-transparent text-xs font-bold text-on-surface outline-none"
            >
              <option value="valor">Valor</option>
              <option value="nome">Nome</option>
            </select>
          </label>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="mt-5 space-y-3 md:hidden">
        {pageRows.map((r) => (
          <HoldingCardRow
            key={r.investmentId}
            r={r}
            quotesStale={quotesStale}
            displayCurrency={displayCurrency}
            isDeleting={deletingInvestmentId === r.investmentId}
            onEdit={onEdit}
            onAddShares={onAddShares}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Desktop table */}
      <div className="mt-5 hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-bold uppercase tracking-widest text-outline">
            <tr>
              <th className="py-2 text-left">Ativo</th>
              <th className="hidden py-2 text-right lg:table-cell">
                Quantidade
              </th>
              <th className="py-2 text-right">
                {m.portfolio.holdingsNativeValue}
              </th>
              <th className="py-2 text-right">
                {m.portfolio.holdingsDisplayValue(displayCurrency)}
              </th>
              <th className="py-2 text-right">Variação</th>
              <th className="hidden py-2 text-right lg:table-cell">
                Preço atual
              </th>
              <th className="py-2 text-right">Status</th>
              <th className="min-w-[7rem] py-2 text-right">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {pageRows.map((r) => (
              <HoldingTableRow
                key={r.investmentId}
                r={r}
                quotesStale={quotesStale}
                displayCurrency={displayCurrency}
                isDeleting={deletingInvestmentId === r.investmentId}
                onEdit={onEdit}
                onAddShares={onAddShares}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex flex-col gap-3 border-t border-outline-variant/10 pt-4 text-xs text-outline sm:flex-row sm:items-center sm:justify-between">
        <p>
          Mostrando {pageRows.length} de {processedRows.length}{' '}
          {processedRows.length === 1 ? 'ativo' : 'ativos'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/30 text-on-surface disabled:opacity-40"
            aria-label="Página anterior"
          >
            <span className="material-symbols-outlined text-lg">
              chevron_left
            </span>
          </button>
          <span className="min-w-[2rem] text-center font-bold text-on-surface">
            {page}
          </span>
          <span className="text-outline">/</span>
          <span className="min-w-[2rem] text-center font-bold text-on-surface">
            {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/30 text-on-surface disabled:opacity-40"
            aria-label="Próxima página"
          >
            <span className="material-symbols-outlined text-lg">
              chevron_right
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}

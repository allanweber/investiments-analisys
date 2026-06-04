import { Navigate, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { z } from 'zod'

import { useDisplayCurrency } from '#/hooks/use-display-currency'
import { authClient } from '#/lib/auth-client'
import { messages as m } from '#/messages'

import { DonutAllocation } from '#/components/portfolio/holdings/DonutAllocation'
import { HoldingsEmptyState } from '#/components/portfolio/holdings/HoldingsEmptyState'
import { HoldingsListSection } from '#/components/portfolio/holdings/HoldingsListSection'
import { HoldingsPageHeader } from '#/components/portfolio/holdings/HoldingsPageHeader'
import { HoldingsSummaryStrip } from '#/components/portfolio/holdings/HoldingsSummaryStrip'
import { StaleQuotesBanner } from '#/components/portfolio/holdings/StaleQuotesBanner'
import { StrategyDriftBanner } from '#/components/portfolio/holdings/StrategyDriftBanner'
import { useAddToPosition } from '#/components/portfolio/holdings/hooks/use-add-to-position'
import { useHoldingForm } from '#/components/portfolio/holdings/hooks/use-holding-form'
import { useHoldingModal } from '#/components/portfolio/holdings/hooks/use-holding-modal'
import { useHoldingsData } from '#/components/portfolio/holdings/hooks/use-holdings-data'
import { useHoldingsFilters } from '#/components/portfolio/holdings/hooks/use-holdings-filters'
import { ChooseAssetClassModal } from '#/components/portfolio/holdings/modals/ChooseAssetClassModal'
import { DeleteConfirmModal } from '#/components/portfolio/holdings/modals/DeleteConfirmModal'
import { FixedIncomeComingSoonModal } from '#/components/portfolio/holdings/modals/FixedIncomeComingSoonModal'
import { AddEditHoldingModal } from '#/components/portfolio/holdings/modals/AddEditHoldingModal'
import { AddToPositionModal } from '#/components/portfolio/holdings/modals/AddToPositionModal'

export const Route = createFileRoute('/portfolio/holdings')({
  validateSearch: z.object({
    add: z.literal('1').optional(),
  }),
  component: HoldingsPage,
})

function HoldingsPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { data: session, isPending } = authClient.useSession()
  const { displayCurrency, setDisplayCurrency, displayCurrencyOptions } = useDisplayCurrency()

  const holdingsData = useHoldingsData(displayCurrency)
  const filters = useHoldingsFilters(holdingsData.rows)
  const modal = useHoldingModal()
  const form = useHoldingForm({
    rows: holdingsData.rows,
    modal,
    displayCurrency,
    refresh: holdingsData.refresh,
  })
  const addToPos = useAddToPosition({ modal, refresh: holdingsData.refresh })

  const handledAddRef = useRef(false)

  // Handle ?add=1 deep-link — open choose-asset-class modal then clear the param
  useEffect(() => {
    if (search.add !== '1') { handledAddRef.current = false; return }
    if (handledAddRef.current) return
    handledAddRef.current = true
    modal.openChooseAssetClass()
    window.setTimeout(() => {
      void navigate({ to: '/portfolio/holdings', search: {}, replace: true })
    }, 0)
  }, [search.add])

  if (isPending) {
    return (
      <main
        role="status"
        className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4"
      >
        <span className="sr-only">{m.common.loading}</span>
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-outline-variant border-t-primary" aria-hidden />
      </main>
    )
  }

  if (!session?.user) return <Navigate to="/login" />

  return (
    <main className="w-full max-w-7xl px-4 py-8 sm:p-8 lg:p-12">
      {holdingsData.quotesStale && <StaleQuotesBanner onReconnect={holdingsData.refreshQuotes} />}

      <HoldingsPageHeader
        displayCurrency={displayCurrency}
        displayCurrencyOptions={displayCurrencyOptions}
        onChangeCurrency={setDisplayCurrency}
        displaySwitchLoading={holdingsData.displaySwitchLoading}
        holdingsInitialLoading={holdingsData.loading}
        onAddPosition={modal.openChooseAssetClass}
      />

      {holdingsData.loading ? (
        <section
          role="status"
          aria-live="polite"
          className="flex min-h-[42vh] flex-col items-center justify-center gap-4 rounded-3xl bg-surface-container-low/40 px-6 py-16 ring-1 ring-outline-variant/10"
        >
          <span className="sr-only">{m.common.loading}</span>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-outline-variant border-t-primary" aria-hidden />
          <p className="text-sm font-medium text-on-surface-variant">Carregando sua carteira…</p>
        </section>
      ) : holdingsData.isEmpty ? (
        <HoldingsEmptyState onAdd={modal.openChooseAssetClass} />
      ) : (
        <div
          className={
            holdingsData.donutSegments.length > 0
              ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,360px)] lg:items-start lg:gap-10'
              : 'w-full'
          }
        >
          <div className="min-w-0 w-full">
            <HoldingsSummaryStrip
              displayCurrency={displayCurrency}
              marketValue={holdingsData.totals.marketValue}
              lastUpdatedAt={holdingsData.totals.lastUpdatedAt}
              quotesStale={holdingsData.quotesStale}
              typeBreakdown={holdingsData.typeBreakdown}
            />
          </div>

          {holdingsData.donutSegments.length > 0 && (
            <aside className="mt-10 lg:mt-0">
              <DonutAllocation segments={holdingsData.donutSegments} />
            </aside>
          )}

          <HoldingsListSection
            filters={filters}
            quotesStale={holdingsData.quotesStale}
            displayCurrency={displayCurrency}
            deletingInvestmentId={form.deletingInvestmentId}
            onEdit={form.openEditFromRow}
            onAddShares={modal.openAddToPosition}
            onDelete={form.requestDelete}
          />

          <StrategyDriftBanner />
        </div>
      )}

      <ChooseAssetClassModal modal={modal} form={form} />
      <FixedIncomeComingSoonModal modal={modal} />
      <AddEditHoldingModal modal={modal} form={form} rows={holdingsData.rows} />
      <AddToPositionModal modal={modal} addToPos={addToPos} />
      <DeleteConfirmModal
        pending={form.pendingDelete}
        deletingId={form.deletingInvestmentId}
        onConfirm={form.executeDelete}
        onCancel={form.cancelDelete}
      />
    </main>
  )
}

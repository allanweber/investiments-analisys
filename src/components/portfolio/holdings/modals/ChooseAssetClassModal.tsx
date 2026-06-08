import { messages as m } from '@/messages'

import type { UseHoldingModalResult } from '../hooks/use-holding-modal'
import type { UseHoldingFormResult } from '../hooks/use-holding-form'

type Props = {
  modal: UseHoldingModalResult
  form: UseHoldingFormResult
}

export function ChooseAssetClassModal({ modal, form }: Props) {
  if (modal.state.kind !== 'chooseAssetClass') return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4 sm:py-10"
      data-holding-modal="choose-asset-class"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface px-6 pb-8 pt-6 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:px-8 sm:pb-10 sm:pt-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
              {m.portfolio.addPositionTitle}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-outline">
              {m.portfolio.chooseAssetClassSubtitle}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full p-2 text-outline transition-colors hover:bg-surface-container-low"
            onClick={modal.close}
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-2xl leading-none">close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            type="button"
            className="flex w-full items-start gap-4 rounded-2xl bg-surface-container-low p-5 text-left shadow-md ring-1 ring-outline-variant/10 transition-colors hover:bg-surface-container-high"
            onClick={form.openVariableAddModal}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim">
              <span className="material-symbols-outlined text-2xl">candlestick_chart</span>
            </span>
            <span className="min-w-0">
              <span className="font-headline block text-base font-extrabold text-on-surface">
                {m.portfolio.chooseVariableIncome}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                {m.portfolio.chooseVariableIncomeHint}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="flex w-full items-start gap-4 rounded-2xl bg-surface-container-low p-5 text-left shadow-md ring-1 ring-outline-variant/10 transition-colors hover:bg-surface-container-high"
            onClick={modal.openAddFixedIncome}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container/25 text-primary-container">
              <span className="material-symbols-outlined text-2xl">savings</span>
            </span>
            <span className="min-w-0">
              <span className="font-headline block text-base font-extrabold text-on-surface">
                {m.portfolio.chooseFixedIncome}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                {m.portfolio.chooseFixedIncomeHint}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

import { messages as m } from '#/messages'

import type { UseHoldingModalResult } from '../hooks/use-holding-modal'

type Props = {
  modal: UseHoldingModalResult
}

export function FixedIncomeComingSoonModal({ modal }: Props) {
  if (modal.state.kind !== 'fixedIncomeComingSoon') return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4 sm:py-10"
      data-holding-modal="fixed-income-coming-soon"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-surface px-6 pb-8 pt-6 shadow-2xl sm:rounded-3xl sm:px-8 sm:pb-10 sm:pt-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
            {m.portfolio.fixedIncomeComingSoonTitle}
          </h3>
          <button
            type="button"
            className="shrink-0 rounded-full p-2 text-outline transition-colors hover:bg-surface-container-low"
            onClick={modal.close}
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-2xl leading-none">close</span>
          </button>
        </div>
        <p className="text-sm leading-relaxed text-on-surface-variant">
          {m.portfolio.fixedIncomeComingSoonBody}
        </p>
        <button
          type="button"
          className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-primary-container px-8 py-3 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95"
          onClick={modal.close}
        >
          {m.portfolio.fixedIncomeComingSoonOk}
        </button>
      </div>
    </div>
  )
}

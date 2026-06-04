import { DisplayCurrencySelector } from '#/components/portfolio/display-currency-selector'
import type { FxCurrency } from '#/lib/fx'
import { messages as m } from '#/messages'

type Props = {
  displayCurrency: FxCurrency
  displayCurrencyOptions: readonly FxCurrency[]
  onChangeCurrency: (c: FxCurrency) => void
  displaySwitchLoading: boolean
  holdingsInitialLoading: boolean
  onAddPosition: () => void
}

export function HoldingsPageHeader({
  displayCurrency,
  displayCurrencyOptions,
  onChangeCurrency,
  displaySwitchLoading,
  holdingsInitialLoading,
  onAddPosition,
}: Props) {
  return (
    <section className="mb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
            Posições
          </h1>
          <p className="mt-3 text-sm text-on-surface-variant">{m.portfolio.holdingsRecordingNote}</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <DisplayCurrencySelector
              value={displayCurrency}
              options={displayCurrencyOptions}
              onChange={onChangeCurrency}
            />
            {displaySwitchLoading && !holdingsInitialLoading && (
              <span
                className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
                aria-label="Carregando moeda"
              />
            )}
          </div>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary-container px-6 py-3 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95"
          onClick={onAddPosition}
        >
          <span className="material-symbols-outlined text-[20px] leading-none">add</span>
          Adicionar posição
        </button>
      </div>
    </section>
  )
}

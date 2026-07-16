import type { FxCurrency } from '@/lib/fx'
import { messages as m } from '@/messages'

type Props = {
  value: FxCurrency
  options: readonly FxCurrency[]
  onChange: (c: FxCurrency) => void
}

export function DisplayCurrencySelector({ value, options, onChange }: Props) {
  return (
    <div className="mt-4">
      <p id="display-currency-label" className="mb-2 text-[10px] font-bold uppercase tracking-widest text-outline">
        {m.portfolio.displayCurrencyLabel}
      </p>
      <div
        role="radiogroup"
        aria-labelledby="display-currency-label"
        className="inline-flex rounded-full bg-surface-container-low p-1 shadow-inner"
      >
        {options.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === value}
            onClick={() => onChange(c)}
            className={`flex h-11 min-w-11 items-center justify-center rounded-full px-5 text-xs font-bold transition-all ${
              c === value
                ? 'bg-surface text-on-surface shadow-sm'
                : 'text-outline hover:text-on-surface'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}

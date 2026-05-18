import type { FxCurrency } from '#/lib/fx'
import { messages as m } from '#/messages'

type Props = {
  value: FxCurrency
  options: readonly FxCurrency[]
  onChange: (c: FxCurrency) => void
}

export function DisplayCurrencySelector({ value, options, onChange }: Props) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-outline">
        {m.portfolio.displayCurrencyLabel}
      </p>
      <div className="inline-flex rounded-full bg-surface-container-low p-1 shadow-inner">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
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

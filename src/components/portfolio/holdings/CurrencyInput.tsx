import { useDecimalInput } from './hooks/use-decimal-input'
import { formatCurrencyFixed } from './utils/currency-input'

type Props = {
  value: number
  currency: string
  label: string
  disabled?: boolean
  hasError?: boolean
  onChange: (value: number) => void
  className?: string
}

export function CurrencyInput({ value, currency, label, disabled, hasError, onChange, className }: Props) {
  const { inputProps } = useDecimalInput({
    value,
    decimals: 2,
    format: (cents) => formatCurrencyFixed(cents / 100, currency),
    onChange,
  })

  return (
    <label className={`block text-[10px] font-bold uppercase tracking-widest text-outline ${className ?? ''}`}>
      {label}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        {...inputProps}
        className={`mt-2 w-full border-0 border-b-2 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50 ${
          hasError ? 'border-error focus:border-error' : 'border-outline-variant/50'
        }`}
      />
    </label>
  )
}

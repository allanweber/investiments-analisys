import { useDecimalInput } from './hooks/use-decimal-input'

type Props = {
  value: number
  label: string
  placeholder?: string
  disabled?: boolean
  className?: string
  decimals?: number
  onChange: (value: number) => void
}

function makeFormat(decimals: number): (cents: number) => string {
  const scale = Math.pow(10, decimals)
  return (cents) => {
    if (cents === 0) return ''
    const int = Math.floor(cents / scale)
    const frac = cents % scale
    return `${int},${frac.toString().padStart(decimals, '0')}`
  }
}

export function PercentInput({ value, label, placeholder, disabled, className, decimals = 2, onChange }: Props) {
  const scale = Math.pow(10, decimals)
  const maxCents = 99_999 * scale  // 99 999.xxx… %
  const format = makeFormat(decimals)
  const { inputProps } = useDecimalInput({ value, decimals, maxCents, format, onChange })

  return (
    <label className={`block text-[10px] font-bold uppercase tracking-widest text-outline ${className ?? ''}`}>
      {label}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        {...inputProps}
        className="mt-2 w-full border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
      />
    </label>
  )
}

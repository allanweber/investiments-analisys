import { useRef, useState } from 'react'

type UseDecimalInputOptions = {
  value: number
  decimals?: number
  maxCents?: number
  format: (cents: number) => string
  onChange: (value: number) => void
}

type InputProps = {
  value: string
  onFocus: () => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function useDecimalInput({
  value,
  decimals = 2,
  maxCents,
  format,
  onChange,
}: UseDecimalInputOptions): { inputProps: InputProps } {
  const scale = Math.pow(10, decimals)
  const [focused, setFocused] = useState(false)
  const [cents, setCents] = useState(0)
  const centsRef = useRef(0)

  function valueToCents(n: number): number {
    const raw = Math.round(n * scale)
    return maxCents !== undefined ? Math.min(raw, maxCents) : raw
  }

  function push(next: number) {
    const lo = Math.max(0, next)
    const clamped = maxCents !== undefined ? Math.min(lo, maxCents) : lo
    centsRef.current = clamped
    setCents(clamped)
    onChange(clamped / scale)
  }

  const inputProps: InputProps = {
    value: focused ? format(cents) : format(valueToCents(value)),
    onFocus: () => {
      const initial = valueToCents(value)
      centsRef.current = initial
      setCents(initial)
      setFocused(true)
    },
    onBlur: () => {
      setFocused(false)
      onChange(centsRef.current / scale)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.metaKey || e.ctrlKey || e.key === 'Tab') return
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        push(centsRef.current * 10 + parseInt(e.key, 10))
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        push(Math.floor(centsRef.current / 10))
      } else if (e.key !== 'Escape' && e.key !== 'Enter') {
        e.preventDefault()
      }
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      // Mobile fallback: virtual keyboards don't fire keydown reliably
      const ev = e.nativeEvent as InputEvent
      if (ev.data !== null && ev.data >= '0' && ev.data <= '9') {
        push(centsRef.current * 10 + parseInt(ev.data, 10))
      } else if (
        ev.inputType === 'deleteContentBackward' ||
        ev.inputType === 'deleteContentForward'
      ) {
        push(Math.floor(centsRef.current / 10))
      }
    },
  }

  return { inputProps }
}

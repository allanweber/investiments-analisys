import { useState } from 'react'

type Props = {
  logoUrl: string | null | undefined
  label: string | null | undefined
  className?: string
}

/** Ticker/investment logo with an initials fallback — always occupies space, even when the logo 404s. */
export function AssetAvatar({ logoUrl, label, className }: Props) {
  const [failed, setFailed] = useState(false)
  const initials = (label ?? '?').replace(/\s/g, '').slice(0, 2).toUpperCase()
  const sizeClass = className ?? 'h-5 w-5 text-[9px]'

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full border border-outline-variant/20 bg-surface object-contain`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low font-bold leading-none text-on-surface-variant`}
      aria-hidden
    >
      {initials}
    </span>
  )
}

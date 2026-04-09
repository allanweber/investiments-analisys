import type { ReactNode } from 'react'

import { cn } from '#/lib/utils'

type FaDetailsCardProps = {
  summary: ReactNode
  children: ReactNode
  className?: string
}

/** Native &lt;details&gt; card for mobile stacks (no horizontal table scroll). */
export function FaDetailsCard({ summary, children, className }: FaDetailsCardProps) {
  return (
    <details
      className={cn(
        'group rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm',
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 marker:hidden [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      <div className="border-t border-outline-variant/15 px-4 py-3">{children}</div>
    </details>
  )
}

type FaMobilePanelProps = {
  children: ReactNode
  className?: string
}

/** Same chrome as FaDetailsCard body, for always-open rows (e.g. edit mode). */
export function FaMobilePanel({ children, className }: FaMobilePanelProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-4 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

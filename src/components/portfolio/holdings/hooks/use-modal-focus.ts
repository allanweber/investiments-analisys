import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useModalFocus(onClose: () => void, isOpen: boolean) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!isOpen) return
    const panel = panelRef.current
    if (!panel) return

    const prevFocused = document.activeElement as HTMLElement | null
    const getFocusable = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
    getFocusable()[0]?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const all = getFocusable()
      if (!all.length) return
      const first = all[0]
      const last = all[all.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      prevFocused?.focus()
    }
  }, [isOpen])

  return panelRef
}

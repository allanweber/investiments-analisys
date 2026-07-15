import { useSyncExternalStore } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { messages as m } from '@/messages'

type ConfirmOptions = {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
}

type ConfirmState = {
  message: string
  options: ConfirmOptions
  resolve: (ok: boolean) => void
} | null

let state: ConfirmState = null
const listeners = new Set<() => void>()

function setState(next: ConfirmState) {
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

/** Imperative replacement for `window.confirm()` — renders via `<ConfirmDialogHost/>` in AppShell. */
export function confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    setState({ message, options, resolve })
  })
}

/** Mounted once (in AppShell) — renders the pending `confirm()` call, if any, as a dialog. */
export function ConfirmDialogHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => null)

  const settle = (ok: boolean) => {
    current?.resolve(ok)
    setState(null)
  }

  return (
    <AlertDialog
      open={current != null}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={current?.options.title ? undefined : 'sr-only'}>
            {current?.options.title ?? m.common.confirm}
          </AlertDialogTitle>
          <AlertDialogDescription>{current?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {current?.options.cancelLabel ?? m.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => settle(true)}>
            {current?.options.confirmLabel ?? m.common.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

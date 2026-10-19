/**
 * Bestätigungsdialog als Promise:
 *   if (await confirmDialog({ title: 'Löschen?', confirm: 'Löschen', danger: true })) …
 * Angezeigt wird er von <ConfirmHost/> (components/ConfirmHost.tsx).
 */
import { useSyncExternalStore } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirm: string
  cancel?: string
  danger?: boolean
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

let pending: Pending | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false)
  return new Promise((resolve) => {
    pending = { ...opts, resolve }
    emit()
  })
}

export function answerConfirm(ok: boolean) {
  pending?.resolve(ok)
  pending = null
  emit()
}

export function usePendingConfirm(): Pending | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => pending,
  )
}

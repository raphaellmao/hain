/**
 * Kurze Hinweise unten über der Navigation („Dein Baum ist jetzt …“).
 * Ein winziger globaler Speicher, aus jeder Datei per showToast() nutzbar.
 */
import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  text: string
  icon?: string
}

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function showToast(text: string, icon?: string, ms = 2800) {
  const toast = { id: nextId++, text, icon }
  toasts = [...toasts.slice(-2), toast]
  emit()
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id)
    emit()
  }, ms)
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => toasts,
  )
}

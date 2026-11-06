/**
 * Blätter zum Weitergeben: die App selbst (QR-Code und Link) oder der Garten als
 * Bild. Angezeigt von ShareHost.
 */
import { useSyncExternalStore } from 'react'

export type ShareKind = 'app' | 'garten'

let pending: ShareKind | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function openShareSheet(kind: ShareKind) {
  pending = kind
  emit()
}

export function closeShareSheet() {
  pending = null
  emit()
}

export function useShareSheet(): ShareKind | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => pending,
  )
}

/**
 * Adresse der App, wie andere sie öffnen (auf GitHub Pages mit /hain/). Aus der
 * geöffneten Seite abgeleitet statt aus der Build-Einstellung – so stimmt sie auf
 * jedem Hosting; Hash und Parameter fallen weg.
 */
export const appUrl = () => new URL('.', location.href).href

/** Ohne https:// und Schrägstrich am Ende, zum Lesen */
export const appUrlShort = () => appUrl().replace(/^https?:\/\//, '').replace(/\/$/, '')

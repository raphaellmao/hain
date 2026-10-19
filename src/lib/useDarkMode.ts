import { useSyncExternalStore } from 'react'

/** Folgt der Systemeinstellung Hell/Dunkel – auch wenn sie sich zur Laufzeit ändert. */
const query = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function subscribe(cb: () => void) {
  query?.addEventListener('change', cb)
  return () => query?.removeEventListener('change', cb)
}

export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, () => query?.matches ?? false, () => false)
}

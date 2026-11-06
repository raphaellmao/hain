/**
 * Minimaler Router über den Hash-Teil der URL (#/garten, #/habit/123 …).
 *
 * Warum kein React Router? Für sechs Ansichten reichen diese 60 Zeilen, und
 * Hash-URLs funktionieren auf jedem statischen Hosting (auch GitHub Pages)
 * ohne Server-Konfiguration. Die Zurück-Taste/-Geste von Android
 * funktioniert, weil jeder Wechsel ein echter Browser-Verlaufseintrag ist.
 */
import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'today' }
  | { name: 'todos' }
  | { name: 'garden' }
  | { name: 'settings' }
  | { name: 'erfolge' }
  | { name: 'review'; week?: string }
  | { name: 'habits' }
  | { name: 'habit'; id: string }
  | { name: 'new'; template?: string }
  | { name: 'edit'; id: string }

export const paths = {
  today: '/',
  todos: '/todos',
  garden: '/garten',
  settings: '/einstellungen',
  erfolge: '/erfolge',
  review: (week?: string) => (week ? `/rueckblick/${week}` : '/rueckblick'),
  habits: '/gewohnheiten',
  habit: (id: string) => `/habit/${id}`,
  new: '/neu',
  /** Neue Gewohnheit, vorausgefüllt aus einer Vorlage (domain/templates.ts) */
  newFrom: (template: string) => `/neu/${template}`,
  edit: (id: string) => `/habit/${id}/bearbeiten`,
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'todos') return { name: 'todos' }
  if (parts[0] === 'garten') return { name: 'garden' }
  if (parts[0] === 'einstellungen') return { name: 'settings' }
  if (parts[0] === 'erfolge') return { name: 'erfolge' }
  if (parts[0] === 'rueckblick') return { name: 'review', week: parts[1] }
  if (parts[0] === 'gewohnheiten') return { name: 'habits' }
  if (parts[0] === 'neu') return { name: 'new', template: parts[1] }
  if (parts[0] === 'habit' && parts[1]) {
    return parts[2] === 'bearbeiten' ? { name: 'edit', id: parts[1] } : { name: 'habit', id: parts[1] }
  }
  return { name: 'today' }
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('popstate', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('popstate', cb)
  }
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseHash(hash)
}

/** Zu einer Ansicht wechseln. `replace`: ohne neuen Verlaufseintrag. */
export function navigate(path: string, { replace = false } = {}) {
  const depth = (history.state?.depth ?? 0) + (replace ? 0 : 1)
  const url = `#${path}`
  if (replace) history.replaceState({ depth }, '', url)
  else history.pushState({ depth }, '', url)
  window.scrollTo(0, 0)
  notify()
}

/**
 * Zurück – innerhalb der App per Verlauf (wie die Zurück-Taste), sonst
 * (App frisch auf einer Unterseite geöffnet) zur Ausweich-Ansicht.
 */
export function goBack(fallback: string = paths.today) {
  if ((history.state?.depth ?? 0) > 0) history.back()
  else navigate(fallback, { replace: true })
}

/**
 * Was die App ohne Server zum Erinnern tun kann.
 *
 * Geplante Benachrichtigungen gibt es im Web nicht: Eine Benachrichtigung kann
 * nur auslösen, wer gerade läuft – bei geschlossener App also niemand (dafür
 * bräuchte es Web Push mit Server). Hain meldet sich deshalb, solange es offen
 * ist oder im Hintergrund noch läuft, holt Verpasstes beim nächsten Öffnen nach
 * und bietet für alles andere den Kalender des Handys an (siehe calendar.ts).
 */
import type { Todo } from '../domain/types'

export type NotifyState = 'unsupported' | NotificationPermission

export const notificationState = (): NotifyState => ('Notification' in window ? Notification.permission : 'unsupported')

/** Nach der Erlaubnis fragen – nur aus einem Tippen heraus aufrufen, sonst lehnt das iPhone ab. */
export async function requestNotifications(): Promise<NotifyState> {
  if (notificationState() !== 'default') return notificationState()
  try {
    return await Notification.requestPermission()
  } catch {
    return notificationState()
  }
}

export async function notifyTodo(todo: Pick<Todo, 'id' | 'title'>): Promise<void> {
  if (notificationState() !== 'granted') return
  const options: NotificationOptions = {
    body: todo.title,
    tag: todo.id,
    icon: `${import.meta.env.BASE_URL}pwa-192x192.png`,
  }
  try {
    // Auf Android geht es nur über den Service Worker, ohne ihn (Entwicklung) direkt
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) await registration.showNotification('Hain · Erinnerung', options)
    else new Notification('Hain · Erinnerung', options)
  } catch {
    /* dann bleibt es beim Hinweis in der App */
  }
}

/** Zahl am App-Symbol – nur installiert und nicht auf jedem Gerät, deshalb ohne Fehlermeldung. */
export function setAppBadge(count: number): void {
  if (!('setAppBadge' in navigator)) return
  navigator.setAppBadge(count).catch(() => {})
}

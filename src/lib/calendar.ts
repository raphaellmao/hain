/**
 * Erinnerungen an den Kalender des Handys übergeben: Der erinnert auch, wenn
 * Hain geschlossen ist. Auf dem Handy über das Teilen-Menü, sonst als Download.
 */
import { buildIcs, type CalendarItem } from '../domain/ics'
import { showToast } from './toast'

/** Muss direkt aus einem Tippen heraus aufgerufen werden (Vorgabe von navigator.share). */
export async function addToCalendar(items: CalendarItem[]): Promise<void> {
  if (items.length === 0) return
  const name = items.length === 1 ? 'hain-erinnerung.ics' : 'hain-erinnerungen.ics'
  const file = new File([buildIcs(items)], name, { type: 'text/calendar' })

  const touch = window.matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Hain-Erinnerung' })
      return
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
      // Teilen klappt nicht: dann als Datei speichern
    }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  showToast('Kalenderdatei gespeichert – öffnen, um sie einzutragen', '📅', 4500)
}

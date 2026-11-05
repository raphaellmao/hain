/**
 * Erinnerungen an den Kalender des Handys übergeben: Der erinnert auch, wenn
 * Hain geschlossen ist.
 *
 * iPhone: Im Teilen-Menü fehlt der Kalender, und eine in „Dateien“ gespeicherte
 * Datei trägt iOS nicht von selbst ein. Den Kalender-Dialog öffnet das iPhone
 * aber, wenn die Seite im selben Fenster eine Adresse aufruft, die als
 * text/calendar antwortet. Einen Server gibt es hier nicht, deshalb antwortet
 * der Service Worker (public/sw-extra.js) mit der Datei aus einem kleinen Cache.
 *
 * Alle anderen: Teilen-Menü, sonst Download.
 */
import { buildIcs, type CalendarItem } from '../domain/ics'
import { isIos } from './install'
import { sheetHistorySettled } from './sheetEffects'
import { showToast } from './toast'

const CALENDAR_CACHE = 'hain-kalender'

/** false = ging nicht, dann bleibt der Weg über die Datei */
async function openOnIphone(file: File, saved: Promise<unknown>): Promise<boolean> {
  if (!isIos() || !('caches' in window)) return false
  try {
    const url = `${import.meta.env.BASE_URL}kalender/${file.name}`
    const cache = await caches.open(CALENDAR_CACHE)
    await cache.put(
      url,
      new Response(file, {
        headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="${file.name}"` },
      }),
    )
    // Antwortet wirklich der Service Worker? Sonst landete die installierte App auf einer Fehlerseite ohne Zurück-Knopf
    const probe = await fetch(url, { cache: 'no-store' })
    if (!probe.headers.get('Content-Type')?.startsWith('text/calendar')) return false
    await saved // Die Seite wird gleich verlassen: Das To-do muss vorher sicher gespeichert sein
    await sheetHistorySettled() // Sonst bricht das Zurückblättern des Blatts diesen Aufruf ab
    showToast('Kalender wird geöffnet …', '📅')
    Object.assign(document.createElement('a'), { href: url, target: '_self' }).click()
    return true
  } catch {
    return false
  }
}

/**
 * Muss direkt aus einem Tippen heraus aufgerufen werden (Vorgabe von navigator.share).
 * `saved`: läuft gerade noch ein Speichervorgang, auf den gewartet werden muss?
 */
export async function addToCalendar(items: CalendarItem[], saved: Promise<unknown> = Promise.resolve()): Promise<void> {
  if (items.length === 0) return
  const name = items.length === 1 ? 'hain-erinnerung.ics' : 'hain-erinnerungen.ics'
  const file = new File([buildIcs(items)], name, { type: 'text/calendar' })

  if (await openOnIphone(file, saved)) return

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

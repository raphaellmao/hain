/**
 * Kalenderdatei (iCalendar, RFC 5545) für Erinnerungen. Ohne Server kann die
 * App bei geschlossenem Zustand nichts auslösen – der Kalender des Handys schon.
 */
import { toRemindAt } from './todos'
import type { Todo } from './types'

/** Ein Kalendertermin. Ein To-do mit drei Erinnerungen ergibt drei Termine. */
export interface CalendarItem {
  id: string
  title: string
  at: string
}

/** Alles, was noch kommt: künftige Erinnerungen offener To-dos */
export function calendarItems(todos: Pick<Todo, 'id' | 'title' | 'done' | 'reminders'>[], now: Date): CalendarItem[] {
  const limit = toRemindAt(now)
  return todos.flatMap((t) => (t.done ? [] : t.reminders.filter((r) => r > limit).map((at) => ({ id: t.id, title: t.title, at }))))
}

const EVENT_MINUTES = 15

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Zeilen nach spätestens 75 Bytes umbrechen, ohne ein Zeichen zu zerteilen. */
function fold(line: string): string {
  const size = (s: string) => new TextEncoder().encode(s).length
  const parts: string[] = []
  let current = ''
  for (const ch of line) {
    // Folgezeilen beginnen mit einem Leerzeichen, das mitzählt
    const limit = parts.length === 0 ? 75 : 74
    if (size(current + ch) > limit) {
      parts.push(current)
      current = ch
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** Ortszeit ohne Zeitzone: Der Termin bleibt um 18:00 Uhr, wo immer das Handy gerade ist. */
const floating = (at: string) => `${at.replace(/-|:/g, '')}00`

function plusMinutes(at: string, minutes: number): string {
  // nur Wanduhr-Rechnung, deshalb UTC: keine Sommerzeit-Sprünge
  const end = new Date(`${at}:00Z`).getTime() + minutes * 60_000
  return new Date(end).toISOString().slice(0, 16)
}

export function buildIcs(items: CalendarItem[], now: Date = new Date()): string {
  const stamp = `${now.toISOString().slice(0, 19).replace(/-|:/g, '')}Z`
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hain//To-dos//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const item of items) {
    const title = escapeText(item.title)
    lines.push(
      'BEGIN:VEVENT',
      // Die Uhrzeit gehört zur Kennung, sonst überschreiben sich die Termine eines To-dos
      `UID:${item.id}-${floating(item.at)}@hain`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${floating(item.at)}`,
      `DTEND:${floating(plusMinutes(item.at, EVENT_MINUTES))}`,
      `SUMMARY:${title}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${title}`,
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}

/**
 * To-dos für einen Tag oder eine Woche.
 *
 * Wie bei den Habits wird nur gespeichert, was feststeht (Titel, Termin,
 * erledigt). Was überfällig ist, in welchem Abschnitt ein To-do steht und ob
 * eine Erinnerung gerade klingelt, wird immer neu berechnet.
 */
import { addDays, diffDays, formatDayMonth, formatWeekdayShort, startOfWeek, toDateStr, weekdayMon0, type DateStr } from './dates'
import type { Todo } from './types'

const REMIND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
export const isRemindAt = (v: unknown): v is string => typeof v === 'string' && REMIND.test(v)

/** Date → 'JJJJ-MM-TTTHH:MM' in Ortszeit. Solche Texte lassen sich direkt vergleichen. */
export function toRemindAt(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${toDateStr(d)}T${hh}:${mm}`
}

/**
 * Erinnerung für einen logischen Tag. Mit Tageswechsel um 3 Uhr gehört 01:30 Uhr
 * noch zum Vortag – „Dienstag 01:30“ liegt also im Kalender am Mittwoch.
 */
export function remindAtFor(date: DateStr, time: string, dayStartHour = 0): string {
  const day = Number(time.slice(0, 2)) < dayStartHour ? addDays(date, 1) : date
  return `${day}T${time}`
}

export const remindTimeOf = (remindAt: string) => remindAt.slice(11, 16)

/** Noch nicht erledigt und der Zeitraum ist vorbei? */
export function isOverdue(t: Todo, today: DateStr): boolean {
  if (t.done) return false
  return t.scope === 'tag' ? t.date < today : t.date < startOfWeek(today)
}

/** Erinnerung fällig und noch nicht weggeklickt? */
export function isRinging(t: Todo, now: Date): boolean {
  return !t.done && !!t.remindAt && !t.remindedAt && t.remindAt <= toRemindAt(now)
}

/**
 * Darf heute nicht vergessen werden: überfällig, heute fällig oder eine
 * Wochenaufgabe am letzten Tag der Woche.
 */
export function isUrgent(t: Todo, today: DateStr): boolean {
  if (t.done) return false
  if (isOverdue(t, today)) return true
  if (t.scope === 'tag') return t.date === today
  return t.date === startOfWeek(today) && weekdayMon0(today) === 6
}

/** Nach Tag, dann nach Uhrzeit (ohne Uhrzeit zuletzt), dann in der Reihenfolge des Anlegens. */
function bySchedule(a: Todo, b: Todo): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.remindAt !== b.remindAt) {
    if (!a.remindAt) return 1
    if (!b.remindAt) return -1
    return a.remindAt < b.remindAt ? -1 : 1
  }
  return a.createdAt - b.createdAt
}

export const urgentTodos = (todos: Todo[], today: DateStr) => todos.filter((t) => isUrgent(t, today)).sort(bySchedule)

export interface TodoGroups {
  overdue: Todo[]
  today: Todo[]
  /** Wochenaufgaben dieser Woche, dazu die restlichen Tage der Woche */
  week: Todo[]
  later: Todo[]
  /** in den letzten 7 Tagen erledigt, das Neueste zuerst */
  done: Todo[]
}

const DONE_VISIBLE_MS = 7 * 86_400_000

export function groupTodos(todos: Todo[], today: DateStr, now: number = Date.now()): TodoGroups {
  const g: TodoGroups = { overdue: [], today: [], week: [], later: [], done: [] }
  const monday = startOfWeek(today)
  const sunday = addDays(monday, 6)
  for (const t of todos) {
    if (t.done) {
      if (now - (t.doneAt ?? t.updatedAt) <= DONE_VISIBLE_MS) g.done.push(t)
    } else if (isOverdue(t, today)) g.overdue.push(t)
    else if (t.scope === 'tag' && t.date === today) g.today.push(t)
    else if (t.scope === 'woche' ? t.date === monday : t.date <= sunday) g.week.push(t)
    else g.later.push(t)
  }
  g.overdue.sort(bySchedule)
  g.today.sort(bySchedule)
  g.later.sort(bySchedule)
  // Wochenaufgaben zuerst (ihr Datum ist der Montag), danach die einzelnen Tage
  g.week.sort(bySchedule)
  g.done.sort((a, b) => (b.doneAt ?? b.updatedAt) - (a.doneAt ?? a.updatedAt))
  return g
}

/** Verbleibende Tage der Woche, heute mitgezählt (So = 1) */
export const daysLeftInWeek = (today: DateStr) => 7 - weekdayMon0(today)

/** „Heute“, „Morgen“, „Do, 5. Nov.“ bzw. „Diese Woche“, „Letzte Woche“ */
export function whenLabel(t: Pick<Todo, 'scope' | 'date'>, today: DateStr): string {
  if (t.scope === 'woche') {
    const weeks = diffDays(startOfWeek(today), t.date) / 7
    if (weeks === 0) return 'Diese Woche'
    if (weeks === 1) return 'Nächste Woche'
    if (weeks === -1) return 'Letzte Woche'
    return `Woche ab ${formatDayMonth(t.date)}`
  }
  const days = diffDays(today, t.date)
  if (days === 0) return 'Heute'
  if (days === 1) return 'Morgen'
  if (days === -1) return 'Gestern'
  return `${formatWeekdayShort(t.date)}, ${formatDayMonth(t.date)}`
}

/** „18:00“ (heute), „Morgen 18:00“, „Do 18:00“ oder „5. Nov. 18:00“ */
export function remindLabel(remindAt: string, today: DateStr): string {
  const date = remindAt.slice(0, 10)
  const time = remindTimeOf(remindAt)
  const days = diffDays(today, date)
  if (days === 0) return time
  if (days === 1) return `Morgen ${time}`
  if (days > 1 && days < 7) return `${formatWeekdayShort(date)} ${time}`
  return `${formatDayMonth(date)} ${time}`
}

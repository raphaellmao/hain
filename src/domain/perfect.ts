/**
 * Perfekte Tage: an einem Tag war alles Fällige erledigt. Ausgesetzte Tage zählen
 * weder dafür noch dagegen, Tage ohne Fälliges unterbrechen keine Serie.
 */
import { addDays, type DateStr } from './dates'
import { isDue } from './schedule'
import type { DoneSet, Habit } from './types'

export interface DayItem {
  habit: Habit
  done: DoneSet
  excused: DoneSet
}

export interface DayStatus {
  due: number
  done: number
  complete: boolean
}

export function dayStatus(items: DayItem[], date: DateStr): DayStatus {
  let due = 0
  let done = 0
  for (const i of items) {
    if (date < i.habit.startDate || !isDue(i.habit, date)) continue
    const isDone = i.done.has(date)
    if (i.excused.has(date) && !isDone) continue
    due++
    if (isDone) done++
  }
  return { due, done, complete: due > 0 && done === due }
}

export interface PerfectStats {
  /** Heute schon alles erledigt? */
  today: boolean
  /** perfekte Tage in Folge bis heute (heute zählt mit, sobald alles erledigt ist) */
  streak: number
  /** perfekte Tage insgesamt */
  total: number
}

const MAX_DAYS = 3 * 366

export function perfectStats(items: DayItem[], today: DateStr): PerfectStats {
  if (items.length === 0) return { today: false, streak: 0, total: 0 }
  const first = items.reduce((m, i) => (i.habit.startDate < m ? i.habit.startDate : m), today)
  const todayStatus = dayStatus(items, today)
  let streak = 0
  let total = 0
  let counting = true
  // Ein noch nicht fertiger heutiger Tag unterbricht nichts – der Tag läuft ja noch
  for (let d = todayStatus.complete ? today : addDays(today, -1), n = 0; d >= first && n < MAX_DAYS; n++, d = addDays(d, -1)) {
    const s = d === today ? todayStatus : dayStatus(items, d)
    if (s.complete) total++
    if (!counting || s.due === 0) continue
    if (s.complete) streak++
    else counting = false
  }
  return { today: todayStatus.complete, streak, total }
}

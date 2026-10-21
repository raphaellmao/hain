import { type DateStr, addDays, eachDay, maxDate } from './dates'
import { isDue } from './schedule'
import { type DoneSet, type Habit, NO_DAYS } from './types'

/** Zustand eines einzelnen Tages – für Heatmap und Kalender. */
export type DayState =
  | 'done' //        erledigt
  | 'missed' //      fällig, nicht erledigt, vorbei
  | 'open' //        heute fällig, noch offen
  | 'rest' //        nicht fällig
  | 'excused' //     ausgesetzt („heute nicht möglich“)
  | 'before' //      vor dem Startdatum
  | 'future' //      liegt in der Zukunft

export function dayState(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  done: DoneSet,
  date: DateStr,
  today: DateStr,
  excused: DoneSet = NO_DAYS,
): DayState {
  if (date > today) return 'future'
  if (date < habit.startDate) return 'before'
  if (done.has(date)) return 'done'
  if (excused.has(date)) return 'excused'
  if (!isDue(habit, date)) return 'rest'
  return date === today ? 'open' : 'missed'
}

/**
 * Erfolgsquote der letzten `days` Tage (inkl. heute):
 * erledigte fällige Tage / fällige Tage. Heute zählt nur mit, wenn schon
 * erledigt – sonst würde die Quote morgens immer schlechter aussehen.
 * Gibt null zurück, wenn es im Zeitraum keinen fälligen Tag gab.
 */
export function successRate(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  done: DoneSet,
  today: DateStr,
  days = 30,
  excused: DoneSet = NO_DAYS,
): { rate: number; done: number; due: number } | null {
  const from = maxDate(addDays(today, -(days - 1)), habit.startDate)
  if (from > today) return null
  let due = 0
  let hit = 0
  for (const d of eachDay(from, today)) {
    if (!isDue(habit, d)) continue
    if (excused.has(d) && !done.has(d)) continue
    if (d === today && !done.has(d)) continue
    due++
    if (done.has(d)) hit++
  }
  return due === 0 ? null : { rate: hit / due, done: hit, due }
}

/** Alle erledigten Tage ab Startdatum (inkl. Bonustage). */
export function totalDone(habit: Pick<Habit, 'startDate'>, done: DoneSet, today: DateStr): number {
  let n = 0
  for (const d of done) if (d >= habit.startDate && d <= today) n++
  return n
}

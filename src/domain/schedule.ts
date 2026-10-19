import { type DateStr, weekday, WEEKDAYS_MON0 } from './dates'
import type { Habit, ScheduleVersion } from './types'

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/** Welche Wochentage gelten am Tag `date`? (letzte Version mit from ≤ date) */
export function daysAt(schedule: ScheduleVersion[], date: DateStr): number[] {
  let days = schedule[0]?.days ?? ALL_DAYS
  for (const v of schedule) {
    if (v.from <= date) days = v.days
    else break
  }
  return days
}

/** Ist das Habit an diesem Tag fällig? Vor dem Startdatum nie. */
export function isDue(habit: Pick<Habit, 'schedule' | 'startDate'>, date: DateStr): boolean {
  if (date < habit.startDate) return false
  return daysAt(habit.schedule, date).includes(weekday(date))
}

/**
 * Neue Wochentage ab `today` setzen. Gibt es für heute schon eine Version
 * (mehrfach am selben Tag geändert), wird sie ersetzt statt angehängt.
 */
export function withNewDays(schedule: ScheduleVersion[], days: number[], today: DateStr): ScheduleVersion[] {
  const sorted = [...days].sort((a, b) => a - b)
  const current = daysAt(schedule, today)
  if (sameDays(current, sorted)) return schedule
  const kept = schedule.filter((v) => v.from < today)
  return [...kept, { from: today, days: sorted }]
}

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort().every((d, i) => d === [...b].sort()[i])
}

/** „Täglich“, „Mo–Fr“, „Wochenende“, „Mo, Mi, Fr“ */
export function describeDays(days: number[]): string {
  const set = new Set(days)
  if (set.size === 7) return 'Täglich'
  if (set.size === 0) return 'Nie'
  const mon0 = [...set].map((d) => (d + 6) % 7).sort((a, b) => a - b)
  if (mon0.join() === '0,1,2,3,4') return 'Mo–Fr'
  if (mon0.join() === '5,6') return 'Wochenende'
  return mon0.map((i) => WEEKDAYS_MON0[i]).join(', ')
}

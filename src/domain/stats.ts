import { type DateStr, addDays, eachDay, maxDate, minDate, shiftMonth } from './dates'
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
 * Erledigte und fällige Tage eines Zeitraums. Ausgesetzte Tage zählen nicht, heute
 * nur, wenn schon erledigt – sonst würde die Quote morgens immer schlechter aussehen.
 */
export function tallyDays(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  done: DoneSet,
  from: DateStr,
  to: DateStr,
  today: DateStr,
  excused: DoneSet = NO_DAYS,
): { hit: number; due: number } {
  const first = maxDate(from, habit.startDate)
  const last = minDate(to, today)
  let due = 0
  let hit = 0
  if (first <= last) {
    for (const d of eachDay(first, last)) {
      if (!isDue(habit, d)) continue
      if (excused.has(d) && !done.has(d)) continue
      if (d === today && !done.has(d)) continue
      due++
      if (done.has(d)) hit++
    }
  }
  return { hit, due }
}

/**
 * Erfolgsquote der letzten `days` Tage (inkl. heute): erledigte fällige Tage /
 * fällige Tage. Gibt null zurück, wenn es im Zeitraum keinen fälligen Tag gab.
 */
export function successRate(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  done: DoneSet,
  today: DateStr,
  days = 30,
  excused: DoneSet = NO_DAYS,
): { rate: number; done: number; due: number } | null {
  const { hit, due } = tallyDays(habit, done, addDays(today, -(days - 1)), today, today, excused)
  return due === 0 ? null : { rate: hit / due, done: hit, due }
}

/** Alle erledigten Tage ab Startdatum (inkl. Bonustage). */
export function totalDone(habit: Pick<Habit, 'startDate'>, done: DoneSet, today: DateStr): number {
  let n = 0
  for (const d of done) if (d >= habit.startDate && d <= today) n++
  return n
}

export interface MonthRate {
  /** 'JJJJ-MM' */
  month: string
  /** erledigte / fällige Tage, null = im Monat nichts fällig */
  rate: number | null
  done: number
  due: number
  /** laufender Monat (noch nicht vorbei) */
  partial: boolean
}

/**
 * Erfolgsquote je Kalendermonat für die letzten `months` Monate (inkl. dem
 * laufenden). Gleiche Regeln wie successRate: ausgesetzte Tage zählen nicht,
 * heute nur, wenn schon erledigt.
 */
export function monthlyRates(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  done: DoneSet,
  today: DateStr,
  excused: DoneSet = NO_DAYS,
  months = 6,
): MonthRate[] {
  const current = today.slice(0, 7)
  return Array.from({ length: months }, (_, i) => shiftMonth(current, i - (months - 1))).map((month) => {
    const { hit, due } = tallyDays(habit, done, `${month}-01`, addDays(`${shiftMonth(month, 1)}-01`, -1), today, excused)
    return { month, rate: due ? hit / due : null, done: hit, due, partial: month === current }
  })
}

/** Monatsquoten mehrerer Habits zusammengefasst (Summe erledigt / Summe fällig). */
export function combineMonthly(perHabit: MonthRate[][]): MonthRate[] {
  if (perHabit.length === 0) return []
  return perHabit[0].map((m, i) => {
    let done = 0
    let due = 0
    for (const list of perHabit) {
      done += list[i].done
      due += list[i].due
    }
    return { month: m.month, rate: due ? done / due : null, done, due, partial: m.partial }
  })
}

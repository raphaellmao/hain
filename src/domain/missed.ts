/**
 * „Nie zweimal aussetzen“ (Die 1%-Methode): Wurde die Gewohnheit am letzten
 * fälligen Tag verpasst, steht das heute in ihrer Zeile – damit aus einem
 * Ausrutscher keine Lücke wird. Passt zu H: ab dem zweiten Fehltag in Folge
 * halbiert sich der Baum.
 */
import { addDays, formatLong, type DateStr } from './dates'
import { isDue } from './schedule'
import type { DoneSet, Habit } from './types'

export interface MissedRun {
  /** verpasste fällige Tage direkt vor `date`, ohne Unterbrechung */
  count: number
  /** der jüngste davon */
  last: DateStr
}

/** Weiter zurück schaut niemand mehr auf „Gestern verpasst“ */
const LOOK_BACK = 60

/**
 * Verpasste fällige Tage unmittelbar vor `date`. Nicht fällige und ausgesetzte Tage
 * werden übersprungen, ein erledigter Tag oder der Start beendet die Zählung.
 */
export function missedBefore(habit: Pick<Habit, 'schedule' | 'startDate'>, done: DoneSet, excused: DoneSet, date: DateStr): MissedRun | null {
  let count = 0
  let last: DateStr | null = null
  for (let d = addDays(date, -1), n = 0; d >= habit.startDate && n < LOOK_BACK; d = addDays(d, -1), n++) {
    if (!isDue(habit, d)) continue
    if (done.has(d)) break
    if (excused.has(d)) continue
    count++
    last ??= d
  }
  return last ? { count, last } : null
}

/** „Gestern hast du’s schon verpasst“, „Am Montag …“ oder „Schon 3× in Folge verpasst“ */
export function missedText(run: MissedRun, today: DateStr): string {
  if (run.count >= 2) return `Schon ${run.count}× in Folge verpasst`
  if (run.last === addDays(today, -1)) return 'Gestern hast du’s schon verpasst'
  return `Am ${formatLong(run.last).split(',')[0]} hast du’s schon verpasst`
}

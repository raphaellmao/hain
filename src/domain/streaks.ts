import { type DateStr, eachDay } from './dates'
import { isDue } from './schedule'
import { type DoneSet, type Habit, NO_DAYS } from './types'

/**
 * Regeln für Serien (Streaks):
 *  - Ein erledigter Tag zählt +1 – auch an nicht fälligen Tagen (Bonus).
 *  - Ein fälliger, nicht erledigter Tag *vor heute* bricht die Serie.
 *  - Nicht fällige, nicht erledigte Tage sind neutral.
 *  - Heute noch nicht erledigt bricht nichts – der Tag läuft ja noch.
 *  - Ausgesetzte Tage („heute nicht möglich“) sind ebenfalls neutral.
 */
export interface Streaks {
  current: number
  longest: number
}

export function computeStreaks(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  done: DoneSet,
  today: DateStr,
  excused: DoneSet = NO_DAYS,
): Streaks {
  let run = 0
  let longest = 0
  if (habit.startDate > today) return { current: 0, longest: 0 }

  for (const d of eachDay(habit.startDate, today)) {
    if (done.has(d)) {
      run++
      if (run > longest) longest = run
    } else if (d < today && isDue(habit, d) && !excused.has(d)) {
      run = 0
    }
  }
  // Nach dem Durchlauf bis heute ist `run` genau die aktuelle Serie.
  return { current: run, longest }
}

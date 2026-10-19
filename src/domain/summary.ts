import type { DateStr } from './dates'
import { computeHealth, growthOf, stageOf, STAGE_NAMES, type Health } from './health'
import { computeStreaks, type Streaks } from './streaks'
import type { DoneSet, Habit } from './types'

/** Alles, was die Oberfläche über den Zustand eines Habits wissen muss. */
export interface HabitSummary {
  health: Health
  /** Wachstum 0 … 7 für den Baum */
  g: number
  stage: number
  streaks: Streaks
}

export function summarize(habit: Habit, done: DoneSet, today: DateStr): HabitSummary {
  const health = computeHealth(habit, done, today)
  return {
    health,
    g: growthOf(health.h),
    stage: stageOf(health.h),
    streaks: computeStreaks(habit, done, today),
  }
}

/** Name der Stufe – ein eingegangener Baum heißt „Kahl“ statt „Erde“. */
export function stageLabel(s: HabitSummary): string {
  return s.health.dormant && s.stage === 0 ? 'Kahl' : STAGE_NAMES[s.stage]
}

import type { DateStr } from './dates'
import { computeHealth, growthOf, stageOf, type Health } from './health'
import { stageName, type SpeciesKey } from './species'
import { computeShadowPower, shadowState, type Shadow } from './shadow'
import { computeStreaks, type Streaks } from './streaks'
import { type DoneSet, type Habit, NO_DAYS } from './types'

/** Alles, was die Oberfläche über den Zustand eines Habits wissen muss. */
export interface HabitSummary {
  health: Health
  /** Wachstum 0 … 7 für den Baum */
  g: number
  stage: number
  streaks: Streaks
  /** Kampf gegen das Schatten-Ich (wird immer berechnet, angezeigt nur bei metaphor = 'schatten') */
  shadow: Shadow
}

export function summarize(habit: Habit, done: DoneSet, today: DateStr, excused: DoneSet = NO_DAYS): HabitSummary {
  const health = computeHealth(habit, done, today, excused)
  return {
    health,
    g: growthOf(health.h),
    stage: stageOf(health.h),
    streaks: computeStreaks(habit, done, today, excused),
    shadow: shadowState(health.h, computeShadowPower(habit, done, today, excused)),
  }
}

/** Name der Stufe – ein eingegangener Baum heißt „Kahl“ statt „Erde“. */
export function stageLabel(s: HabitSummary, species?: SpeciesKey): string {
  return s.health.dormant && s.stage === 0 ? 'Kahl' : stageName(species, s.stage)
}

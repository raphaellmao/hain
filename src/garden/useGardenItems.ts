import { useMemo } from 'react'
import { doneFor, excusedSet, excusesFor, useDoneMap, useExcuseMap, useHabits, useToday } from '../db/hooks'
import { summarize, type HabitSummary } from '../domain/summary'
import type { DoneSet, Habit } from '../domain/types'

export interface GardenItem {
  habit: Habit
  summary: HabitSummary
  done: DoneSet
  excused: DoneSet
}

/** Alle aktiven Gewohnheiten mit ihrem Stand – für den Garten und das Gartenbild. undefined = lädt noch */
export function useGardenItems(): GardenItem[] | undefined {
  const habits = useHabits()
  const doneMap = useDoneMap()
  const excuseMap = useExcuseMap()
  const today = useToday()

  return useMemo(() => {
    if (!habits || !doneMap) return undefined
    return habits.map((habit) => {
      const done = doneFor(doneMap, habit.id)
      const excused = excusedSet(excusesFor(excuseMap, habit.id))
      return { habit, summary: summarize(habit, done, today, excused), done, excused }
    })
  }, [habits, doneMap, excuseMap, today])
}

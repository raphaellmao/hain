import { useMemo } from 'react'
import { doneFor, excusedSet, excusesFor, useDoneMap, useExcuseMap, useHabits, useToday } from '../db/hooks'
import { summarize, type HabitSummary } from '../domain/summary'
import type { Habit } from '../domain/types'

export interface GardenItem {
  habit: Habit
  summary: HabitSummary
}

/** Alle aktiven Gewohnheiten mit ihrem Stand – für den Garten und das Gartenbild. undefined = lädt noch */
export function useGardenItems(): GardenItem[] | undefined {
  const habits = useHabits()
  const doneMap = useDoneMap()
  const excuseMap = useExcuseMap()
  const today = useToday()

  return useMemo(() => {
    if (!habits || !doneMap) return undefined
    return habits.map((habit) => ({
      habit,
      summary: summarize(habit, doneFor(doneMap, habit.id), today, excusedSet(excusesFor(excuseMap, habit.id))),
    }))
  }, [habits, doneMap, excuseMap, today])
}

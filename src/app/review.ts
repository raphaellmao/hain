/**
 * Wochenrückblick aus den aktuellen Daten berechnen und merken, welcher schon
 * angesehen wurde (nur auf diesem Gerät, wie bei den Erfolgen).
 */
import { useMemo } from 'react'
import { doneFor, excusedSet, excusesFor, useDoneMap, useExcuseMap, useHabits, useSettings, useToday, useTodos } from '../db/hooks'
import type { DateStr } from '../domain/dates'
import { buildWeekReview, type WeekReview } from '../domain/review'

export function useWeekReview(monday: DateStr): WeekReview | undefined {
  const habits = useHabits()
  const doneMap = useDoneMap()
  const excuseMap = useExcuseMap()
  const todos = useTodos()
  const today = useToday()
  const { dayStartHour } = useSettings()

  return useMemo(() => {
    if (!habits || !doneMap || !excuseMap || !todos) return undefined
    const items = habits.map((habit) => ({
      habit,
      done: doneFor(doneMap, habit.id),
      excused: excusedSet(excusesFor(excuseMap, habit.id)),
    }))
    return buildWeekReview(items, todos, monday, today, dayStartHour)
  }, [habits, doneMap, excuseMap, todos, monday, today, dayStartHour])
}

const SEEN_KEY = 'hain.rueckblick.v1'

export function seenReviewWeek(): DateStr | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

export function markReviewSeen(monday: DateStr) {
  try {
    if ((seenReviewWeek() ?? '') < monday) localStorage.setItem(SEEN_KEY, monday)
  } catch {
    /* privater Modus – dann eben ohne Merken */
  }
}

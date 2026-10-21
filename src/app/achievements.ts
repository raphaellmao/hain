/**
 * Erfolge aus den aktuellen Daten berechnen und neu freigeschaltete melden.
 */
import { useEffect, useMemo } from 'react'
import { doneFor, excusedSet, excusesFor, useDoneMap, useExcuseMap, useHabits, useMeta, useNoteCount, useSettings, useTickStats, useToday } from '../db/hooks'
import { TIERS, computeAchievements, type Achievement } from '../domain/achievements'
import { summarize } from '../domain/summary'
import { showToast } from '../lib/toast'

export function useAchievements(): Achievement[] | undefined {
  const habits = useHabits()
  const doneMap = useDoneMap()
  const excuseMap = useExcuseMap()
  const notes = useNoteCount()
  const lastBackupAt = useMeta<number>('lastBackupAt')
  const today = useToday()
  const { dayStartHour } = useSettings()
  const ticks = useTickStats(dayStartHour)

  return useMemo(() => {
    if (!habits || !doneMap || !excuseMap || notes === undefined || lastBackupAt === undefined || !ticks) return undefined
    const items = habits.map((habit) => {
      const done = doneFor(doneMap, habit.id)
      const excused = excusedSet(excusesFor(excuseMap, habit.id))
      return { habit, done, excused, summary: summarize(habit, done, today, excused) }
    })
    return computeAchievements({ items, today, notes, backedUp: !!lastBackupAt, ticks })
  }, [habits, doneMap, excuseMap, notes, lastBackupAt, ticks, today])
}

// v2: mit dem großen Abzeichen-Update neu – sonst kämen alle neuen auf einmal
const SEEN_KEY = 'hain.erfolge.v2'

/**
 * Unsichtbar in App eingebunden: meldet neu freigeschaltete Erfolge als
 * Hinweis. Beim allerersten Mal wird nur still gemerkt, was schon erreicht
 * ist – sonst käme nach einem Update eine Flut von Meldungen.
 */
export function AchievementWatcher() {
  const list = useAchievements()

  useEffect(() => {
    if (!list) return
    const achieved = list.filter((a) => a.achieved)
    let seen: string[] | null = null
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null')
    } catch {
      seen = null
    }
    if (seen) {
      for (const a of achieved) {
        if (!seen.includes(a.id)) showToast(`${TIERS[a.tier].label}-Erfolg: ${a.title}`, a.emoji, 3800)
      }
    }
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(achieved.map((a) => a.id)))
    } catch {
      /* privater Modus – dann eben ohne Merken */
    }
  }, [list])

  return null
}

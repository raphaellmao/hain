/**
 * React-Hooks, die Daten live aus der Datenbank lesen. `useLiveQuery`
 * rendert automatisch neu, sobald sich die Daten ändern – egal wo die
 * Änderung herkommt. Es gibt also keinen separaten State, der mit der
 * Datenbank synchron gehalten werden müsste.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './schema'
import { type DateStr, logicalToday } from '../domain/dates'
import { type Habit, type Settings, DEFAULT_SETTINGS } from '../domain/types'
import type { ExcuseReason } from '../domain/excuse'

/** Alle nicht gelöschten Habits in Listenreihenfolge (undefined = lädt noch). */
export function useHabits(): Habit[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.habits.orderBy('order').toArray()
    return all.filter((h) => !h.deleted)
  })
}

export function useHabit(id: string): Habit | null | undefined {
  return useLiveQuery(async () => {
    const h = await db.habits.get(id)
    return h && !h.deleted ? h : null
  }, [id])
}

/**
 * Erledigte Tage pro Habit: Map<habitId, Set<Datum>>.
 * Lädt alle Einträge auf einmal – auch nach Jahren sind das nur einige
 * tausend kleine Objekte, das geht schneller als viele Einzelabfragen.
 */
export function useDoneMap(): Map<string, Set<DateStr>> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, Set<DateStr>>()
    await db.checkins.each((c) => {
      if (!c.done) return
      let set = map.get(c.habitId)
      if (!set) map.set(c.habitId, (set = new Set()))
      set.add(c.date)
    })
    return map
  })
}

const EMPTY: ReadonlySet<DateStr> = new Set()
export const doneFor = (map: Map<string, Set<DateStr>> | undefined, id: string) => map?.get(id) ?? EMPTY

export interface ExcuseInfo {
  reason?: ExcuseReason
  note?: string
}
export type ExcuseDays = ReadonlyMap<DateStr, ExcuseInfo>

/** Ausgesetzte Tage pro Habit (mit Grund): Map<habitId, Map<Datum, Grund>> */
export function useExcuseMap(): Map<string, Map<DateStr, ExcuseInfo>> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, Map<DateStr, ExcuseInfo>>()
    await db.checkins.each((c) => {
      if (c.done || !c.excused) return
      let m = map.get(c.habitId)
      if (!m) map.set(c.habitId, (m = new Map()))
      m.set(c.date, { reason: c.reason, note: c.reasonNote })
    })
    return map
  })
}

const NO_EXCUSES: ExcuseDays = new Map()
export const excusesFor = (map: Map<string, Map<DateStr, ExcuseInfo>> | undefined, id: string): ExcuseDays =>
  map?.get(id) ?? NO_EXCUSES

// Für die Berechnungen reicht die Menge der Tage – pro Map nur einmal bilden
const setCache = new WeakMap<ExcuseDays, ReadonlySet<DateStr>>()
export function excusedSet(days: ExcuseDays): ReadonlySet<DateStr> {
  let s = setCache.get(days)
  if (!s) setCache.set(days, (s = new Set(days.keys())))
  return s
}

/** Notiz eines Tages: undefined = lädt noch, '' = keine Notiz. */
export function useDayNote(date: DateStr): string | undefined {
  const result = useLiveQuery(async () => ({ date, note: (await db.dayEntries.get(date))?.note ?? '' }), [date])
  // Nach einem Datumswechsel liefert useLiveQuery kurz noch das alte Ergebnis
  return result?.date === date ? result.note : undefined
}

export function useSettings(): Settings {
  const value = useLiveQuery(() => db.meta.get('settings'))
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...((value?.value as Partial<Settings>) ?? {}) }), [value])
}

/** Wert aus der Meta-Ablage: undefined = lädt noch, null = nicht vorhanden. */
export function useMeta<T>(key: string): T | null | undefined {
  return useLiveQuery(async () => ((await db.meta.get(key))?.value as T | undefined) ?? null, [key])
}

/**
 * Das logische „Heute“ (berücksichtigt den Tageswechsel aus den
 * Einstellungen). Aktualisiert sich, wenn die App aus dem Hintergrund
 * zurückkommt, und jede Minute – bleibt die App über Nacht offen,
 * springt sie so von selbst auf den neuen Tag.
 */
export function useToday(): DateStr {
  const { dayStartHour } = useSettings()
  const [today, setToday] = useState(() => logicalToday(new Date(), dayStartHour))

  useEffect(() => {
    const update = () => setToday(logicalToday(new Date(), dayStartHour))
    update()
    const timer = window.setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [dayStartHour])

  return today
}

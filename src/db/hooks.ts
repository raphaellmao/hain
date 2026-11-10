/**
 * React-Hooks, die Daten live aus der Datenbank lesen. `useLiveQuery`
 * rendert automatisch neu, sobald sich die Daten ändern – egal wo die
 * Änderung herkommt. Es gibt also keinen separaten State, der mit der
 * Datenbank synchron gehalten werden müsste.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './schema'
import { type DateStr, eachDay, logicalToday } from '../domain/dates'
import { type Absence, type Habit, type Mood, type Routine, type Settings, type Todo, DEFAULT_SETTINGS } from '../domain/types'
import type { ExcuseReason } from '../domain/excuse'
import type { TickStats } from '../domain/achievements'

/** Aktive Habits in Listenreihenfolge, ohne gelöschte und archivierte (undefined = lädt noch). */
export function useHabits(): Habit[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.habits.orderBy('order').toArray()
    return all.filter((h) => !h.deleted && !h.archived)
  })
}

/** Auch archivierte – für Erfolge, die nicht verschwinden sollen, nur weil etwas pausiert */
export function useAllHabits(): Habit[] | undefined {
  return useLiveQuery(async () => (await db.habits.orderBy('order').toArray()).filter((h) => !h.deleted))
}

export function useArchivedHabits(): Habit[] | undefined {
  return useLiveQuery(async () =>
    (await db.habits.toArray()).filter((h) => !h.deleted && h.archived).sort((a, b) => b.archived!.since.localeCompare(a.archived!.since)),
  )
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
  /** Tag gehört zu dieser Abwesenheit (statt eines einzeln gesetzten Grunds) */
  absenceId?: string
}
export type ExcuseDays = ReadonlyMap<DateStr, ExcuseInfo>

/**
 * Ausgesetzte Tage pro Habit (mit Grund): Map<habitId, Map<Datum, Grund>>.
 * Enthält auch die Tage von Abwesenheiten; ein einzeln gesetzter Grund für
 * denselben Tag hat Vorrang.
 */
export function useExcuseMap(): Map<string, Map<DateStr, ExcuseInfo>> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, Map<DateStr, ExcuseInfo>>()
    const put = (habitId: string, date: DateStr, info: ExcuseInfo) => {
      let m = map.get(habitId)
      if (!m) map.set(habitId, (m = new Map()))
      m.set(date, info)
    }
    const absences = (await db.absences.toArray()).filter((a) => !a.deleted)
    if (absences.length) {
      const all = (await db.habits.toArray()).filter((h) => !h.deleted).map((h) => h.id)
      for (const a of absences) {
        const info: ExcuseInfo = { reason: a.reason, note: a.note, absenceId: a.id }
        for (const date of eachDay(a.from, a.to)) for (const id of a.habitIds ?? all) put(id, date, info)
      }
    }
    await db.checkins.each((c) => {
      if (c.done || !c.excused) return
      put(c.habitId, c.date, { reason: c.reason, note: c.reasonNote })
    })
    return map
  })
}

/** Alle Abwesenheiten (ohne gelöschte), undefined = lädt noch */
/** Routinen in ihrer Reihenfolge */
export function useRoutines(): Routine[] | undefined {
  return useLiveQuery(async () => (await db.routines.orderBy('order').toArray()).filter((r) => !r.deleted))
}

export function useAbsences(): Absence[] | undefined {
  return useLiveQuery(async () => (await db.absences.toArray()).filter((a) => !a.deleted))
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

/** Eingetragene Mengen pro Habit: Map<habitId, Map<Datum, Menge>> */
export function useAmountMap(): Map<string, Map<DateStr, number>> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, Map<DateStr, number>>()
    await db.checkins.each((c) => {
      if (c.amount === undefined) return
      let m = map.get(c.habitId)
      if (!m) map.set(c.habitId, (m = new Map()))
      m.set(c.date, c.amount)
    })
    return map
  })
}

const NO_AMOUNTS: ReadonlyMap<DateStr, number> = new Map()
export const amountsFor = (map: Map<string, Map<DateStr, number>> | undefined, id: string): ReadonlyMap<DateStr, number> =>
  map?.get(id) ?? NO_AMOUNTS

/** Eintrag eines Tages für ein Habit: undefined = lädt noch */
export function useDayCheckin(habitId: string, date: DateStr): { amount?: number; done: boolean } | undefined {
  const result = useLiveQuery(async () => {
    const c = await db.checkins.get(`${habitId}_${date}`)
    return { key: `${habitId}_${date}`, amount: c?.amount, done: !!c?.done }
  }, [habitId, date])
  return result?.key === `${habitId}_${date}` ? result : undefined
}

/** Laufende Timer: Map<habitId, Startzeit> */
export function useTimers(): Map<string, number> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, number>()
    for (const m of await db.meta.where('key').startsWith('timer.').toArray()) {
      if (typeof m.value === 'number') map.set(m.key.slice(6), m.value)
    }
    return map
  })
}

/** Notiz eines Tages: undefined = lädt noch, '' = keine Notiz. */
export function useDayNote(date: DateStr): string | undefined {
  const result = useLiveQuery(async () => ({ date, note: (await db.dayEntries.get(date))?.note ?? '' }), [date])
  // Nach einem Datumswechsel liefert useLiveQuery kurz noch das alte Ergebnis
  return result?.date === date ? result.note : undefined
}

/** Alle nicht gelöschten To-dos (undefined = lädt noch). */
export function useTodos(): Todo[] | undefined {
  return useLiveQuery(async () => (await db.todos.toArray()).filter((t) => !t.deleted))
}

/** Stimmung eines Tages: undefined = lädt noch, null = nicht bewertet */
export function useDayMood(date: DateStr): Mood | null | undefined {
  const result = useLiveQuery(async () => ({ date, mood: (await db.dayEntries.get(date))?.mood ?? null }), [date])
  return result?.date === date ? result.mood : undefined
}

/** Alle bewerteten Tage */
export function useMoodMap(): Map<DateStr, Mood> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<DateStr, Mood>()
    await db.dayEntries.each((e) => {
      if (e.mood) map.set(e.date, e.mood)
    })
    return map
  })
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

/** Anzahl der Tage mit Notiz (für den Erfolg „Tagebuch“) */
export function useNoteCount(): number | undefined {
  return useLiveQuery(() => db.dayEntries.filter((e) => e.note.trim() !== '').count())
}

/**
 * Uhrzeiten der Haken (aus dem Zeitstempel). Gezählt wird nur, wenn der Haken
 * am selben (logischen) Tag gesetzt wurde – Nachträge zählen nicht.
 */
export function useTickStats(dayStartHour: number): TickStats | undefined {
  return useLiveQuery(async () => {
    const stats: TickStats = { early: 0, late: 0, ghost: false }
    await db.checkins.each((c) => {
      if (!c.done) return
      const at = new Date(c.updatedAt)
      if (logicalToday(at, dayStartHour) !== c.date) return
      const h = at.getHours()
      if (h < 7 && h >= dayStartHour) stats.early++
      if (h >= 23 || h < dayStartHour) stats.late++
      if (h === 0) stats.ghost = true
    })
    return stats
  }, [dayStartHour])
}

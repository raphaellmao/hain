import type { DateStr } from './dates'
import type { ColorKey } from './colors'

/**
 * Ab `from` gilt: fällig an den Wochentagen `days` (0 = So … 6 = Sa).
 * Ein Habit hat eine Liste davon – ändert man die Häufigkeit, kommt ein
 * neuer Eintrag ab dem Änderungstag dazu. So bleibt die Vergangenheit
 * (Streaks, Statistik, Baum) korrekt.
 */
export interface ScheduleVersion {
  from: DateStr
  days: number[]
}

export interface Habit {
  /** UUID – sync-tauglich, anders als fortlaufende Nummern */
  id: string
  name: string
  emoji: string
  color: ColorKey
  /** aufsteigend nach `from` sortiert, mindestens ein Eintrag */
  schedule: ScheduleVersion[]
  /** ab diesem Tag zählt das Habit (fällig / verpasst) */
  startDate: DateStr
  /** bestimmt die Form des Baums – gleicher Seed, gleicher Baum */
  seed: number
  /** Sortierung in Listen */
  order: number
  /** Gelöschte Habits bleiben als „Grabstein“ liegen (für späteren Sync) */
  deleted: boolean
  createdAt: number
  updatedAt: number
}

/** Ein Eintrag pro Habit und Tag. Fehlt er, gilt der Tag als nicht erledigt. */
export interface Checkin {
  /** `${habitId}_${date}` – damit gibt es pro Tag höchstens einen Eintrag */
  id: string
  habitId: string
  date: DateStr
  /** Abhaken rückgängig = done: false statt Löschen (für späteren Sync) */
  done: boolean
  updatedAt: number
}

export interface Settings {
  /** Tageswechsel in Stunden nach Mitternacht (0–4) */
  dayStartHour: number
}

export const DEFAULT_SETTINGS: Settings = { dayStartHour: 0 }

/** Für die Berechnungen: an welchen Tagen wurde ein Habit erledigt? */
export type DoneSet = ReadonlySet<DateStr>

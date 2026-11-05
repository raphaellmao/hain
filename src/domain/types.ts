import type { DateStr } from './dates'
import type { ColorKey } from './colors'
import type { SpeciesKey } from './species'
import type { ExcuseReason } from './excuse'

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
  /** Pflanzenart; fehlt bei Habits von vor der Einführung → Laubbaum */
  species?: SpeciesKey
  /** Bild für den Fortschritt: wachsende Pflanze (Standard) oder Schatten-Ich */
  metaphor?: Metaphor
  /** Sortierung in Listen */
  order: number
  /** Gelöschte Habits bleiben als „Grabstein“ liegen (für späteren Sync) */
  deleted: boolean
  createdAt: number
  updatedAt: number
}

export type Metaphor = 'pflanze' | 'schatten'

/** Ein Eintrag pro Habit und Tag. Fehlt er, gilt der Tag als nicht erledigt. */
export interface Checkin {
  /** `${habitId}_${date}` – damit gibt es pro Tag höchstens einen Eintrag */
  id: string
  habitId: string
  date: DateStr
  /** Abhaken rückgängig = done: false statt Löschen (für späteren Sync) */
  done: boolean
  /** „Heute nicht möglich“: zählt weder als erledigt noch als verpasst (siehe excuse.ts) */
  excused?: boolean
  reason?: ExcuseReason
  /** optionale kurze Notiz zur Ausnahme */
  reasonNote?: string
  updatedAt: number
}

/** Notiz zu einem Tag – unabhängig von einzelnen Habits, höchstens eine pro Tag. */
export interface DayEntry {
  /** = `date` – damit gibt es pro Tag höchstens einen Eintrag (auch nach einem Sync) */
  id: DateStr
  date: DateStr
  /** Leeren = note: '' statt Löschen (für späteren Sync) */
  note: string
  updatedAt: number
}

export type TodoScope = 'tag' | 'woche'

export type RepeatRule = 'taeglich' | 'woechentlich' | 'zweiwoechentlich' | 'monatlich' | 'jaehrlich'

/** Erinnerung relativ zum Termin: `days` Tage davor oder danach, um `time` Uhr */
export interface RepeatReminder {
  days: number
  time: string
}

/** Wie ein To-do wiederkommt (Logik: repeat.ts) */
export interface TodoRepeat {
  rule: RepeatRule
  /** Erster Termin: Daran hängen Wochentag und Monatstag, auch nach kurzen Monaten */
  from: DateStr
  /** Die Erinnerungen jedes Termins, auch wenn die aktuellen schon weggeklickt sind */
  reminders: RepeatReminder[]
}

/** To-do für einen bestimmten Tag oder „irgendwann in dieser Woche“ (Logik: todos.ts). */
export interface Todo {
  id: string
  title: string
  scope: TodoScope
  /** scope 'tag': der Tag · scope 'woche': der Montag der Woche */
  date: DateStr
  /**
   * Offene Erinnerungen in Ortszeit 'JJJJ-MM-TTTHH:MM' (Uhrzeit auf der Wanduhr,
   * wie im Kalender), aufsteigend sortiert. Weggeklickte fallen heraus.
   */
  reminders: string[]
  repeat?: TodoRepeat
  /** Kennung der Reihe = id des ersten Termins; fehlt beim ersten Termin selbst */
  seriesId?: string
  done: boolean
  doneAt?: number
  /** Gelöschte To-dos bleiben als „Grabstein“ liegen (für späteren Sync) */
  deleted: boolean
  createdAt: number
  updatedAt: number
}

export interface Settings {
  /** Tageswechsel in Stunden nach Mitternacht (0–4) */
  dayStartHour: number
}

export const DEFAULT_SETTINGS: Settings = { dayStartHour: 0 }

/** Für die Berechnungen: an welchen Tagen wurde ein Habit erledigt (bzw. ausgesetzt)? */
export type DoneSet = ReadonlySet<DateStr>

/** Leere Menge als Standard für „keine Ausnahmetage“ */
export const NO_DAYS: DoneSet = new Set()

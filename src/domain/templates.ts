/**
 * Vorlagen für den schnellen Start: ein Tipp füllt das Formular vor, angepasst
 * wird danach wie gewohnt. Gespeichert wird nichts davon – eine Gewohnheit aus
 * einer Vorlage ist eine ganz normale Gewohnheit.
 */
import type { ColorKey } from './colors'
import type { HabitGoal, Metaphor } from './types'

export interface HabitTemplate {
  id: string
  name: string
  emoji: string
  color: ColorKey
  /** 0 = Sonntag … 6 = Samstag */
  days: number[]
  goal?: HabitGoal
  /** Dinge, die man lassen will, passen zum Schatten-Ich */
  metaphor?: Metaphor
}

const DAILY = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]
const MON_WED_FRI = [1, 3, 5]
const menge = (target: number, unit: string, step: number): HabitGoal => ({ kind: 'menge', target, unit, step })
const dauer = (minutes: number): HabitGoal => ({ kind: 'dauer', target: minutes, unit: '', step: 5 })

export const HABIT_TEMPLATES: HabitTemplate[] = [
  { id: 'wasser', name: 'Wasser trinken', emoji: '💧', color: 'tuerkis', days: DAILY, goal: menge(8, 'Gläser', 1) },
  { id: 'lesen', name: 'Lesen', emoji: '📖', color: 'flieder', days: DAILY, goal: dauer(20) },
  { id: 'laufen', name: 'Laufen', emoji: '🏃', color: 'koralle', days: MON_WED_FRI, goal: dauer(30) },
  { id: 'liegestuetze', name: 'Liegestütze', emoji: '💪', color: 'apricot', days: DAILY, goal: menge(50, 'Wdh.', 10) },
  { id: 'frueh', name: 'Früh aufstehen', emoji: '☀️', color: 'gold', days: WEEKDAYS },
  { id: 'social', name: 'Kein Social Media', emoji: '📵', color: 'weinrot', days: DAILY, metaphor: 'schatten' },
  { id: 'meditieren', name: 'Meditieren', emoji: '🧘', color: 'flieder', days: DAILY, goal: dauer(10) },
  { id: 'spazieren', name: 'Spazieren gehen', emoji: '🚶', color: 'gold', days: DAILY, goal: dauer(30) },
  { id: 'schlafen', name: 'Vor 23 Uhr ins Bett', emoji: '😴', color: 'blau', days: DAILY },
  { id: 'vokabeln', name: 'Vokabeln lernen', emoji: '🗣️', color: 'blau', days: DAILY, goal: dauer(15) },
  { id: 'obst', name: 'Obst und Gemüse', emoji: '🍎', color: 'koralle', days: DAILY, goal: menge(5, 'Portionen', 1) },
  { id: 'tagebuch', name: 'Tagebuch schreiben', emoji: '✍️', color: 'rosa', days: DAILY },
  { id: 'aufraeumen', name: 'Aufräumen', emoji: '🧹', color: 'tuerkis', days: DAILY, goal: dauer(10) },
  { id: 'zahnseide', name: 'Zahnseide', emoji: '🦷', color: 'tuerkis', days: DAILY },
  { id: 'kalt', name: 'Kalt duschen', emoji: '🧊', color: 'blau', days: DAILY },
  { id: 'sparen', name: 'Nichts Unnötiges kaufen', emoji: '💰', color: 'weinrot', days: DAILY, metaphor: 'schatten' },
]

export const templateById = (id: string | undefined) => HABIT_TEMPLATES.find((t) => t.id === id)

/** Kurzbeschreibung für die Auswahl, z. B. „8 Gläser · täglich“ */
export function templateHint(t: HabitTemplate): string {
  const amount = t.goal ? (t.goal.kind === 'dauer' ? `${t.goal.target} min` : `${t.goal.target} ${t.goal.unit}`) : 'abhaken'
  const when = t.days.length === 7 ? 'täglich' : t.days === WEEKDAYS ? 'Mo–Fr' : t.days === MON_WED_FRI ? 'Mo, Mi, Fr' : `${t.days.length}× pro Woche`
  return `${amount} · ${when}`
}

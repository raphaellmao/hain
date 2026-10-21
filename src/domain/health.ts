import { type DateStr, eachDay } from './dates'
import { isDue } from './schedule'
import { type DoneSet, type Habit, NO_DAYS } from './types'

/**
 * Gesundheitswert H – bestimmt, wie groß der Baum ist.
 *
 *   erledigt                       → H + 1 (höchstens H_MAX), Welke weg
 *   nicht fällig, nicht erledigt   → keine Änderung
 *   1. verpasster fälliger Tag     → H − 1, Baum welk (Warnung)
 *   ab dem 2. verpassten in Folge  → H halbiert (≈ eine Stufe tiefer)
 *
 * Die Stufengrenzen (1, 3, 7, 14, 30, 60, 100, 200, 365) verdoppeln sich
 * ungefähr, darum entspricht Halbieren ziemlich genau einer Stufe. Ein
 * blühender Baum (H = 60) ist nach 7 verpassten Tagen in Folge kahl, ein
 * voller Hain (H = 365) nach 10.
 *
 * Ab H = 100 (volle Blüte) wächst nicht mehr die Pflanze selbst, sondern
 * um sie herum ein Hain: bis zu fünf weitere Pflanzen (siehe tree/grove.ts).
 *
 * H wird nie gespeichert, sondern immer aus der Abhak-Historie neu
 * berechnet – so wirken nachträgliche Korrekturen sofort richtig.
 */

export const H_MAX = 365

/** H, ab dem Stufe 1 … 9 beginnt */
export const STAGE_THRESHOLDS = [1, 3, 7, 14, 30, 60, 100, 200, 365] as const
export const MAX_STAGE = STAGE_THRESHOLDS.length

/** Allgemeine Stufennamen (Laubbaum) – je Art siehe domain/species.ts */
export const STAGE_NAMES = [
  'Erde',
  'Samen',
  'Keimling',
  'Kleiner Busch',
  'Junger Baum',
  'Großer Baum',
  'Blühender Baum',
  'Kleiner Hain',
  'Hain',
  'Alter Hain',
] as const

export interface Health {
  /** aktueller Gesundheitswert 0 … H_MAX */
  h: number
  /** höchster je erreichter Wert */
  peak: number
  /** verpasste fällige Tage in Folge (bis gestern) */
  missRun: number
  /** welk = mindestens ein fälliger Tag in Folge verpasst und heute noch nicht erledigt */
  wilted: boolean
  /** kahl: H < 1, obwohl der Baum schon mal mindestens ein Busch war */
  dormant: boolean
  /** war schon einmal kahl und ist danach wieder zum Busch gewachsen (Erfolg „Comeback“) */
  comeback: boolean
}

export function computeHealth(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  done: DoneSet,
  today: DateStr,
  /** ausgesetzte Tage zählen nicht als verpasst */
  excused: DoneSet = NO_DAYS,
): Health {
  let h = 0
  let peak = 0
  let missRun = 0
  let wasBare = false
  let comeback = false

  if (habit.startDate <= today) {
    for (const d of eachDay(habit.startDate, today)) {
      if (done.has(d)) {
        h = Math.min(H_MAX, h + 1)
        missRun = 0
      } else if (d < today && isDue(habit, d) && !excused.has(d)) {
        missRun++
        h = missRun === 1 ? Math.max(0, h - 1) : h / 2
      }
      if (h > peak) peak = h
      if (h < 1 && peak >= STAGE_THRESHOLDS[2]) wasBare = true
      else if (wasBare && h >= STAGE_THRESHOLDS[2]) comeback = true
    }
  }

  return {
    h,
    peak,
    missRun,
    wilted: missRun > 0,
    dormant: h < 1 && peak >= STAGE_THRESHOLDS[2],
    comeback,
  }
}

/** Stufe 0 (Erde) … 9 (Alter Hain) */
export function stageOf(h: number): number {
  let stage = 0
  for (const t of STAGE_THRESHOLDS) if (h >= t) stage++
  return stage
}

/**
 * Stufenloser Wachstumswert g ∈ [0, 9] für die Darstellung:
 * ganzzahliger Teil = Stufe, Nachkommateil = Fortschritt zur nächsten Stufe.
 * Beispiel: H = 10 liegt zwischen 7 und 14 → g = 3 + 3/7 ≈ 3,43.
 * g 6 → 7 (H 60 → 100): die Pflanze füllt sich mit Blüten/Früchten,
 * g 7 → 9 (H 100 → 365): der Hain wächst.
 */
export function growthOf(h: number): number {
  const T = STAGE_THRESHOLDS
  if (h < T[0]) return h / T[0]
  for (let i = 0; i < T.length - 1; i++) {
    if (h < T[i + 1]) return i + 1 + (h - T[i]) / (T[i + 1] - T[i])
  }
  return MAX_STAGE
}

/** Umkehrung von growthOf: welches H gehört zu g? */
export function healthOfGrowth(g: number): number {
  const T = STAGE_THRESHOLDS
  if (g < 1) return g * T[0]
  if (g >= MAX_STAGE) return T[T.length - 1]
  const i = Math.floor(g) - 1
  return T[i] + (g - Math.floor(g)) * (T[i + 1] - T[i])
}

/** Wie viele erledigte Tage fehlen noch bis zur nächsten Stufe? */
export function nextStage(h: number): { stage: number; name: string; daysNeeded: number } | null {
  const stage = stageOf(h)
  if (stage >= STAGE_THRESHOLDS.length) return null
  const target = STAGE_THRESHOLDS[stage]
  return {
    stage: stage + 1,
    name: STAGE_NAMES[stage + 1],
    daysNeeded: Math.max(1, Math.ceil(target - h - 1e-9)),
  }
}

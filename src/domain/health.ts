import { type DateStr, eachDay } from './dates'
import { isDue } from './schedule'
import type { DoneSet, Habit } from './types'

/**
 * Gesundheitswert H – bestimmt, wie groß der Baum ist.
 *
 *   erledigt                       → H + 1 (höchstens H_MAX), Welke weg
 *   nicht fällig, nicht erledigt   → keine Änderung
 *   1. verpasster fälliger Tag     → H − 1, Baum welk (Warnung)
 *   ab dem 2. verpassten in Folge  → H halbiert (≈ eine Stufe tiefer)
 *
 * Die Stufengrenzen (1, 3, 7, 14, 30, 60) verdoppeln sich ungefähr, darum
 * entspricht Halbieren ziemlich genau einer Stufe. Ein blühender Baum
 * (H = 60) ist nach 7 verpassten Tagen in Folge kahl.
 *
 * H wird nie gespeichert, sondern immer aus der Abhak-Historie neu
 * berechnet – so wirken nachträgliche Korrekturen sofort richtig.
 */

export const H_MAX = 100

/** H, ab dem Stufe 1 … 6 beginnt */
export const STAGE_THRESHOLDS = [1, 3, 7, 14, 30, 60] as const

export const STAGE_NAMES = [
  'Erde',
  'Samen',
  'Keimling',
  'Kleiner Busch',
  'Junger Baum',
  'Großer Baum',
  'Blühender Baum',
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
}

export function computeHealth(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  done: DoneSet,
  today: DateStr,
): Health {
  let h = 0
  let peak = 0
  let missRun = 0

  if (habit.startDate <= today) {
    for (const d of eachDay(habit.startDate, today)) {
      if (done.has(d)) {
        h = Math.min(H_MAX, h + 1)
        missRun = 0
      } else if (d < today && isDue(habit, d)) {
        missRun++
        h = missRun === 1 ? Math.max(0, h - 1) : h / 2
      }
      if (h > peak) peak = h
    }
  }

  return {
    h,
    peak,
    missRun,
    wilted: missRun > 0,
    dormant: h < 1 && peak >= STAGE_THRESHOLDS[2],
  }
}

/** Stufe 0 (Erde) … 6 (Blühender Baum) */
export function stageOf(h: number): number {
  let stage = 0
  for (const t of STAGE_THRESHOLDS) if (h >= t) stage++
  return stage
}

/**
 * Stufenloser Wachstumswert g ∈ [0, 7] für die Darstellung:
 * ganzzahliger Teil = Stufe, Nachkommateil = Fortschritt zur nächsten Stufe.
 * Beispiel: H = 10 liegt zwischen 7 und 14 → g = 3 + 3/7 ≈ 3,43.
 * Ab 60 füllt sich der Baum bis H_MAX mit Blüten (g 6 → 7).
 */
export function growthOf(h: number): number {
  if (h < STAGE_THRESHOLDS[0]) return h / STAGE_THRESHOLDS[0]
  const bounds = [...STAGE_THRESHOLDS, H_MAX]
  for (let i = 0; i < bounds.length - 1; i++) {
    if (h < bounds[i + 1]) return i + 1 + (h - bounds[i]) / (bounds[i + 1] - bounds[i])
  }
  return 7
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

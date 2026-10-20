/**
 * Der Hain: Ab voller Blüte (H = 100) wachsen um die Hauptpflanze herum
 * nach und nach bis zu fünf weitere Pflanzen derselben Art. Jede beginnt als
 * Keimling und wächst danach einen Tag pro erledigtem Tag. Sinkt H (verpasste
 * Tage), verschwinden die jüngsten zuerst wieder.
 */
import { growthOf, healthOfGrowth } from '../domain/health'
import { GROUND } from './model'

export interface Companion {
  k: number
  seed: number
  /** eigenes Wachstum (0 … 6,9) */
  g: number
  /** Standort des Stammfußes und Verkleinerung (weiter hinten = kleiner) */
  x: number
  y: number
  s: number
}

const SLOTS = [
  { birth: 100, x: 40, y: GROUND - 7, s: 0.6 },
  { birth: 150, x: 162, y: GROUND - 9, s: 0.58 },
  { birth: 200, x: 68, y: GROUND - 21, s: 0.48 },
  { birth: 270, x: 134, y: GROUND - 23, s: 0.47 },
  { birth: 340, x: 100, y: GROUND - 34, s: 0.4 },
]

/** Ab welchem H kommt die k-te Begleitpflanze? */
export const GROVE_BIRTHS = SLOTS.map((s) => s.birth)

export const companionSeed = (seed: number, k: number) => (Math.imul(seed ^ 0x9e3779b9, 31 + k * 2) + k * 104729) >>> 0

/** Sichtbare Begleitpflanzen beim Wachstum g, hintere zuerst (Zeichenreihenfolge). */
export function companions(g: number, seed: number): Companion[] {
  if (g < 7) return []
  const h = healthOfGrowth(g)
  return SLOTS.flatMap((slot, k) =>
    h < slot.birth
      ? []
      : [{ k, seed: companionSeed(seed, k), g: Math.min(6.9, growthOf(h - slot.birth + 3)), x: slot.x, y: slot.y, s: slot.s }],
  ).sort((a, b) => a.y - b.y)
}

/** Wie viele Pflanzen stehen insgesamt im Hain (inkl. Hauptpflanze)? */
export const groveSize = (g: number) => 1 + companions(g, 0).length

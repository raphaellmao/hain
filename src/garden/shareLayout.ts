/** Anordnung der Pflanzen im Gartenbild zum Teilen (lib/gardenImage.tsx) */
import { rnd } from './palette'

export const W = 1080
export const HORIZON = 640

export interface Spot {
  index: number
  x: number
  /** Höhe des Fußpunkts */
  base: number
  size: number
  /** 0,68 hinten … 1 vorn */
  scale: number
}

/** Spalten und Reihen je nach Anzahl; ab drei Reihen wird das Bild hochkant (Story-Format) */
export function plantLayout(n: number): { height: number; cell: number; spots: Spot[] } {
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4
  const rows = Math.max(1, Math.ceil(n / cols))
  const height = rows <= 2 ? 1350 : 1920
  const cell = (W - 80) / cols
  const top = HORIZON + 10
  const bottom = height - 170
  // Die Grafiken haben Luft um die Pflanze – leicht überlappen dürfen sie sich
  const maxSize = cols === 1 ? 640 : cell * 1.25
  const spots: Spot[] = []
  for (let r = 0; r < rows; r++) {
    const t = rows === 1 ? 1 : r / (rows - 1)
    const scale = rows === 1 ? 1 : 0.68 + 0.32 * t
    const base = top + ((r + 1) * (bottom - top)) / rows
    const first = r * cols
    const inRow = Math.min(cols, n - first)
    // eine unvollständige letzte Reihe steht mittig
    const offset = ((cols - inRow) * cell) / 2
    for (let c = 0; c < inRow; c++) {
      const index = first + c
      const jitter = (rnd(index, 21) - 0.5) * cell * 0.1
      spots.push({ index, x: 40 + offset + (c + 0.5) * cell + jitter, base: base + (rnd(index, 22) - 0.5) * 14, size: Math.round(maxSize * scale), scale })
    }
  }
  return { height, cell, spots }
}


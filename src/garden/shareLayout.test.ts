import { describe, expect, it } from 'vitest'
import { plantLayout, W } from './shareLayout'

describe('Anordnung im Gartenbild', () => {
  it('eine Pflanze: groß und mittig, Bild 4:5', () => {
    const l = plantLayout(1)
    expect(l.height).toBe(1350)
    expect(l.spots).toHaveLength(1)
    expect(Math.abs(l.spots[0].x - W / 2)).toBeLessThan(60)
    expect(l.spots[0].scale).toBe(1)
  })

  it('viele Pflanzen: hochkant, hinten kleiner, jede genau einmal', () => {
    const l = plantLayout(14)
    expect(l.height).toBe(1920)
    expect(l.spots.map((s) => s.index).sort((a, b) => a - b)).toEqual([...Array(14).keys()])
    for (const s of l.spots) {
      expect(s.x).toBeGreaterThan(0)
      expect(s.x).toBeLessThan(W)
      expect(s.base).toBeLessThan(l.height - 150)
    }
    // Reihen von hinten nach vorn: Fußpunkte steigen, Größen wachsen
    const first = l.spots[0]
    const last = l.spots.at(-1)!
    expect(first.base).toBeLessThan(last.base)
    expect(first.size).toBeLessThan(last.size)
  })

  it('eine unvollständige letzte Reihe steht mittig', () => {
    const l = plantLayout(5) // 3 + 2
    const lastRow = l.spots.slice(3)
    const centre = (lastRow[0].x + lastRow[1].x) / 2
    expect(Math.abs(centre - W / 2)).toBeLessThan(40)
  })
})

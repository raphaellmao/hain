import { describe, expect, it } from 'vitest'
import { moonPhaseAt, weatherOn } from './sky'

describe('Mondphase', () => {
  const near = (phase: number, target: number) => Math.min(Math.abs(phase - target), 1 - Math.abs(phase - target))

  it('trifft bekannte Neumonde', () => {
    // Sonnenfinsternis vom 8. April 2024, 18:21 UTC
    expect(near(moonPhaseAt(new Date(Date.UTC(2024, 3, 8, 18, 21))), 0)).toBeLessThan(0.03)
    expect(near(moonPhaseAt(new Date(Date.UTC(2000, 0, 6, 18, 14))), 0)).toBeLessThan(0.001)
  })

  it('trifft bekannte Vollmonde', () => {
    // 13. Januar 2025, 22:27 UTC
    expect(near(moonPhaseAt(new Date(Date.UTC(2025, 0, 13, 22, 27))), 0.5)).toBeLessThan(0.03)
  })

  it('bleibt zwischen 0 und 1, auch vor dem Bezugsdatum', () => {
    for (const y of [1990, 2000, 2026, 2090]) {
      const phase = moonPhaseAt(new Date(Date.UTC(y, 5, 15)))
      expect(phase).toBeGreaterThanOrEqual(0)
      expect(phase).toBeLessThan(1)
    }
  })
})

describe('Wetter', () => {
  it('bleibt für einen Tag gleich', () => {
    expect(weatherOn(new Date(2026, 10, 5, 0, 1))).toBe(weatherOn(new Date(2026, 10, 5, 23, 59)))
  })

  it('ist meist klar, manchmal wolkig, selten Regen, und wechselt', () => {
    const count = { klar: 0, wolkig: 0, regen: 0 }
    let changes = 0
    let last = ''
    for (let i = 0; i < 730; i++) {
      const w = weatherOn(new Date(2026, 0, 1 + i))
      count[w]++
      if (w !== last) changes++
      last = w
    }
    expect(count.klar).toBeGreaterThan(count.wolkig)
    expect(count.wolkig).toBeGreaterThan(count.regen)
    expect(count.regen / 730).toBeGreaterThan(0.05)
    expect(count.regen / 730).toBeLessThan(0.2)
    expect(changes).toBeGreaterThan(200)
  })
})

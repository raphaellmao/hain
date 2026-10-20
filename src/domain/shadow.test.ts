import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { ALL_DAYS } from './schedule'
import { computeHealth } from './health'
import { TERRITORY_STATUS, computeShadowPower, daysToNextStatus, shadowState } from './shadow'

const daily = (startDate: string) => ({ startDate, schedule: [{ from: startDate, days: ALL_DAYS }] })
const run = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i))
const label = (i: number) => TERRITORY_STATUS[i].label

/** Zustand am Tag `start + day` (heute noch offen) */
function at(start: string, done: Set<string>, day: number) {
  const habit = daily(start)
  const today = addDays(start, day)
  return shadowState(computeHealth(habit, done, today).h, computeShadowPower(habit, done, today))
}

describe('Schatten-Ich', () => {
  it('beginnt im Patt', () => {
    const s = at('2026-10-01', new Set(), 0)
    expect(s.s).toBe(0)
    expect(s.territory).toBe(0.5)
    expect(label(s.status)).toBe('Patt')
  })

  it('wird an jedem verpassten Tag stärker, nie ganz 100', () => {
    const start = '2026-01-01'
    const powers = [1, 2, 3, 7, 30].map((d) => computeShadowPower(daily(start), new Set(), addDays(start, d)))
    expect(powers[0]).toBeCloseTo(18)
    expect(powers[1]).toBeCloseTo(32.76)
    for (let i = 1; i < powers.length; i++) expect(powers[i]).toBeGreaterThan(powers[i - 1])
    expect(powers[4]).toBeLessThan(100)
  })

  it('nach gut zwei Wochen Dranbleiben gehört dir das Land', () => {
    const start = '2026-01-01'
    expect(label(at(start, new Set(run(start, 15)), 15).status)).not.toBe('Dein Land') // 84,6 %
    expect(label(at(start, new Set(run(start, 16)), 16).status)).toBe('Dein Land')
  })

  it('von voller Stärke: nach 7 verpassten Tagen herrscht er', () => {
    const start = '2026-01-01'
    const done = new Set(run(start, 60))
    expect(label(at(start, done, 60).status)).toBe('Dein Land')
    const seq = [1, 3, 7].map((m) => label(at(start, done, 60 + m).status))
    expect(seq).toEqual(['Du drängst ihn zurück', 'Patt', 'Er herrscht'])
  })

  it('erledigte Tage schwächen ihn wieder', () => {
    const start = '2026-01-01'
    const done = new Set([...run(start, 60), ...run(addDays(start, 67), 10)]) // 7 verpasst, dann 10 erledigt
    const s = at(start, done, 77)
    expect(s.s).toBeLessThan(20)
    expect(label(s.status)).toBe('Du drängst ihn zurück')
  })

  it('weiß, wie viele Tage bis zur nächsten Lage fehlen', () => {
    expect(daysToNextStatus(0, 0)).toMatchObject({ days: 2, label: 'Du drängst ihn zurück' })
    expect(daysToNextStatus(365, 0)).toBeNull()
  })
})

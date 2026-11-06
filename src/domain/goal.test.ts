import { describe, expect, it } from 'vitest'
import { amountStats, clock, effectiveAmount, formatAmount, formatMinutes, goalLabel, parseAmount, parseGoal, progressOf, progressText, reached, roundAmount, stepLabel, timerMinutes, TIMER_CAP_MIN } from './goal'
import type { HabitGoal } from './types'

const glasses: HabitGoal = { kind: 'menge', target: 8, unit: 'Gläser', step: 1 }
const liter: HabitGoal = { kind: 'menge', target: 2, unit: 'l', step: 0.25 }
const reading: HabitGoal = { kind: 'dauer', target: 30, unit: '', step: 5 }

describe('Ziel erreicht?', () => {
  it('ab dem Ziel, auch mit Kommazahlen', () => {
    expect(reached(7, glasses)).toBe(false)
    expect(reached(8, glasses)).toBe(true)
    let sum = 0
    for (let i = 0; i < 8; i++) sum = roundAmount(sum + 0.25)
    expect(sum).toBe(2)
    expect(reached(sum, liter)).toBe(true)
    expect(reached(0.1 + 0.2 + 1.7, liter)).toBe(true)
  })

  it('Fortschritt bleibt zwischen 0 und 1', () => {
    expect(progressOf(4, glasses)).toBe(0.5)
    expect(progressOf(12, glasses)).toBe(1)
  })

  it('ohne Menge abgehakt zählt als erreicht', () => {
    expect(effectiveAmount(undefined, true, glasses)).toBe(8)
    expect(effectiveAmount(undefined, false, glasses)).toBe(0)
    expect(effectiveAmount(3, true, glasses)).toBe(3)
  })
})

describe('Anzeige', () => {
  it('Mengen und Minuten', () => {
    expect(formatAmount(1.5, liter)).toBe('1,5 l')
    expect(formatMinutes(25)).toBe('25 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(70)).toBe('1 h 10 min')
    expect(progressText(3, glasses)).toBe('3 / 8 Gläser')
    expect(progressText(12, reading)).toBe('12 / 30 min')
    expect(progressText(75, { ...reading, target: 90 })).toBe('1 h 15 min / 1 h 30 min')
    expect(goalLabel(glasses)).toBe('8 Gläser am Tag')
    expect(goalLabel(reading)).toBe('30 min am Tag')
    expect(stepLabel(liter)).toBe('+0,25')
    expect(stepLabel(reading)).toBe('+5 min')
  })

  it('Uhr für den laufenden Timer', () => {
    expect(clock(0)).toBe('00:00')
    expect(clock(312_000)).toBe('05:12')
    expect(clock(3_912_000)).toBe('1:05:12')
  })
})

describe('Eingaben', () => {
  it('liest Komma und Punkt, lehnt Unsinn ab', () => {
    expect(parseAmount('1,5')).toBe(1.5)
    expect(parseAmount(' 2.25 ')).toBe(2.25)
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('-1')).toBeNull()
    expect(parseAmount('viel')).toBeNull()
  })

  it('prüft Ziele aus Backups', () => {
    expect(parseGoal(glasses)).toEqual(glasses)
    expect(parseGoal({ ...reading, unit: 'egal' })).toEqual(reading)
    expect(parseGoal({ kind: 'menge', target: -1, unit: 'x', step: 1 })).toBeUndefined()
    expect(parseGoal({ kind: 'gewicht', target: 1, unit: 'x', step: 1 })).toBeUndefined()
    expect(parseGoal(undefined)).toBeUndefined()
  })
})

describe('Timer', () => {
  it('zählt ganze Minuten', () => {
    expect(timerMinutes(0, 59_999)).toEqual({ minutes: 0, capped: false })
    expect(timerMinutes(0, 25 * 60_000 + 30_000)).toEqual({ minutes: 25, capped: false })
  })

  it('begrenzt einen vergessenen Timer', () => {
    expect(timerMinutes(0, 3 * 24 * 3_600_000)).toEqual({ minutes: TIMER_CAP_MIN, capped: true })
  })
})

describe('Kennzahlen', () => {
  const habit = { startDate: '2026-11-01', schedule: [{ from: '2026-11-01', days: [0, 1, 2, 3, 4, 5, 6] }] }
  const today = '2026-11-06'

  it('Durchschnitt an fälligen Tagen, heute erst mit Menge', () => {
    const amounts = new Map([
      ['2026-11-01', 8],
      ['2026-11-02', 4],
      ['2026-11-03', 6],
    ])
    // 4. und 5. nichts eingetragen = 0, heute noch nichts = zählt nicht
    const s = amountStats(habit, glasses, amounts, new Set(['2026-11-01']), today)
    expect(s.average).toBe(3.6)
    expect(s.total).toBe(18)
    expect(s.best).toBe(8)
  })

  it('ohne Menge abgehakte Tage zählen als Ziel, ausgesetzte nicht', () => {
    const s = amountStats(habit, glasses, new Map(), new Set(['2026-11-01', '2026-11-02']), today, new Set(['2026-11-03', '2026-11-04', '2026-11-05']))
    expect(s.average).toBe(8)
    expect(s.total).toBe(16)
  })

  it('vor dem Start: nichts', () => {
    expect(amountStats(habit, glasses, new Map(), new Set(), '2026-10-01').average).toBeNull()
  })
})

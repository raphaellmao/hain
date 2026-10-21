import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { ALL_DAYS } from './schedule'
import { combineMonthly, monthlyRates } from './stats'
import { computeHealth } from './health'
import { bestShadowStatus } from './shadow'
import { shadowTaunt } from './taunts'
import { computeAchievements } from './achievements'
import { summarize } from './summary'
import type { Habit } from './types'
import { skyAt } from '../lib/sky'
import { hexToHsl, withContrast } from './colors'

const daily = (startDate: string) => ({ startDate, schedule: [{ from: startDate, days: ALL_DAYS }] })
const run = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i))

describe('Erfolgsquote je Monat', () => {
  it('rechnet pro Kalendermonat, laufender Monat bis heute', () => {
    // Start 1.9., September komplett erledigt, im Oktober 10 von 20 bis zum 21.
    const done = new Set([...run('2026-09-01', 30), ...run('2026-10-01', 10)])
    const m = monthlyRates(daily('2026-09-01'), done, '2026-10-21', undefined, 3)
    expect(m.map((x) => x.month)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(m[0].rate).toBeNull() // vor dem Start
    expect(m[1]).toMatchObject({ rate: 1, done: 30, due: 30, partial: false })
    expect(m[2]).toMatchObject({ done: 10, due: 20, partial: true }) // 21. ist heute und offen
  })

  it('fasst mehrere Habits zusammen', () => {
    const a = [{ month: '2026-10', rate: 1, done: 10, due: 10, partial: true }]
    const b = [{ month: '2026-10', rate: 0, done: 0, due: 10, partial: true }]
    expect(combineMonthly([a, b])[0]).toMatchObject({ rate: 0.5, done: 10, due: 20 })
  })
})

describe('Comeback und bester Kampf', () => {
  it('erkennt ein Comeback nach kahl', () => {
    const start = '2026-01-01'
    // 20 erledigt, 10 verpasst (kahl), 10 erledigt (wieder Busch)
    const done = new Set([...run(start, 20), ...run(addDays(start, 30), 10)])
    expect(computeHealth(daily(start), done, addDays(start, 29)).comeback).toBe(false)
    expect(computeHealth(daily(start), done, addDays(start, 40)).comeback).toBe(true)
  })

  it('merkt sich die beste Lage gegen den Schatten', () => {
    const start = '2026-01-01'
    const done = new Set(run(start, 30)) // danach nur noch verpasst
    expect(bestShadowStatus(daily(start), done, addDays(start, 60))).toBe(4) // war schon „Dein Land“
  })
})

describe('Drohungen des Schattens', () => {
  const base = { habitId: 'h1', today: '2026-10-21', status: 1, missRun: 0, doneToday: false, excusedToday: false }
  it('bleibt einen Tag lang gleich und wechselt am nächsten', () => {
    expect(shadowTaunt(base)).toBe(shadowTaunt(base))
    const week = new Set(Array.from({ length: 7 }, (_, i) => shadowTaunt({ ...base, today: addDays('2026-10-21', i) })))
    expect(week.size).toBeGreaterThan(1)
  })
  it('reagiert auf Ausnahmen', () => {
    expect(['Ausreden. Ich zähle mit.', 'Heute lasse ich dich. Morgen nicht.', 'Krank, Dienst, unterwegs … ich kenne sie alle.'])
      .toContain(shadowTaunt({ ...base, excusedToday: true }))
  })
})

describe('Erfolge', () => {
  it('schaltet frei, was erreicht ist, und zeigt sonst den Fortschritt', () => {
    const start = '2026-01-01'
    const today = addDays(start, 20)
    const habit = { id: 'h1', name: 'x', emoji: '📖', color: 'blau', ...daily(start), seed: 1, order: 1, deleted: false, createdAt: 0, updatedAt: 0 } as Habit
    const done = new Set(run(start, 20))
    const list = computeAchievements({
      items: [{ habit, done, excused: new Set(), summary: summarize(habit, done, today) }],
      today,
      notes: 2,
      backedUp: false,
      ticks: { early: 0, late: 0, ghost: false },
    })
    const get = (id: string) => list.find((x) => x.id === id)!
    expect(get('baum').achieved).toBe(true) // H 20 ≥ 14
    expect(get('serie-7').achieved).toBe(true)
    expect(get('serie-30')).toMatchObject({ achieved: false, value: 20, target: 30 })
    expect(get('tagebuch')).toMatchObject({ achieved: false, value: 2 })
  })
})

describe('Tageszeit', () => {
  // Zeiten so gewählt, dass sie mit und ohne Sommerzeit (CI läuft in UTC) stimmen
  it('kennt Tag, Abend und Nacht im Herbst', () => {
    expect(skyAt(new Date(2026, 9, 21, 12, 0))).toMatchObject({ phase: 'tag', season: 'herbst' })
    expect(skyAt(new Date(2026, 9, 21, 17, 45)).phase).toBe('abend')
    expect(skyAt(new Date(2026, 9, 21, 23, 0)).phase).toBe('nacht')
    expect(skyAt(new Date(2026, 9, 21, 7, 45)).phase).toBe('morgen')
    expect(skyAt(new Date(2027, 0, 10, 12, 0)).season).toBe('winter')
  })
})

describe('Balkenfarben', () => {
  it('dunkelt helle Farben ab, dunkle bleiben', () => {
    const gold = withContrast('#e2bd3a')
    const l = Number(gold.match(/([\d.]+)%\)$/)![1])
    expect(l).toBeLessThan(hexToHsl('#e2bd3a').l - 10)
    expect(withContrast('#c44a6e')).toContain(`${hexToHsl('#c44a6e').l.toFixed(1)}%`)
  })
})

describe('Neue Erfolge', () => {
  const mk = (id: string, start: string, extra: Partial<Habit> = {}) =>
    ({ id, name: id, emoji: '⭐', color: 'blau', ...daily(start), seed: 1, order: 1, deleted: false, createdAt: 0, updatedAt: 0, ...extra }) as Habit
  const ctx = (items: { habit: Habit; done: Set<string> }[], today: string, ticks = { early: 0, late: 0, ghost: false }) =>
    computeAchievements({
      items: items.map(({ habit, done }) => ({ habit, done, excused: new Set<string>(), summary: summarize(habit, done, today) })),
      today,
      notes: 0,
      backedUp: false,
      ticks,
    })
  const get = (list: ReturnType<typeof computeAchievements>, id: string) => list.find((a) => a.id === id)!

  it('Phönix: aus kahl bis zum Hain', () => {
    const start = '2025-01-01'
    // 20 erledigt, 10 verpasst (kahl), dann 110 erledigt
    const done = new Set([...run(start, 20), ...run(addDays(start, 30), 110)])
    const list = ctx([{ habit: mk('h', start), done }], addDays(start, 140))
    expect(get(list, 'comeback').achieved).toBe(true)
    expect(get(list, 'phoenix').achieved).toBe(true)
  })

  it('Aus der Dunkelheit beim Schatten-Ich', () => {
    const start = '2025-01-01'
    // 14 verpasst (er herrscht), dann 30 erledigt (Dein Land)
    const done = new Set(run(addDays(start, 14), 30))
    const list = ctx([{ habit: mk('s', start, { metaphor: 'schatten' }), done }], addDays(start, 44))
    expect(get(list, 'dunkelheit').achieved).toBe(true)
  })

  it('Perfekter Tag, Doppelpack und Kaltstart', () => {
    const today = '2026-10-21'
    const habits = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ habit: mk(id, today), done: new Set([today]) }))
    const list = ctx(habits, today)
    expect(get(list, 'perfekter-tag').achieved).toBe(true)
    expect(get(list, 'doppelpack').achieved).toBe(true)
    expect(get(list, 'kaltstart').achieved).toBe(true)
    expect(get(list, 'gaertner').achieved).toBe(true)
  })

  it('Uhrzeit- und Geheimerfolge', () => {
    const today = '2026-12-25'
    const list = ctx([{ habit: mk('a', '2026-12-01'), done: new Set(['2026-12-24']) }], today, { early: 12, late: 3, ghost: true })
    expect(get(list, 'fruehaufsteher').achieved).toBe(true)
    expect(get(list, 'nachteule')).toMatchObject({ achieved: false, value: 3, target: 10 })
    expect(get(list, 'geisterstunde')).toMatchObject({ achieved: true, secret: true })
    expect(get(list, 'weihnachten').achieved).toBe(true)
    expect(get(list, 'neujahr').achieved).toBe(false)
  })

  it('jeder Erfolg hat eine eindeutige ID', () => {
    const list = ctx([{ habit: mk('a', '2026-10-01'), done: new Set<string>() }], '2026-10-21')
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length)
    expect(list.length).toBeGreaterThanOrEqual(45)
  })
})

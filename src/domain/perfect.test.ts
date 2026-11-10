import { describe, expect, it } from 'vitest'
import { eachDay } from './dates'
import { dayStatus, perfectStats } from './perfect'
import type { Habit } from './types'

const habit = (id: string, days = [0, 1, 2, 3, 4, 5, 6], start = '2026-11-01'): Habit => ({
  id, name: id, emoji: '•', color: 'blau', seed: 1, order: 1, startDate: start,
  schedule: [{ from: start, days }], deleted: false, createdAt: 1, updatedAt: 1,
})
const days = (from: string, to: string) => new Set(eachDay(from, to))

describe('Perfekte Tage', () => {
  it('ein Tag ist perfekt, wenn alles Fällige erledigt ist; Ausgesetztes zählt nicht', () => {
    const items = [
      { habit: habit('a'), done: new Set(['2026-11-05']), excused: new Set<string>() },
      { habit: habit('b'), done: new Set<string>(), excused: new Set(['2026-11-05']) },
    ]
    expect(dayStatus(items, '2026-11-05')).toEqual({ due: 1, done: 1, complete: true })
    expect(dayStatus(items, '2026-11-06').complete).toBe(false)
    // alles ausgesetzt: nichts fällig, also kein perfekter Tag
    expect(dayStatus([items[1]], '2026-11-05')).toEqual({ due: 0, done: 0, complete: false })
  })

  it('Serie bis heute und Summe', () => {
    const items = [{ habit: habit('a'), done: new Set([...days('2026-11-01', '2026-11-03'), ...days('2026-11-06', '2026-11-10')]), excused: new Set<string>() }]
    expect(perfectStats(items, '2026-11-10')).toEqual({ today: true, streak: 5, total: 8 })
  })

  it('heute noch offen: die Serie bis gestern zählt weiter', () => {
    const items = [{ habit: habit('a'), done: days('2026-11-06', '2026-11-09'), excused: new Set<string>() }]
    expect(perfectStats(items, '2026-11-10')).toEqual({ today: false, streak: 4, total: 4 })
  })

  it('Tage ohne Fälliges unterbrechen nichts', () => {
    // nur Mo, Mi, Fr fällig (3.11. Di … 10.11. Di)
    const items = [{ habit: habit('a', [1, 3, 5]), done: new Set(['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09']), excused: new Set<string>() }]
    expect(perfectStats(items, '2026-11-10')).toMatchObject({ streak: 4, total: 4 })
  })

  it('ohne Gewohnheiten nichts', () => {
    expect(perfectStats([], '2026-11-10')).toEqual({ today: false, streak: 0, total: 0 })
  })
})

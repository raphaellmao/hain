import { describe, expect, it } from 'vitest'
import { cleanPlan, groupByRoutine, routineProgress } from './routine'
import type { Habit, Routine } from './types'

const habit = (id: string): Habit => ({
  id, name: id, emoji: '•', color: 'blau', seed: 1, order: 1, startDate: '2026-10-01',
  schedule: [{ from: '2026-10-01', days: [0, 1, 2, 3, 4, 5, 6] }], deleted: false, createdAt: 1, updatedAt: 1,
})
const routine = (id: string, habitIds: string[]): Routine => ({ id, name: id, emoji: '🌅', habitIds, order: 1, deleted: false, createdAt: 1, updatedAt: 1 })
const item = (id: string) => ({ habit: habit(id) })

describe('Plan', () => {
  it('bereinigt und kürzt', () => {
    expect(cleanPlan('  Nach   dem Dienst ')).toBe('Nach dem Dienst')
    expect(cleanPlan('   ')).toBeUndefined()
    expect(cleanPlan(undefined)).toBeUndefined()
    expect(cleanPlan('x'.repeat(200))).toHaveLength(80)
  })
})

describe('Routinen auf „Heute“', () => {
  it('fasst zusammen, an der Stelle der ersten fälligen, in Routinen-Reihenfolge', () => {
    const due = ['a', 'b', 'c', 'd', 'e'].map(item)
    const entries = groupByRoutine(due, [routine('morgen', ['d', 'b'])])
    expect(entries.map((e) => (e.kind === 'habit' ? e.item.habit.id : `[${e.items.map((i) => i.habit.id).join(',')}]`))).toEqual(['a', '[d,b]', 'c', 'e'])
  })

  it('nicht fällige Glieder fehlen, ohne fällige gibt es keine Karte', () => {
    const entries = groupByRoutine(['a', 'c'].map(item), [routine('r1', ['b', 'c']), routine('r2', ['x', 'y'])])
    expect(entries).toHaveLength(2)
    expect(entries[1]).toMatchObject({ kind: 'routine', routine: { id: 'r1' } })
    if (entries[1].kind === 'routine') expect(entries[1].items.map((i) => i.habit.id)).toEqual(['c'])
  })

  it('eine Gewohnheit nur in der ersten Routine, die sie nennt', () => {
    const entries = groupByRoutine(['a', 'b'].map(item), [routine('r1', ['a']), routine('r2', ['a', 'b'])])
    const ids = entries.map((e) => (e.kind === 'routine' ? `${e.routine.id}:${e.items.map((i) => i.habit.id).join(',')}` : e.item.habit.id))
    expect(ids).toEqual(['r1:a', 'r2:b'])
  })

  it('Fortschritt: nächste offene, Ausgesetztes zählt nicht', () => {
    const day = '2026-10-10'
    const mk = (done: boolean, off = false) => ({ habit: habit('h'), done: new Set(done ? [day] : []), excused: new Set(off ? [day] : []) })
    let p = routineProgress([mk(true), mk(false), mk(false)], day)
    expect(p).toMatchObject({ next: 1, done: 1, total: 3, complete: false })
    p = routineProgress([mk(true), mk(false, true), mk(true)], day)
    expect(p).toMatchObject({ next: -1, done: 2, total: 2, complete: true, states: ['done', 'off', 'done'] })
    expect(routineProgress([mk(false, true)], day).complete).toBe(false)
  })
})

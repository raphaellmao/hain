import { describe, expect, it } from 'vitest'
import { herbariumOf } from './herbarium'
import { seedWith } from './mutation'
import type { HabitSummary } from './summary'
import type { Habit } from './types'

const habit = (id: string, species: Habit['species'], seed = 5, metaphor: Habit['metaphor'] = 'pflanze'): Habit => ({
  id, name: id, emoji: '•', color: 'blau', seed, order: 1, startDate: '2026-01-01', species, metaphor,
  schedule: [{ from: '2026-01-01', days: [0, 1, 2, 3, 4, 5, 6] }], deleted: false, createdAt: 1, updatedAt: 1,
})
const sum = (peak: number) => ({ health: { peak } }) as unknown as HabitSummary

describe('Herbarium', () => {
  it('zählt Arten, die einmal geblüht haben – auch wenn sie jetzt welken', () => {
    const h = herbariumOf([
      { habit: habit('a', 'kirsche'), summary: sum(80) },
      { habit: habit('b', 'kirsche'), summary: sum(120) },
      { habit: habit('c', 'tanne'), summary: sum(59) },
      { habit: habit('d', 'kaktus', 5, 'schatten'), summary: sum(200) },
    ])
    expect([...h.bloomed.keys()]).toEqual(['kirsche'])
    expect(h.bloomed.get('kirsche')?.id).toBe('b')
  })

  it('Mutationen ab dem Busch', () => {
    const gold = seedWith('goldlaub')
    expect(herbariumOf([{ habit: habit('a', 'apfel', gold), summary: sum(3) }]).mutations.size).toBe(0)
    expect(herbariumOf([{ habit: habit('a', 'apfel', gold), summary: sum(7) }]).mutations.get('goldlaub')?.id).toBe('a')
  })
})

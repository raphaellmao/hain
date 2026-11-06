import { describe, expect, it } from 'vitest'
import { eachDay } from './dates'
import { formatMood, isMood, moodEmoji, moodLinks, moodSummary } from './mood'
import type { Habit, Mood } from './types'

const habit = (id: string, start = '2026-10-01'): Habit => ({
  id, name: id, emoji: '•', color: 'blau', seed: 1, order: 1, startDate: start,
  schedule: [{ from: start, days: [0, 1, 2, 3, 4, 5, 6] }], deleted: false, createdAt: 1, updatedAt: 1,
})
const days = [...eachDay('2026-10-01', '2026-10-20')]

describe('Stimmung', () => {
  it('fasst einen Zeitraum zusammen', () => {
    const moods = new Map<string, Mood>([
      ['2026-10-01', 2],
      ['2026-10-02', 4],
      ['2026-10-03', 4],
      ['2026-11-01', 5], // außerhalb
    ])
    const s = moodSummary(moods, '2026-10-01', '2026-10-31')
    expect(s.count).toBe(3)
    expect(s.average).toBeCloseTo(10 / 3)
    expect(s.counts).toEqual([0, 1, 0, 2, 0])
    expect(moodSummary(new Map(), '2026-10-01', '2026-10-31').average).toBeNull()
  })

  it('Gesicht und Zahl zum Durchschnitt', () => {
    expect(moodEmoji(3.8)).toBe('🙂')
    expect(moodEmoji(1)).toBe('😞')
    expect(moodEmoji(5)).toBe('😄')
    expect(formatMood(3.75)).toBe('3,8')
    expect(isMood(3)).toBe(true)
    expect(isMood(6)).toBe(false)
    expect(isMood('3')).toBe(false)
  })

  it('findet, welche Gewohnheit mit guten Tagen zusammenhängt', () => {
    // Sport an geraden Tagen erledigt, dann Stimmung 5, sonst 2; Lesen ohne Muster
    const moods = new Map<string, Mood>(days.map((d, i) => [d, i % 2 === 0 ? 5 : 2]))
    const sport = new Set(days.filter((_, i) => i % 2 === 0))
    const lesen = new Set(days.filter((_, i) => i % 4 < 2))
    const links = moodLinks(
      [
        { habit: habit('lesen'), done: lesen, excused: new Set() },
        { habit: habit('sport'), done: sport, excused: new Set() },
      ],
      moods,
      '2026-10-21',
    )
    expect(links[0].habit.id).toBe('sport')
    expect(links[0].withAvg).toBe(5)
    expect(links[0].withoutAvg).toBe(2)
    expect(links[0].diff).toBe(3)
    expect(Math.abs(links[1].diff)).toBeLessThan(0.5)
  })

  it('zu wenige Tage: keine Aussage', () => {
    const moods = new Map<string, Mood>(days.slice(0, 5).map((d) => [d, 4]))
    const links = moodLinks([{ habit: habit('x'), done: new Set(days.slice(0, 2)), excused: new Set() }], moods, '2026-10-21')
    expect(links).toEqual([])
  })

  it('ausgesetzte, nicht fällige und heutige Tage zählen nicht als „nicht erledigt“', () => {
    const moods = new Map<string, Mood>(days.map((d) => [d, 3]))
    const links = moodLinks(
      [{ habit: habit('x'), done: new Set(days.slice(0, 10)), excused: new Set(days.slice(10, 15)) }],
      moods,
      '2026-10-20',
    )
    // ohne: nur 16.–19. (der 20. ist heute) = 4 Tage
    expect(links[0].withoutDays).toBe(4)
  })
})

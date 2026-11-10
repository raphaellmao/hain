import { describe, expect, it } from 'vitest'
import { missedBefore, missedText } from './missed'

const habit = (days = [0, 1, 2, 3, 4, 5, 6], start = '2026-11-01') => ({ startDate: start, schedule: [{ from: start, days }] })
const set = (...d: string[]) => new Set(d)
const none = set()

// 10.11.2026 ist ein Dienstag
describe('Nie zweimal aussetzen', () => {
  it('gestern verpasst', () => {
    const run = missedBefore(habit(), set('2026-11-08'), none, '2026-11-10')
    expect(run).toEqual({ count: 1, last: '2026-11-09' })
    expect(missedText(run!, '2026-11-10')).toBe('Gestern hast du’s schon verpasst')
  })

  it('gestern erledigt: nichts', () => {
    expect(missedBefore(habit(), set('2026-11-09'), none, '2026-11-10')).toBeNull()
  })

  it('nur Mo, Mi, Fr fällig: am Montag verpasst, heute Mittwoch', () => {
    const run = missedBefore(habit([1, 3, 5]), set('2026-11-06'), none, '2026-11-11')
    expect(run).toEqual({ count: 1, last: '2026-11-09' })
    expect(missedText(run!, '2026-11-11')).toBe('Am Montag hast du’s schon verpasst')
  })

  it('ausgesetzte Tage sind kein Verpassen und werden übersprungen', () => {
    expect(missedBefore(habit(), set('2026-11-08'), set('2026-11-09'), '2026-11-10')).toBeNull()
    const run = missedBefore(habit(), set('2026-11-07'), set('2026-11-09'), '2026-11-10')
    expect(run).toEqual({ count: 1, last: '2026-11-08' })
    expect(missedText(run!, '2026-11-10')).toBe('Am Sonntag hast du’s schon verpasst')
  })

  it('mehrmals in Folge', () => {
    const run = missedBefore(habit(), set('2026-11-06'), none, '2026-11-10')
    expect(run).toEqual({ count: 3, last: '2026-11-09' })
    expect(missedText(run!, '2026-11-10')).toBe('Schon 3× in Folge verpasst')
  })

  it('vor dem Start zählt nichts', () => {
    expect(missedBefore(habit(undefined, '2026-11-10'), none, none, '2026-11-10')).toBeNull()
    expect(missedBefore(habit(undefined, '2026-11-09'), none, none, '2026-11-10')).toEqual({ count: 1, last: '2026-11-09' })
  })
})

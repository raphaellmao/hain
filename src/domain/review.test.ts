import { describe, expect, it } from 'vitest'
import { buildWeekReview, nextReviewWeek, reviewCardWeek, reviewVerdict, weekToReview, type ReviewItem } from './review'
import { addDays, eachDay } from './dates'
import type { Habit, Todo } from './types'

// Woche von Montag, 2. November, bis Sonntag, 8. November 2026
const MONDAY = '2026-11-02'
const SUNDAY = '2026-11-08'
const NEXT_MONDAY = '2026-11-09'
const ALL = [0, 1, 2, 3, 4, 5, 6]

const habit = (patch: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Lesen', emoji: '📖', color: 'blau', schedule: [{ from: '2026-10-01', days: ALL }], startDate: '2026-10-01',
  seed: 1, order: 1, deleted: false, createdAt: 1, updatedAt: 1, ...patch,
})
const item = (done: string[], patch: Partial<Habit> = {}, excused: string[] = []): ReviewItem => ({
  habit: habit(patch), done: new Set(done), excused: new Set(excused),
})
const todo = (patch: Partial<Todo>): Todo => ({
  id: 't', title: 'x', scope: 'tag', date: MONDAY, reminders: [], done: false, deleted: false, createdAt: 1, updatedAt: 1, ...patch,
})
const week = [...eachDay(MONDAY, SUNDAY)]

describe('Quote der Woche', () => {
  it('zählt erledigte und fällige Tage', () => {
    const r = buildWeekReview([item(week.slice(0, 5))], [], MONDAY, NEXT_MONDAY)
    expect(r).toMatchObject({ done: 5, due: 7, running: false })
    expect(r.rate).toBeCloseTo(5 / 7)
  })

  it('ausgesetzte Tage zählen nicht', () => {
    const r = buildWeekReview([item(week.slice(0, 5), {}, week.slice(5))], [], MONDAY, NEXT_MONDAY)
    expect(r).toMatchObject({ done: 5, due: 5, rate: 1 })
  })

  it('am laufenden Tag zählt nur, was schon erledigt ist', () => {
    const r = buildWeekReview([item(week.slice(0, 2))], [], MONDAY, '2026-11-04')
    expect(r).toMatchObject({ done: 2, due: 2, rate: 1, running: true })
    expect(r.days[2].rate).toBeNull() // heute noch offen
    expect(r.days[3].rate).toBeNull() // Zukunft
  })

  it('zählt erst ab dem Startdatum einer Gewohnheit', () => {
    const r = buildWeekReview([item(week.slice(3), { startDate: '2026-11-05', schedule: [{ from: '2026-11-05', days: ALL }] })], [], MONDAY, NEXT_MONDAY)
    expect(r).toMatchObject({ done: 4, due: 4, rate: 1 })
  })

  it('lässt Gewohnheiten weg, die erst später beginnen', () => {
    const r = buildWeekReview([item([], { startDate: '2026-12-01', schedule: [{ from: '2026-12-01', days: ALL }] })], [], MONDAY, NEXT_MONDAY)
    expect(r.habits).toEqual([])
    expect(r.rate).toBeNull()
  })

  it('vergleicht mit der Woche davor', () => {
    const before = [...eachDay(addDays(MONDAY, -7), addDays(MONDAY, -5))]
    const r = buildWeekReview([item([...before, ...week])], [], MONDAY, NEXT_MONDAY)
    expect(r.previousRate).toBeCloseTo(3 / 7)
  })

  it('zeigt jeden Tag der Woche', () => {
    const r = buildWeekReview([item([week[0]]), item([week[0], week[1]], { id: 'h2' })], [], MONDAY, NEXT_MONDAY)
    expect(r.days.map((d) => d.rate)).toEqual([1, 0.5, 0, 0, 0, 0, 0])
    expect(r.days[0]).toMatchObject({ done: 2, due: 2 })
  })

  it('sortiert die Gewohnheiten, die beste zuerst, und kennt jeden Tag', () => {
    const r = buildWeekReview([item([week[0]], { id: 'schwach' }), item(week, { id: 'stark' })], [], MONDAY, NEXT_MONDAY)
    expect(r.habits.map((h) => h.habit.id)).toEqual(['stark', 'schwach'])
    expect(r.habits[1].days.slice(0, 2)).toEqual(['done', 'missed'])
  })
})

describe('Serie und Aufstieg', () => {
  it('kennt die längste laufende Serie am Ende der Woche', () => {
    const r = buildWeekReview([item(week.slice(-3), { id: 'kurz' }), item(week, { id: 'lang' })], [], MONDAY, NEXT_MONDAY)
    expect(r.streak).toMatchObject({ days: 7, habit: { id: 'lang' } })
  })

  it('ohne Serie: null', () => {
    expect(buildWeekReview([item([])], [], MONDAY, '2026-11-20').streak).toBeNull()
  })

  it('merkt, was eine Stufe aufgestiegen ist (bei H = 7 von Sprössling zu Busch)', () => {
    // Sechs Tage vor der Woche ergeben H = 6, mit der Woche geht es über die Schwelle 7
    const earlier = [...eachDay(addDays(MONDAY, -6), addDays(MONDAY, -1))]
    const start = { startDate: earlier[0], schedule: [{ from: earlier[0], days: ALL }] }
    const r = buildWeekReview([item([...earlier, ...week], start)], [], MONDAY, NEXT_MONDAY)
    expect(r.advanced).toHaveLength(1)
    expect(r.advanced[0].habit.id).toBe('h1')
  })

  it('wer gleich bleibt oder fällt, steht nicht in der Liste', () => {
    expect(buildWeekReview([item([])], [], MONDAY, NEXT_MONDAY).advanced).toEqual([])
  })
})

describe('To-dos im Rückblick', () => {
  const inWeek = new Date(2026, 10, 4, 12).getTime()

  it('zählt, was in dieser Woche erledigt wurde', () => {
    const r = buildWeekReview(
      [],
      [
        todo({ id: 'a', done: true, doneAt: inWeek }),
        todo({ id: 'b', done: true, doneAt: new Date(2026, 9, 20).getTime() }),
        todo({ id: 'c', done: true, doneAt: inWeek, deleted: true }),
      ],
      MONDAY,
      NEXT_MONDAY,
    )
    expect(r.todosDone).toBe(1)
  })

  it('der Tageswechsel gilt auch hier: Montag 01:00 gehört bei 3 Uhr noch zum Sonntag', () => {
    const t = todo({ done: true, doneAt: new Date(2026, 10, 9, 1).getTime() })
    expect(buildWeekReview([], [t], MONDAY, NEXT_MONDAY, 3).todosDone).toBe(1)
    expect(buildWeekReview([], [t], MONDAY, NEXT_MONDAY, 0).todosDone).toBe(0)
  })

  it('kennt, was liegen geblieben ist, aber nicht, was später geplant ist', () => {
    const r = buildWeekReview(
      [],
      [
        todo({ id: 'alt', date: '2026-10-20' }),
        todo({ id: 'sonntag', date: SUNDAY }),
        todo({ id: 'woche', scope: 'woche', date: MONDAY }),
        todo({ id: 'später', date: NEXT_MONDAY }),
        todo({ id: 'nächste Woche', scope: 'woche', date: NEXT_MONDAY }),
        todo({ id: 'erledigt', done: true, doneAt: inWeek }),
        todo({ id: 'gelöscht', deleted: true }),
      ],
      MONDAY,
      NEXT_MONDAY,
    )
    expect(r.leftOver.map((t) => t.id)).toEqual(['alt', 'sonntag', 'woche'])
  })
})

describe('Urteil in Worten', () => {
  const verdict = (rate: number | null, previousRate: number | null = null, running = false) => reviewVerdict({ rate, previousRate, running })

  it('findet passende Worte', () => {
    expect(verdict(0.95).title).toBe('Eine starke Woche')
    expect(verdict(0.75).title).toBe('Eine gute Woche')
    expect(verdict(0.5).title).toBe('Eine durchwachsene Woche')
    expect(verdict(0.1).title).toBe('Eine schwere Woche')
    expect(verdict(null).title).toBe('Nichts fällig')
    expect(verdict(0.95, null, true).title).toBe('Bisher eine starke Woche')
  })

  it('vergleicht in Prozentpunkten', () => {
    expect(verdict(0.8, 0.7).detail).toBe('10 Prozentpunkte mehr als die Woche davor')
    expect(verdict(0.7, 0.8).detail).toBe('10 Prozentpunkte weniger als die Woche davor')
    expect(verdict(0.71, 0.7).detail).toBe('1 Prozentpunkt mehr als die Woche davor')
    expect(verdict(0.7, 0.7).detail).toBe('Genauso gut wie die Woche davor')
    expect(verdict(0.7).detail).toBeNull()
  })
})

describe('Welche Woche?', () => {
  it('am Sonntag die laufende, sonst die letzte', () => {
    expect(weekToReview(SUNDAY)).toBe(MONDAY)
    expect(weekToReview(NEXT_MONDAY)).toBe(MONDAY)
    expect(weekToReview('2026-11-11')).toBe(MONDAY)
    expect(weekToReview('2026-11-07')).toBe('2026-10-26')
  })

  it('die Karte erscheint Sonntag und Montag, bis sie angesehen wurde', () => {
    expect(reviewCardWeek(SUNDAY, null)).toBe(MONDAY)
    expect(reviewCardWeek(NEXT_MONDAY, null)).toBe(MONDAY)
    expect(reviewCardWeek(SUNDAY, MONDAY)).toBeNull()
    expect(reviewCardWeek(NEXT_MONDAY, MONDAY)).toBeNull()
    expect(reviewCardWeek(NEXT_MONDAY, '2026-10-26')).toBe(MONDAY)
    expect(reviewCardWeek('2026-11-10', null)).toBeNull() // Dienstag
    expect(reviewCardWeek('2026-11-07', null)).toBeNull() // Samstag
  })

  it('Offenes kommt in die neue Woche, nie in die Vergangenheit', () => {
    expect(nextReviewWeek(MONDAY, SUNDAY)).toBe(NEXT_MONDAY) // Sonntag: die kommende Woche
    expect(nextReviewWeek(MONDAY, NEXT_MONDAY)).toBe(NEXT_MONDAY) // Montag danach: die laufende
    expect(nextReviewWeek('2026-10-05', SUNDAY)).toBe(NEXT_MONDAY) // alte Woche, heute Sonntag
    expect(nextReviewWeek('2026-10-05', '2026-11-04')).toBe(MONDAY) // alte Woche, mitten in der Woche
  })
})

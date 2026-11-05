import { describe, expect, it } from 'vitest'
import { applyReminder, buildRepeat, nextDateOf, nextInstance, nextOccurrence, offsetOf, parseRepeat, remindersOn, repeatLabel, restingReminders, rulesFor } from './repeat'
import type { RepeatRule, Todo, TodoRepeat } from './types'

// 2026-11-06 ist ein Freitag
const FRIDAY = '2026-11-06'
const repeat = (rule: RepeatRule, from = FRIDAY, reminders: TodoRepeat['reminders'] = []): TodoRepeat => ({ rule, from, reminders })
const todo = (patch: Partial<Todo> = {}): Todo => ({
  id: 'a', title: 'Wäsche', scope: 'tag', date: FRIDAY, reminders: [], done: false, deleted: false, createdAt: 1, updatedAt: 1, ...patch,
})

describe('nächster Termin', () => {
  it('täglich', () => {
    expect(nextOccurrence(repeat('taeglich'), FRIDAY)).toBe('2026-11-07')
    expect(nextOccurrence(repeat('taeglich'), '2026-11-20')).toBe('2026-11-21')
  })

  it('wöchentlich bleibt auf dem Wochentag', () => {
    expect(nextOccurrence(repeat('woechentlich'), FRIDAY)).toBe('2026-11-13')
    expect(nextOccurrence(repeat('woechentlich'), '2026-11-07')).toBe('2026-11-13')
    expect(nextOccurrence(repeat('woechentlich'), '2026-11-12')).toBe('2026-11-13')
    expect(nextOccurrence(repeat('woechentlich'), '2026-11-13')).toBe('2026-11-20')
  })

  it('alle zwei Wochen', () => {
    expect(nextOccurrence(repeat('zweiwoechentlich'), FRIDAY)).toBe('2026-11-20')
    expect(nextOccurrence(repeat('zweiwoechentlich'), '2026-11-13')).toBe('2026-11-20')
    expect(nextOccurrence(repeat('zweiwoechentlich'), '2026-11-20')).toBe('2026-12-04')
  })

  it('monatlich: Der 31. wird im Februar zum 28. und danach wieder zum 31.', () => {
    const r = repeat('monatlich', '2027-01-31')
    expect(nextOccurrence(r, '2027-01-31')).toBe('2027-02-28')
    expect(nextOccurrence(r, '2027-02-28')).toBe('2027-03-31')
    expect(nextOccurrence(r, '2027-03-31')).toBe('2027-04-30')
    expect(nextOccurrence(repeat('monatlich', '2028-01-31'), '2028-01-31')).toBe('2028-02-29') // Schaltjahr
  })

  it('monatlich über den Jahreswechsel', () => {
    expect(nextOccurrence(repeat('monatlich', '2026-11-01'), '2026-12-01')).toBe('2027-01-01')
    expect(nextOccurrence(repeat('monatlich', '2026-11-01'), '2026-12-15')).toBe('2027-01-01')
  })

  it('jährlich, auch vom 29. Februar', () => {
    expect(nextOccurrence(repeat('jaehrlich', '2026-11-06'), '2026-11-06')).toBe('2027-11-06')
    const r = repeat('jaehrlich', '2028-02-29')
    expect(nextOccurrence(r, '2028-02-29')).toBe('2029-02-28')
    expect(nextOccurrence(r, '2031-03-01')).toBe('2032-02-29')
  })

  it('vor dem ersten Termin ist der erste Termin der nächste', () => {
    expect(nextOccurrence(repeat('woechentlich'), '2026-10-01')).toBe(FRIDAY)
  })
})

describe('Termin nach dem Abhaken', () => {
  const weekly = repeat('woechentlich')

  it('früher abgehakt: der nächste reguläre Termin', () => {
    expect(nextDateOf(todo(), weekly, '2026-11-04')).toBe('2026-11-13')
  })

  it('spät abgehakt: überspringt, was inzwischen vorbei ist', () => {
    expect(nextDateOf(todo(), weekly, '2026-11-25')).toBe('2026-11-27')
    expect(nextDateOf(todo(), weekly, '2026-11-27')).toBe('2026-12-04')
  })

  it('Wochenaufgabe: rechnet von der aktuellen Woche aus', () => {
    const t = todo({ scope: 'woche', date: '2026-11-02' })
    const r = repeat('woechentlich', '2026-11-02')
    expect(nextDateOf(t, r, '2026-11-04')).toBe('2026-11-09')
    expect(nextDateOf(t, r, '2026-11-25')).toBe('2026-11-30') // zwei Wochen zu spät
  })
})

describe('Erinnerungen der Reihe', () => {
  it('rechnet relativ zum Termin hin und zurück', () => {
    expect(offsetOf('2026-11-05T18:00', FRIDAY)).toEqual({ days: -1, time: '18:00' })
    expect(applyReminder({ days: -1, time: '18:00' }, '2026-11-13')).toBe('2026-11-12T18:00')
  })

  it('der nächste Termin bekommt alle wieder, auch weggeklickte', () => {
    const r = repeat('woechentlich', FRIDAY, [{ days: 0, time: '08:00' }, { days: 0, time: '18:00' }])
    const next = nextInstance(todo({ reminders: [], repeat: r }), r, FRIDAY, new Date(2026, 10, 6, 19), 'b')
    expect(next.date).toBe('2026-11-13')
    expect(next.reminders).toEqual(['2026-11-13T08:00', '2026-11-13T18:00'])
    expect(next.seriesId).toBe('a')
    expect(next.done).toBe(false)
    expect(next).not.toHaveProperty('doneAt')
  })

  it('der dritte Termin gehört zur selben Reihe', () => {
    const r = repeat('woechentlich')
    const next = nextInstance(todo({ id: 'b', seriesId: 'a', repeat: r }), r, FRIDAY, new Date(2026, 10, 6), 'c')
    expect(next.seriesId).toBe('a')
  })

  it('was am neuen Termin schon vorbei ist, klingelt nicht nachträglich', () => {
    const r = repeat('taeglich', FRIDAY, [{ days: 0, time: '08:00' }, { days: 0, time: '18:00' }])
    expect(remindersOn(r, '2026-11-07', new Date(2026, 10, 7, 12))).toEqual(['2026-11-07T18:00'])
  })

  it('erkennt, was schon geklingelt hat', () => {
    const r = repeat('woechentlich', FRIDAY, [{ days: 0, time: '08:00' }, { days: 0, time: '18:00' }])
    expect(restingReminders(todo({ repeat: r, reminders: [`${FRIDAY}T18:00`] }))).toEqual([{ days: 0, time: '08:00' }])
    expect(restingReminders(todo())).toEqual([])
  })
})

describe('Wiederholung aus dem Blatt', () => {
  const pattern = [{ days: 0, time: '08:00' }, { days: 0, time: '18:00' }]

  it('neu: der Termin ist der Anfang der Reihe', () => {
    const r = buildRepeat('woechentlich', FRIDAY, [`${FRIDAY}T18:00`, '2026-11-05T08:00'], [])
    expect(r).toEqual({ rule: 'woechentlich', from: FRIDAY, reminders: [{ days: -1, time: '08:00' }, { days: 0, time: '18:00' }] })
  })

  it('unverändert: Der Monatstag der Reihe bleibt erhalten', () => {
    const prev = todo({ date: '2027-02-28', repeat: repeat('monatlich', '2027-01-31') })
    expect(buildRepeat('monatlich', '2027-02-28', [], [], prev).from).toBe('2027-01-31')
  })

  it('anderer Tag oder Rhythmus: Die Reihe richtet sich neu aus', () => {
    const prev = todo({ repeat: repeat('woechentlich', '2026-10-30') })
    expect(buildRepeat('woechentlich', '2026-11-07', [], [], prev).from).toBe('2026-11-07')
    expect(buildRepeat('monatlich', FRIDAY, [], [], prev).from).toBe(FRIDAY)
  })

  it('schon Geklingeltes bleibt in der Reihe, ein Schlummern nicht', () => {
    const prev = todo({ repeat: repeat('woechentlich', FRIDAY, pattern), reminders: [`${FRIDAY}T18:00`, `${FRIDAY}T19:12`] })
    const resting = restingReminders(prev)
    expect(resting).toEqual([{ days: 0, time: '08:00' }])
    const r = buildRepeat('woechentlich', FRIDAY, prev.reminders, resting, prev)
    expect(r.reminders).toEqual(pattern)
  })

  it('neu dazugekommene Zeiten zählen für die ganze Reihe, abgewählte fliegen raus', () => {
    const prev = todo({ repeat: repeat('woechentlich', FRIDAY, pattern), reminders: [`${FRIDAY}T08:00`, `${FRIDAY}T18:00`] })
    const r = buildRepeat('woechentlich', FRIDAY, [`${FRIDAY}T18:00`, `${FRIDAY}T20:00`], [], prev)
    expect(r.reminders).toEqual([{ days: 0, time: '18:00' }, { days: 0, time: '20:00' }])
  })
})

describe('Anzeige und Prüfung', () => {
  it('beschriftet die Rhythmen', () => {
    expect(repeatLabel('taeglich', FRIDAY, 'tag')).toBe('Täglich')
    expect(repeatLabel('woechentlich', FRIDAY, 'tag')).toBe('Jeden Fr')
    expect(repeatLabel('woechentlich', '2026-11-02', 'woche')).toBe('Jede Woche')
    expect(repeatLabel('zweiwoechentlich', FRIDAY, 'tag')).toBe('Alle 2 Wochen Fr')
    expect(repeatLabel('zweiwoechentlich', '2026-11-02', 'woche')).toBe('Alle 2 Wochen')
    expect(repeatLabel('monatlich', '2026-12-01', 'tag')).toBe('Jeden 1. im Monat')
    expect(repeatLabel('jaehrlich', FRIDAY, 'tag')).toBe('Jedes Jahr am 6. Nov.')
  })

  it('bietet Wochenaufgaben nur Wochenrhythmen an', () => {
    expect(rulesFor('woche')).toEqual(['woechentlich', 'zweiwoechentlich'])
    expect(rulesFor('tag')).toContain('monatlich')
  })

  it('prüft Daten aus einem Backup', () => {
    expect(parseRepeat({ rule: 'monatlich', from: FRIDAY, reminders: [{ days: 0, time: '18:00' }, { days: 'x', time: '18:00' }, { days: 0, time: 'bald' }, null] }))
      .toEqual({ rule: 'monatlich', from: FRIDAY, reminders: [{ days: 0, time: '18:00' }] })
    expect(parseRepeat({ rule: 'stuendlich', from: FRIDAY })).toBeUndefined()
    expect(parseRepeat({ rule: 'taeglich', from: 'morgen' })).toBeUndefined()
    expect(parseRepeat(undefined)).toBeUndefined()
    expect(parseRepeat({ rule: 'taeglich', from: FRIDAY })).toEqual({ rule: 'taeglich', from: FRIDAY, reminders: [] })
  })
})

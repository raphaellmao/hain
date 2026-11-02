import { describe, expect, it } from 'vitest'
import { buildIcs } from './ics'
import { daysLeftInWeek, groupTodos, isOverdue, isRinging, isUrgent, remindAtFor, remindLabel, toRemindAt, urgentTodos, whenLabel } from './todos'
import type { Todo } from './types'

// 2026-11-04 ist ein Mittwoch, die Woche beginnt am Montag, dem 2. November
const TODAY = '2026-11-04'
const MONDAY = '2026-11-02'

let n = 0
const todo = (patch: Partial<Todo>): Todo => ({
  id: `t${++n}`, title: 'Test', scope: 'tag', date: TODAY, done: false, deleted: false, createdAt: n, updatedAt: n, ...patch,
})

describe('überfällig und dringend', () => {
  it('Tagesaufgaben sind ab dem Folgetag überfällig', () => {
    expect(isOverdue(todo({ date: '2026-11-03' }), TODAY)).toBe(true)
    expect(isOverdue(todo({ date: TODAY }), TODAY)).toBe(false)
    expect(isOverdue(todo({ date: '2026-11-03', done: true }), TODAY)).toBe(false)
  })

  it('Wochenaufgaben sind erst ab der Folgewoche überfällig', () => {
    expect(isOverdue(todo({ scope: 'woche', date: MONDAY }), TODAY)).toBe(false)
    expect(isOverdue(todo({ scope: 'woche', date: MONDAY }), '2026-11-08')).toBe(false)
    expect(isOverdue(todo({ scope: 'woche', date: MONDAY }), '2026-11-09')).toBe(true)
  })

  it('Wochenaufgaben werden am Sonntag dringend', () => {
    const t = todo({ scope: 'woche', date: MONDAY })
    expect(isUrgent(t, TODAY)).toBe(false)
    expect(isUrgent(t, '2026-11-08')).toBe(true)
  })

  it('dringend sind Überfälliges und Heutiges, sortiert nach Termin', () => {
    const list = [
      todo({ title: 'morgen', date: '2026-11-05' }),
      todo({ title: 'heute spät', remindAt: `${TODAY}T18:00` }),
      todo({ title: 'heute früh', remindAt: `${TODAY}T08:00` }),
      todo({ title: 'gestern', date: '2026-11-03' }),
      todo({ title: 'heute ohne Zeit' }),
    ]
    expect(urgentTodos(list, TODAY).map((t) => t.title)).toEqual(['gestern', 'heute früh', 'heute spät', 'heute ohne Zeit'])
  })
})

describe('Abschnitte', () => {
  it('sortiert jedes To-do in genau einen Abschnitt', () => {
    const now = Date.UTC(2026, 10, 4, 12)
    const g = groupTodos(
      [
        todo({ title: 'alt', date: '2026-11-02' }),
        todo({ title: 'letzte Woche', scope: 'woche', date: '2026-10-26' }),
        todo({ title: 'heute' }),
        todo({ title: 'Woche', scope: 'woche', date: MONDAY }),
        todo({ title: 'Freitag', date: '2026-11-06' }),
        todo({ title: 'Sonntag', date: '2026-11-08' }),
        todo({ title: 'Montag', date: '2026-11-09' }),
        todo({ title: 'nächste Woche', scope: 'woche', date: '2026-11-09' }),
        todo({ title: 'erledigt', done: true, doneAt: now - 1000 }),
        todo({ title: 'längst erledigt', done: true, doneAt: now - 8 * 86_400_000 }),
      ],
      TODAY,
      now,
    )
    const titles = (l: Todo[]) => l.map((t) => t.title)
    expect(titles(g.overdue)).toEqual(['letzte Woche', 'alt'])
    expect(titles(g.today)).toEqual(['heute'])
    expect(titles(g.week)).toEqual(['Woche', 'Freitag', 'Sonntag'])
    expect(titles(g.later)).toEqual(['Montag', 'nächste Woche'])
    expect(titles(g.done)).toEqual(['erledigt'])
  })

  it('zählt die restlichen Tage der Woche', () => {
    expect(daysLeftInWeek(MONDAY)).toBe(7)
    expect(daysLeftInWeek('2026-11-08')).toBe(1)
  })
})

describe('Erinnerungen', () => {
  // Monate zählen in Date ab 0: 10 = November
  const at = (h: number, m = 0) => new Date(2026, 10, 4, h, m)

  it('klingelt ab der Uhrzeit, bis sie weggeklickt oder erledigt ist', () => {
    const t = todo({ remindAt: `${TODAY}T18:00` })
    expect(isRinging(t, at(17, 59))).toBe(false)
    expect(isRinging(t, at(18))).toBe(true)
    expect(isRinging(t, new Date(2026, 10, 6, 7))).toBe(true) // auch Tage später noch
    expect(isRinging({ ...t, remindedAt: 1 }, at(19))).toBe(false)
    expect(isRinging({ ...t, done: true }, at(19))).toBe(false)
    expect(isRinging(todo({}), at(19))).toBe(false)
  })

  it('rechnet in Ortszeit', () => {
    expect(toRemindAt(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04')
  })

  it('legt Nachtzeiten vor dem Tageswechsel auf den nächsten Kalendertag', () => {
    expect(remindAtFor(TODAY, '01:30', 3)).toBe('2026-11-05T01:30')
    expect(remindAtFor(TODAY, '03:00', 3)).toBe('2026-11-04T03:00')
    expect(remindAtFor(TODAY, '01:30')).toBe('2026-11-04T01:30')
  })

  it('beschriftet Tage und Zeiten', () => {
    expect(whenLabel({ scope: 'tag', date: TODAY }, TODAY)).toBe('Heute')
    expect(whenLabel({ scope: 'tag', date: '2026-11-05' }, TODAY)).toBe('Morgen')
    expect(whenLabel({ scope: 'tag', date: '2026-11-03' }, TODAY)).toBe('Gestern')
    expect(whenLabel({ scope: 'tag', date: '2026-11-06' }, TODAY)).toBe('Fr, 6. Nov.')
    expect(whenLabel({ scope: 'woche', date: MONDAY }, TODAY)).toBe('Diese Woche')
    expect(whenLabel({ scope: 'woche', date: '2026-11-09' }, TODAY)).toBe('Nächste Woche')
    expect(whenLabel({ scope: 'woche', date: '2026-10-26' }, TODAY)).toBe('Letzte Woche')
    expect(remindLabel(`${TODAY}T18:00`, TODAY)).toBe('18:00')
    expect(remindLabel('2026-11-05T18:00', TODAY)).toBe('Morgen 18:00')
    expect(remindLabel('2026-11-06T18:00', TODAY)).toBe('Fr 18:00')
    expect(remindLabel('2026-12-24T18:00', TODAY)).toBe('24. Dez. 18:00')
  })
})

describe('Kalenderdatei', () => {
  const now = new Date(Date.UTC(2026, 10, 4, 9, 30, 15))
  const unfold = (ics: string) => ics.replace(/\r\n /g, '')

  it('enthält Termin und Alarm zur Uhrzeit, in Ortszeit ohne Zeitzone', () => {
    const ics = buildIcs([{ id: 'abc', title: 'Antrag abgeben', remindAt: '2026-11-04T18:00' }], now)
    const lines = ics.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('UID:abc@hain')
    expect(lines).toContain('DTSTAMP:20261104T093015Z')
    expect(lines).toContain('DTSTART:20261104T180000')
    expect(lines).toContain('DTEND:20261104T181500')
    expect(lines).toContain('SUMMARY:Antrag abgeben')
    expect(lines).toContain('BEGIN:VALARM')
    expect(lines).toContain('TRIGGER:PT0S')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('kommt über Mitternacht und Jahreswechsel', () => {
    const ics = buildIcs([{ id: 'x', title: 'x', remindAt: '2026-12-31T23:50' }], now)
    expect(ics).toContain('DTSTART:20261231T235000')
    expect(ics).toContain('DTEND:20270101T000500')
  })

  it('maskiert Sonderzeichen', () => {
    const ics = buildIcs([{ id: 'x', title: 'Brot, Milch; 2\\3\nmehr', remindAt: '2026-11-04T18:00' }], now)
    expect(ics).toContain('SUMMARY:Brot\\, Milch\\; 2\\\\3\\nmehr')
  })

  it('bricht lange Zeilen nach 75 Bytes um, ohne Zeichen zu zerteilen', () => {
    const title = 'Ärger 🌿 '.repeat(20).trim()
    const ics = buildIcs([{ id: 'x', title, remindAt: '2026-11-04T18:00' }], now)
    const encoder = new TextEncoder()
    for (const line of ics.split('\r\n')) expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    expect(unfold(ics)).toContain(`SUMMARY:${title}`)
  })

  it('schreibt mehrere Termine in eine Datei', () => {
    const ics = buildIcs(
      [
        { id: 'a', title: 'A', remindAt: '2026-11-04T18:00' },
        { id: 'b', title: 'B', remindAt: '2026-11-05T08:00' },
      ],
      now,
    )
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  })
})

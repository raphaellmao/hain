import { describe, expect, it } from 'vitest'
import { buildIcs, calendarItems } from './ics'
import {
  cleanReminders, dayChipLabel, daysLeftInWeek, dueReminders, groupTodos, isOverdue, isUrgent, reminderDays,
  remindAtFor, remindLabel, shiftRemindAt, toRemindAt, urgentTodos, whenLabel, withoutDue,
} from './todos'
import type { Todo } from './types'

// 2026-11-04 ist ein Mittwoch, die Woche beginnt am Montag, dem 2. November
const TODAY = '2026-11-04'
const MONDAY = '2026-11-02'

let n = 0
const todo = (patch: Partial<Todo>): Todo => ({
  id: `t${++n}`, title: 'Test', scope: 'tag', date: TODAY, reminders: [], done: false, deleted: false, createdAt: n, updatedAt: n, ...patch,
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
      todo({ title: 'heute spät', reminders: [`${TODAY}T18:00`, `${TODAY}T20:00`] }),
      todo({ title: 'heute früh', reminders: [`${TODAY}T08:00`, `${TODAY}T22:00`] }),
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
    const t = todo({ reminders: [`${TODAY}T18:00`] })
    expect(dueReminders(t, at(17, 59))).toEqual([])
    expect(dueReminders(t, at(18))).toEqual([`${TODAY}T18:00`])
    expect(dueReminders(t, new Date(2026, 10, 6, 7))).toHaveLength(1) // auch Tage später noch
    expect(dueReminders({ ...t, reminders: [] }, at(19))).toEqual([])
    expect(dueReminders({ ...t, done: true }, at(19))).toEqual([])
  })

  it('kennt bei mehreren Erinnerungen die fälligen und die noch kommenden', () => {
    const reminders = [`${TODAY}T08:00`, `${TODAY}T12:00`, `${TODAY}T18:00`]
    const t = todo({ reminders })
    expect(dueReminders(t, at(7))).toEqual([])
    expect(dueReminders(t, at(12))).toEqual([`${TODAY}T08:00`, `${TODAY}T12:00`])
    expect(withoutDue(reminders, at(12))).toEqual([`${TODAY}T18:00`])
    expect(withoutDue(reminders, at(19))).toEqual([])
  })

  it('räumt Listen auf: gültig, einmalig, sortiert', () => {
    expect(cleanReminders(['2026-11-05T08:00', 'bald', 7, '2026-11-04T18:00', '2026-11-05T08:00'])).toEqual(['2026-11-04T18:00', '2026-11-05T08:00'])
  })

  it('verschiebt eine Erinnerung um ganze Tage und behält die Uhrzeit', () => {
    expect(shiftRemindAt('2026-12-31T18:00', 1)).toBe('2027-01-01T18:00')
    expect(shiftRemindAt('2026-11-04T08:30', -3)).toBe('2026-11-01T08:30')
  })

  it('bietet passende Tage an, ohne Vergangenes', () => {
    // Wochenaufgabe: ab heute bis Sonntag
    expect(reminderDays('woche', MONDAY, TODAY)).toEqual(['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
    // nächste Woche: alle sieben
    expect(reminderDays('woche', '2026-11-09', TODAY)).toHaveLength(7)
    // Tagesaufgabe am Freitag: von heute bis zum Termin
    expect(reminderDays('tag', '2026-11-06', TODAY)).toEqual(['2026-11-04', '2026-11-05', '2026-11-06'])
    // weit weg: die sieben Tage davor
    expect(reminderDays('tag', '2026-12-24', TODAY)[0]).toBe('2026-12-18')
    expect(reminderDays('tag', '2026-12-24', TODAY)).toHaveLength(7)
    // heute oder überfällig: nur heute
    expect(reminderDays('tag', TODAY, TODAY)).toEqual([TODAY])
    expect(reminderDays('tag', '2026-11-01', TODAY)).toEqual([TODAY])
    expect(reminderDays('woche', '2026-10-26', TODAY)).toEqual([TODAY])
  })

  it('beschriftet die Tage der Auswahl', () => {
    expect(dayChipLabel(TODAY, TODAY)).toBe('Heute')
    expect(dayChipLabel('2026-11-05', TODAY)).toBe('Morgen')
    expect(dayChipLabel('2026-11-06', TODAY)).toBe('Fr 6.')
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
    expect(remindLabel('2026-11-03T18:00', TODAY)).toBe('Gestern 18:00')
    expect(remindLabel('2026-11-05T18:00', TODAY)).toBe('Morgen 18:00')
    expect(remindLabel('2026-11-06T18:00', TODAY)).toBe('Fr 18:00')
    expect(remindLabel('2026-12-24T18:00', TODAY)).toBe('24. Dez. 18:00')
    // Steht schon ein Tag davor, gilt die blanke Uhrzeit für diesen Tag, nicht für heute
    expect(remindLabel('2026-11-05T08:00', TODAY, '2026-11-05')).toBe('08:00')
    expect(remindLabel(`${TODAY}T23:45`, TODAY, '2026-11-05')).toBe('Heute 23:45')
    // Ohne Bezugstag immer mit Tag
    expect(remindLabel(`${TODAY}T18:00`, TODAY, null)).toBe('Heute 18:00')
  })
})

describe('Kalenderdatei', () => {
  const now = new Date(Date.UTC(2026, 10, 4, 9, 30, 15))
  const unfold = (ics: string) => ics.replace(/\r\n /g, '')

  it('enthält Termin und Alarm zur Uhrzeit, in Ortszeit ohne Zeitzone', () => {
    const ics = buildIcs([{ id: 'abc', title: 'Antrag abgeben', at: '2026-11-04T18:00' }], now)
    const lines = ics.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('UID:abc-20261104T180000@hain')
    expect(lines).toContain('DTSTAMP:20261104T093015Z')
    expect(lines).toContain('DTSTART:20261104T180000')
    expect(lines).toContain('DTEND:20261104T181500')
    expect(lines).toContain('SUMMARY:Antrag abgeben')
    expect(lines).toContain('BEGIN:VALARM')
    expect(lines).toContain('TRIGGER:PT0S')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('kommt über Mitternacht und Jahreswechsel', () => {
    const ics = buildIcs([{ id: 'x', title: 'x', at: '2026-12-31T23:50' }], now)
    expect(ics).toContain('DTSTART:20261231T235000')
    expect(ics).toContain('DTEND:20270101T000500')
  })

  it('maskiert Sonderzeichen', () => {
    const ics = buildIcs([{ id: 'x', title: 'Brot, Milch; 2\\3\nmehr', at: '2026-11-04T18:00' }], now)
    expect(ics).toContain('SUMMARY:Brot\\, Milch\\; 2\\\\3\\nmehr')
  })

  it('bricht lange Zeilen nach 75 Bytes um, ohne Zeichen zu zerteilen', () => {
    const title = 'Ärger 🌿 '.repeat(20).trim()
    const ics = buildIcs([{ id: 'x', title, at: '2026-11-04T18:00' }], now)
    const encoder = new TextEncoder()
    for (const line of ics.split('\r\n')) expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    expect(unfold(ics)).toContain(`SUMMARY:${title}`)
  })

  it('macht aus jeder künftigen Erinnerung einen eigenen Termin', () => {
    const items = calendarItems(
      [
        todo({ id: 'a', title: 'A', reminders: ['2026-11-04T08:00', '2026-11-04T18:00', '2026-11-05T08:00'] }),
        todo({ id: 'b', title: 'B', reminders: ['2026-11-05T08:00'] }),
        todo({ id: 'c', title: 'erledigt', reminders: ['2026-11-05T08:00'], done: true }),
        todo({ id: 'd', title: 'ohne' }),
      ],
      new Date(2026, 10, 4, 12),
    )
    expect(items.map((i) => `${i.id} ${i.at}`)).toEqual(['a 2026-11-04T18:00', 'a 2026-11-05T08:00', 'b 2026-11-05T08:00'])
    const ics = buildIcs(items, now)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    // Jeder Termin braucht eine eigene Kennung, sonst überschreiben sie sich im Kalender
    const uids = ics.split('\r\n').filter((l) => l.startsWith('UID:'))
    expect(new Set(uids).size).toBe(3)
  })
})

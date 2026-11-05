import { describe, expect, it } from 'vitest'
import { BackupError, parseBackup } from './backup'

const valid = {
  app: 'hain',
  version: 1,
  exportedAt: '2026-10-19T08:00:00.000Z',
  settings: { dayStartHour: 3 },
  habits: [
    {
      id: 'h1', name: 'Lesen', emoji: '📖', color: 'blau', seed: 42, order: 1, startDate: '2026-10-01',
      schedule: [{ from: '2026-10-10', days: [1, 3] }, { from: '2026-10-01', days: [0, 1, 2, 3, 4, 5, 6] }],
      deleted: false, createdAt: 1, updatedAt: 2,
    },
  ],
  checkins: [
    { id: 'h1_2026-10-01', habitId: 'h1', date: '2026-10-01', done: true, updatedAt: 3 },
    { id: 'x_2026-10-01', habitId: 'gibt-es-nicht', date: '2026-10-01', done: true, updatedAt: 3 },
    { habitId: 'h1', date: 'kaputt', done: true },
  ],
}

describe('parseBackup', () => {
  it('liest ein gültiges Backup und räumt auf', () => {
    const b = parseBackup(JSON.stringify(valid))
    expect(b.habits).toHaveLength(1)
    expect(b.habits[0].schedule.map((v) => v.from)).toEqual(['2026-10-01', '2026-10-10']) // sortiert
    expect(b.checkins).toHaveLength(1) // verwaiste und kaputte Einträge fliegen raus
    expect(b.settings.dayStartHour).toBe(3)
  })

  it('liest alte Backups ohne Notizen', () => {
    expect(parseBackup(JSON.stringify(valid)).dayEntries).toEqual([])
  })

  it('übernimmt Notizen und räumt auf', () => {
    const b = parseBackup(
      JSON.stringify({
        ...valid,
        version: 2,
        dayEntries: [
          { id: '2026-10-01', date: '2026-10-01', note: 'Guter Tag', updatedAt: 5 },
          { date: '2026-10-01', note: 'doppelt' },
          { date: '2026-10-02', note: '   ' },
          { date: 'kaputt', note: 'x' },
          { date: '2026-10-03', note: 42 },
        ],
      }),
    )
    expect(b.dayEntries).toEqual([{ id: '2026-10-01', date: '2026-10-01', note: 'Guter Tag', updatedAt: 5 }])
  })

  it('ersetzt unbekannte Farben', () => {
    const b = parseBackup(JSON.stringify({ ...valid, habits: [{ ...valid.habits[0], color: 'neon' }] }))
    expect(b.habits[0].color).toBe('koralle')
  })

  it('lehnt fremde, neuere oder beschädigte Dateien ab', () => {
    expect(() => parseBackup('kein json')).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ ...valid, app: 'andere' }))).toThrow(/kein Hain-Backup/)
    expect(() => parseBackup(JSON.stringify({ ...valid, version: 99 }))).toThrow(/neueren/)
    expect(() => parseBackup(JSON.stringify({ ...valid, habits: [{ id: 'h1' }] }))).toThrow(/beschädigt/)
  })
})

describe('Backup mit To-dos', () => {
  it('liest alte Backups ohne To-dos', () => {
    expect(parseBackup(JSON.stringify(valid)).todos).toEqual([])
  })

  it('übernimmt To-dos und räumt auf', () => {
    const b = parseBackup(
      JSON.stringify({
        ...valid,
        version: 4,
        todos: [
          { id: 'a', title: 'Antrag', scope: 'tag', date: '2026-11-04', reminders: ['2026-11-04T18:00', '2026-11-04T08:00', '2026-11-04T08:00', 'bald'], done: false, deleted: false, createdAt: 1, updatedAt: 2 },
          { id: 'b', title: 'Woche', scope: 'woche', date: '2026-11-04', done: true, doneAt: 9, createdAt: 1, updatedAt: 2 },
          { id: 'a', title: 'doppelt', scope: 'tag', date: '2026-11-04' },
          { id: 'c', title: '   ', scope: 'tag', date: '2026-11-04' },
          { id: 'd', title: 'kaputt', scope: 'monat', date: '2026-11-04' },
          { id: 'e', title: 'kaputt', scope: 'tag', date: 'morgen' },
          { id: 'f', title: 'Ohne Erinnerung', scope: 'tag', date: '2026-11-04' },
        ],
      }),
    )
    expect(b.todos.map((t) => t.id)).toEqual(['a', 'b', 'f'])
    expect(b.todos[0]).toMatchObject({ reminders: ['2026-11-04T08:00', '2026-11-04T18:00'], done: false }) // sortiert, ohne Doppelte
    expect(b.todos[1]).toMatchObject({ date: '2026-11-02', done: true, doneAt: 9 }) // Woche beginnt am Montag
    expect(b.todos[2].reminders).toEqual([])
  })

  it('übernimmt Wiederholungen', () => {
    const base = { scope: 'tag', date: '2026-11-06' }
    const b = parseBackup(
      JSON.stringify({
        ...valid,
        version: 5,
        todos: [
          { ...base, id: 'a', title: 'x', seriesId: 'r', repeat: { rule: 'woechentlich', from: '2026-10-30', reminders: [{ days: 0, time: '18:00' }] } },
          { ...base, id: 'b', title: 'x', repeat: { rule: 'stuendlich', from: '2026-10-30' } },
        ],
      }),
    )
    expect(b.todos[0]).toMatchObject({ seriesId: 'r', repeat: { rule: 'woechentlich', from: '2026-10-30', reminders: [{ days: 0, time: '18:00' }] } })
    expect(b.todos[1]).not.toHaveProperty('repeat')
  })

  it('übernimmt die einzelne Erinnerung aus Format 3', () => {
    const base = { scope: 'tag', date: '2026-11-04' }
    const b = parseBackup(
      JSON.stringify({
        ...valid,
        version: 3,
        todos: [
          { ...base, id: 'offen', title: 'x', remindAt: '2026-11-04T18:00' },
          { ...base, id: 'weggeklickt', title: 'x', remindAt: '2026-11-04T18:00', remindedAt: 5 },
          { ...base, id: 'kaputt', title: 'x', remindAt: 'bald' },
        ],
      }),
    )
    expect(b.todos.map((t) => t.reminders)).toEqual([['2026-11-04T18:00'], [], []])
    expect(b.todos[0]).not.toHaveProperty('remindAt')
  })
})

describe('Backup mit Ausnahmetagen', () => {
  it('übernimmt ausgesetzte Tage samt Grund', () => {
    const b = parseBackup(
      JSON.stringify({
        ...valid,
        checkins: [
          { habitId: 'h1', date: '2026-10-02', done: false, excused: true, reason: 'krank', reasonNote: 'Grippe' },
          { habitId: 'h1', date: '2026-10-03', done: false, excused: true, reason: 'quatsch' },
        ],
      }),
    )
    expect(b.checkins[0]).toMatchObject({ done: false, excused: true, reason: 'krank', reasonNote: 'Grippe' })
    expect(b.checkins[1]).toMatchObject({ excused: true, reason: 'sonst' })
  })
})

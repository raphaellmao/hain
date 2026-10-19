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

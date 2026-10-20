/**
 * Backup als JSON-Datei. Da alles nur auf dem Gerät liegt, ist das die
 * einzige Absicherung gegen Handyverlust oder einen gelöschten Browser-
 * speicher. Das Format ist versioniert, damit spätere Versionen alte
 * Backups noch lesen können.
 */
import { db } from './schema'
import { COLORS } from '../domain/colors'
import { isSpecies } from '../domain/species'
import { type Checkin, type DayEntry, type Habit, type Settings, DEFAULT_SETTINGS } from '../domain/types'
import { NOTE_MAX_LENGTH } from './repo'
import { toDateStr } from '../domain/dates'

/** 1 = Habits + Abhakungen · 2 = zusätzlich Notizen pro Tag */
export const BACKUP_VERSION = 2

export interface BackupFile {
  app: 'hain'
  version: number
  exportedAt: string
  settings: Settings
  habits: Habit[]
  checkins: Checkin[]
  dayEntries: DayEntry[]
}

export async function createBackup(): Promise<BackupFile> {
  const habits = (await db.habits.toArray()).filter((h) => !h.deleted)
  const ids = new Set(habits.map((h) => h.id))
  const checkins = (await db.checkins.toArray()).filter((c) => c.done && ids.has(c.habitId))
  const dayEntries = (await db.dayEntries.toArray()).filter((e) => e.note !== '')
  const settings = { ...DEFAULT_SETTINGS, ...((await db.meta.get('settings'))?.value as Partial<Settings>) }
  return { app: 'hain', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), settings, habits, checkins, dayEntries }
}

/** Backup speichern: auf dem Handy über das Teilen-Menü („In Dateien sichern“), sonst als Download. */
export async function exportBackup(): Promise<void> {
  const backup = await createBackup()
  const name = `hain-backup-${toDateStr(new Date())}.json`
  const file = new File([JSON.stringify(backup, null, 1)], name, { type: 'application/json' })

  const touch = window.matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Hain-Backup' })
    } catch (e) {
      // Abbrechen im Teilen-Menü ist kein Fehler, zählt aber nicht als Backup
      if ((e as DOMException).name === 'AbortError') return
      throw e
    }
  } else {
    const url = URL.createObjectURL(file)
    const a = Object.assign(document.createElement('a'), { href: url, download: name })
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  await db.meta.put({ key: 'lastBackupAt', value: Date.now() })
}

// ── Einlesen & prüfen ───────────────────────────────────────────────────────

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (v: unknown): v is string => typeof v === 'string' && DATE.test(v)
const isDays = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)

export class BackupError extends Error {}

/** Prüft eine Backup-Datei gründlich – kaputte Daten sollen nie in die Datenbank. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('Die Datei ist kein gültiges JSON.')
  }
  const b = raw as Partial<BackupFile>
  if (!b || b.app !== 'hain') throw new BackupError('Das ist kein Hain-Backup.')
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError('Dieses Backup stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.')
  }
  if (!Array.isArray(b.habits) || !Array.isArray(b.checkins)) throw new BackupError('Im Backup fehlen Daten.')

  const now = Date.now()
  const habits: Habit[] = b.habits.map((h, i) => {
    const ok =
      h && typeof h.id === 'string' && typeof h.name === 'string' && typeof h.emoji === 'string' &&
      isDate(h.startDate) && typeof h.seed === 'number' && Array.isArray(h.schedule) && h.schedule.length > 0 &&
      h.schedule.every((v) => v && isDate(v.from) && isDays(v.days))
    if (!ok) throw new BackupError(`Gewohnheit Nr. ${i + 1} im Backup ist beschädigt.`)
    return {
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      color: h.color in COLORS ? h.color : 'koralle',
      schedule: [...h.schedule].sort((a, c) => a.from.localeCompare(c.from)),
      startDate: h.startDate,
      seed: h.seed,
      ...(isSpecies(h.species) ? { species: h.species } : {}),
      ...(h.metaphor === 'schatten' || h.metaphor === 'pflanze' ? { metaphor: h.metaphor } : {}),
      order: typeof h.order === 'number' ? h.order : i + 1,
      deleted: false,
      createdAt: typeof h.createdAt === 'number' ? h.createdAt : now,
      updatedAt: typeof h.updatedAt === 'number' ? h.updatedAt : now,
    }
  })

  const ids = new Set(habits.map((h) => h.id))
  const checkins: Checkin[] = []
  for (const c of b.checkins) {
    if (!c || typeof c.habitId !== 'string' || !isDate(c.date) || !ids.has(c.habitId)) continue
    checkins.push({
      id: `${c.habitId}_${c.date}`,
      habitId: c.habitId,
      date: c.date,
      done: c.done !== false,
      updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : now,
    })
  }

  // Notizen gibt es erst ab Backup-Version 2 – ältere Backups haben keine
  const dayEntries: DayEntry[] = []
  const seen = new Set<string>()
  for (const e of Array.isArray(b.dayEntries) ? b.dayEntries : []) {
    if (!e || !isDate(e.date) || seen.has(e.date)) continue
    const note = typeof e.note === 'string' ? e.note.slice(0, NOTE_MAX_LENGTH) : ''
    if (note.trim() === '') continue
    seen.add(e.date)
    dayEntries.push({
      id: e.date,
      date: e.date,
      note,
      updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : now,
    })
  }

  const hour = b.settings?.dayStartHour
  const settings: Settings = { dayStartHour: Number.isInteger(hour) && hour! >= 0 && hour! <= 4 ? hour! : 0 }

  return { app: 'hain', version: b.version, exportedAt: String(b.exportedAt ?? ''), settings, habits, checkins, dayEntries }
}

/** Ersetzt ALLE vorhandenen Daten durch das Backup (in einer Transaktion: ganz oder gar nicht). */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', [db.habits, db.checkins, db.dayEntries, db.meta], async () => {
    await db.habits.clear()
    await db.checkins.clear()
    await db.dayEntries.clear()
    await db.habits.bulkAdd(backup.habits)
    await db.checkins.bulkPut(backup.checkins)
    await db.dayEntries.bulkPut(backup.dayEntries)
    await db.meta.put({ key: 'settings', value: backup.settings })
  })
}

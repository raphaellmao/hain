import Dexie, { type EntityTable } from 'dexie'
import type { Checkin, Habit } from '../domain/types'

/** Schlüssel-Wert-Ablage für Einstellungen und Kleinkram (z. B. letztes Backup). */
export interface MetaEntry {
  key: string
  value: unknown
}

/**
 * Die lokale Datenbank (IndexedDB über Dexie).
 *
 * Schema-Änderungen später IMMER als neue Version anhängen, nie die alte
 * ändern – Dexie migriert dann vorhandene Daten automatisch. Beispiel für
 * Notizen/Stimmung pro Tag:
 *
 *   this.version(2).stores({ dayEntries: 'id, date, updatedAt' })
 *
 * In `stores` stehen nur die Felder, nach denen gesucht/sortiert wird
 * (Indizes) – gespeichert werden trotzdem alle Felder der Objekte.
 */
class HainDB extends Dexie {
  habits!: EntityTable<Habit, 'id'>
  checkins!: EntityTable<Checkin, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor() {
    super('hain')
    this.version(1).stores({
      habits: 'id, order, updatedAt',
      checkins: 'id, habitId, date, updatedAt',
      meta: 'key',
    })
  }
}

export const db = new HainDB()

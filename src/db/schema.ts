import Dexie, { type EntityTable } from 'dexie'
import type { Checkin, DayEntry, Habit, Todo } from '../domain/types'

/** Schlüssel-Wert-Ablage für Einstellungen und Kleinkram (z. B. letztes Backup). */
export interface MetaEntry {
  key: string
  value: unknown
}

/**
 * Die lokale Datenbank (IndexedDB über Dexie).
 *
 * Schema-Änderungen später IMMER als neue Version anhängen, nie die alte
 * ändern – Dexie migriert dann vorhandene Daten automatisch. In einer neuen
 * Version stehen nur die Tabellen, die neu sind oder sich ändern.
 *
 * In `stores` stehen nur die Felder, nach denen gesucht/sortiert wird
 * (Indizes) – gespeichert werden trotzdem alle Felder der Objekte.
 */
class HainDB extends Dexie {
  habits!: EntityTable<Habit, 'id'>
  checkins!: EntityTable<Checkin, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>
  dayEntries!: EntityTable<DayEntry, 'id'>
  todos!: EntityTable<Todo, 'id'>

  constructor() {
    super('hain')
    this.version(1).stores({
      habits: 'id, order, updatedAt',
      checkins: 'id, habitId, date, updatedAt',
      meta: 'key',
    })
    // Notizen pro Tag
    this.version(2).stores({
      dayEntries: 'id, date, updatedAt',
    })
    // To-dos für Tag und Woche
    this.version(3).stores({
      todos: 'id, date, updatedAt',
    })
    // Mehrere Erinnerungen pro To-do statt einer: Offene bleiben, weggeklickte waren erledigt
    this.version(4)
      .stores({
        todos: 'id, date, updatedAt',
      })
      .upgrade((tx) =>
        tx
          .table('todos')
          .toCollection()
          .modify((t) => {
            t.reminders = t.remindAt && !t.remindedAt ? [t.remindAt] : []
            delete t.remindAt
            delete t.remindedAt
          }),
      )
  }
}

export const db = new HainDB()

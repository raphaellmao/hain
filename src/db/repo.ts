/**
 * Alle Schreibzugriffe auf die Datenbank an einer Stelle.
 * Die Oberfläche ruft nur diese Funktionen auf – wird später ein Sync
 * (z. B. Supabase) ergänzt, hängt er sich hier ein.
 */
import { db } from './schema'
import type { DateStr } from '../domain/dates'
import type { ColorKey } from '../domain/colors'
import type { SpeciesKey } from '../domain/species'
import type { ExcuseReason } from '../domain/excuse'
import { type Checkin, type DayEntry, type Habit, type Metaphor, type Settings, DEFAULT_SETTINGS } from '../domain/types'
import { daysAt, withNewDays } from '../domain/schedule'

export interface HabitInput {
  name: string
  emoji: string
  color: ColorKey
  days: number[]
  startDate: DateStr
  seed: number
  species: SpeciesKey
  metaphor: Metaphor
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31)

export async function createHabit(input: HabitInput): Promise<string> {
  const now = Date.now()
  const last = await db.habits.orderBy('order').last()
  const habit: Habit = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    emoji: input.emoji,
    color: input.color,
    schedule: [{ from: input.startDate, days: [...input.days].sort((a, b) => a - b) }],
    startDate: input.startDate,
    seed: input.seed,
    species: input.species,
    metaphor: input.metaphor,
    order: (last?.order ?? 0) + 1,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.habits.add(habit)
  return habit.id
}

/**
 * Habit ändern. Geänderte Wochentage gelten ab `today` (die Vergangenheit
 * bleibt, wie sie war). Wird das Startdatum vorverlegt, gilt der erste
 * Häufigkeits-Eintrag ab dem neuen Start.
 */
export async function updateHabit(id: string, input: HabitInput, today: DateStr): Promise<void> {
  const habit = await db.habits.get(id)
  if (!habit) return
  const changed = withNewDays(habit.schedule, input.days, today)
  // Der erste Eintrag beginnt immer am (evtl. verschobenen) Startdatum,
  // spätere Einträge bleiben erhalten.
  const schedule = [
    { from: input.startDate, days: daysAt(changed, input.startDate) },
    ...changed.filter((v) => v.from > input.startDate),
  ]

  await db.habits.update(id, {
    name: input.name.trim(),
    emoji: input.emoji,
    color: input.color,
    seed: input.seed,
    species: input.species,
    metaphor: input.metaphor,
    startDate: input.startDate,
    schedule,
    updatedAt: Date.now(),
  })
}

/** Weiches Löschen: Das Habit verschwindet aus der App, bleibt aber als Grabstein. */
export async function deleteHabit(id: string): Promise<void> {
  await db.habits.update(id, { deleted: true, updatedAt: Date.now() })
}

/** Erledigt setzen bzw. zurücknehmen. Überschreibt eine evtl. Ausnahme des Tages. */
export async function setCheckin(habitId: string, date: DateStr, done: boolean): Promise<void> {
  const checkin: Checkin = { id: `${habitId}_${date}`, habitId, date, done, updatedAt: Date.now() }
  await db.checkins.put(checkin)
}

/** „Heute nicht möglich“: Tag aussetzen, mit Grund und optionaler Notiz. */
export async function setExcused(habitId: string, date: DateStr, reason: ExcuseReason, note?: string): Promise<void> {
  const text = note?.trim().slice(0, 140)
  const checkin: Checkin = {
    id: `${habitId}_${date}`, habitId, date, done: false, excused: true, reason,
    ...(text ? { reasonNote: text } : {}),
    updatedAt: Date.now(),
  }
  await db.checkins.put(checkin)
}

// ── Notizen pro Tag ─────────────────────────────────────────────────────────

export const NOTE_MAX_LENGTH = 2000

/** Notiz eines Tages speichern. Leerer Text bleibt als Eintrag mit note: '' liegen (für späteren Sync). */
export async function setDayNote(date: DateStr, note: string): Promise<void> {
  const text = note.trimEnd().slice(0, NOTE_MAX_LENGTH)
  const current = await db.dayEntries.get(date)
  if ((current?.note ?? '') === text) return
  const entry: DayEntry = { id: date, date, note: text, updatedAt: Date.now() }
  await db.dayEntries.put(entry)
}

// ── Einstellungen ───────────────────────────────────────────────────────────

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = ((await db.meta.get('settings'))?.value as Settings | undefined) ?? DEFAULT_SETTINGS
  await db.meta.put({ key: 'settings', value: { ...current, ...patch } })
}

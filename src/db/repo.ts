/**
 * Alle Schreibzugriffe auf die Datenbank an einer Stelle.
 * Die Oberfläche ruft nur diese Funktionen auf – wird später ein Sync
 * (z. B. Supabase) ergänzt, hängt er sich hier ein.
 */
import { db } from './schema'
import type { DateStr } from '../domain/dates'
import type { ColorKey } from '../domain/colors'
import { type Checkin, type Habit, type Settings, DEFAULT_SETTINGS } from '../domain/types'
import { daysAt, withNewDays } from '../domain/schedule'

export interface HabitInput {
  name: string
  emoji: string
  color: ColorKey
  days: number[]
  startDate: DateStr
  seed: number
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
    startDate: input.startDate,
    schedule,
    updatedAt: Date.now(),
  })
}

/** Weiches Löschen: Das Habit verschwindet aus der App, bleibt aber als Grabstein. */
export async function deleteHabit(id: string): Promise<void> {
  await db.habits.update(id, { deleted: true, updatedAt: Date.now() })
}

export async function setCheckin(habitId: string, date: DateStr, done: boolean): Promise<void> {
  const checkin: Checkin = { id: `${habitId}_${date}`, habitId, date, done, updatedAt: Date.now() }
  await db.checkins.put(checkin)
}

// ── Einstellungen ───────────────────────────────────────────────────────────

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = ((await db.meta.get('settings'))?.value as Settings | undefined) ?? DEFAULT_SETTINGS
  await db.meta.put({ key: 'settings', value: { ...current, ...patch } })
}

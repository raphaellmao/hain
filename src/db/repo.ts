/**
 * Alle Schreibzugriffe auf die Datenbank an einer Stelle.
 * Die Oberfläche ruft nur diese Funktionen auf – wird später ein Sync
 * (z. B. Supabase) ergänzt, hängt er sich hier ein.
 */
import { db } from './schema'
import { addDays, type DateStr } from '../domain/dates'
import type { ColorKey } from '../domain/colors'
import type { SpeciesKey } from '../domain/species'
import type { ExcuseReason } from '../domain/excuse'
import { nextDateOf, nextInstance, nextOccurrence, remindersOn } from '../domain/repeat'
import { type Checkin, type DayEntry, type Habit, type Metaphor, type Settings, type Todo, type TodoRepeat, type TodoScope, DEFAULT_SETTINGS } from '../domain/types'
import { daysAt, withNewDays } from '../domain/schedule'
import { cleanReminders, withoutDue } from '../domain/todos'

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

// ── To-dos ──────────────────────────────────────────────────────────────────

export const TODO_MAX_LENGTH = 200

export interface TodoInput {
  title: string
  scope: TodoScope
  date: DateStr
  reminders: string[]
  repeat?: TodoRepeat
}

export async function createTodo(id: string, input: TodoInput): Promise<void> {
  const now = Date.now()
  const todo: Todo = {
    id,
    title: input.title.trim().slice(0, TODO_MAX_LENGTH),
    scope: input.scope,
    date: input.date,
    reminders: cleanReminders(input.reminders),
    ...(input.repeat ? { repeat: input.repeat } : {}),
    done: false,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.todos.add(todo)
}

export async function updateTodo(id: string, input: TodoInput): Promise<void> {
  await db.todos.update(id, {
    title: input.title.trim().slice(0, TODO_MAX_LENGTH),
    scope: input.scope,
    date: input.date,
    reminders: cleanReminders(input.reminders),
    repeat: input.repeat,
    updatedAt: Date.now(),
  })
}

/**
 * Abhaken oder zurücknehmen. Bei einer Reihe entsteht beim Abhaken der nächste
 * Termin (wird zurückgegeben), beim Zurücknehmen verschwindet er wieder: Eine
 * Reihe hat immer genau einen offenen Termin.
 */
export async function setTodoDone(id: string, done: boolean, today: DateStr): Promise<Todo | null> {
  return db.transaction('rw', db.todos, async () => {
    const todo = await db.todos.get(id)
    if (!todo || todo.done === done) return null
    const now = new Date()
    const stamp = now.getTime()
    await db.todos.update(id, { done, doneAt: done ? stamp : undefined, updatedAt: stamp })
    if (!todo.repeat) return null
    if (done) {
      const next = nextInstance(todo, todo.repeat, today, now, crypto.randomUUID())
      await db.todos.add(next)
      return next
    }
    const series = todo.seriesId ?? todo.id
    await db.todos
      .filter((t) => t.id !== id && !t.done && !t.deleted && (t.seriesId === series || t.id === series))
      .modify({ deleted: true, updatedAt: stamp })
    return null
  })
}

/** Diesen Termin einer Reihe auslassen: Das To-do springt zum nächsten, ohne als erledigt zu zählen. */
export async function skipTodo(id: string, today: DateStr): Promise<DateStr | null> {
  const todo = await db.todos.get(id)
  if (!todo?.repeat) return null
  const date = nextDateOf(todo, todo.repeat, today)
  await db.todos.update(id, { date, reminders: remindersOn(todo.repeat, date, new Date()), updatedAt: Date.now() })
  return date
}

/** Weiches Löschen, wie bei den Habits. */
export async function deleteTodo(id: string): Promise<void> {
  await db.todos.update(id, { deleted: true, updatedAt: Date.now() })
}

/** Fällige Erinnerungen wegklicken: Das To-do bleibt offen, spätere Erinnerungen bleiben stehen. */
export async function dismissDueReminders(id: string): Promise<void> {
  const todo = await db.todos.get(id)
  if (!todo) return
  await db.todos.update(id, { reminders: withoutDue(todo.reminders, new Date()), updatedAt: Date.now() })
}

/** Später nochmal erinnern: Die fälligen Erinnerungen werden durch eine neue ersetzt. */
export async function snoozeDueReminders(id: string, remindAt: string): Promise<void> {
  const todo = await db.todos.get(id)
  if (!todo) return
  await db.todos.update(id, { reminders: cleanReminders([...withoutDue(todo.reminders, new Date()), remindAt]), updatedAt: Date.now() })
}

/** Überfälliges nach vorn holen: Tagesaufgaben auf heute, Wochenaufgaben auf diese Woche. */
export async function moveTodosToNow(todos: Todo[], today: DateStr, monday: DateStr): Promise<void> {
  const now = Date.now()
  await db.todos.bulkPut(todos.map((t) => ({ ...t, date: t.scope === 'tag' ? today : monday, updatedAt: now })))
}

/**
 * Offenes aus dem Wochenrückblick in eine neue Woche legen: Einmalige To-dos
 * werden Wochenaufgaben, eine Reihe springt auf ihren ersten Termin in dieser Woche.
 */
export async function moveTodosToWeek(todos: Todo[], monday: DateStr): Promise<void> {
  const now = new Date()
  const stamp = now.getTime()
  await db.todos.bulkPut(
    todos.map((t) => {
      if (!t.repeat) return { ...t, scope: 'woche' as const, date: monday, updatedAt: stamp }
      const date = t.scope === 'woche' ? monday : nextOccurrence(t.repeat, addDays(monday, -1))
      return { ...t, date, reminders: remindersOn(t.repeat, date, now), updatedAt: stamp }
    }),
  )
}

// ── Einstellungen ───────────────────────────────────────────────────────────

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = ((await db.meta.get('settings'))?.value as Settings | undefined) ?? DEFAULT_SETTINGS
  await db.meta.put({ key: 'settings', value: { ...current, ...patch } })
}

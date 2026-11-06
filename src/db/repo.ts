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
import { endedEarly } from '../domain/absence'
import { type Absence, type Checkin, type DayEntry, type Habit, type HabitGoal, type Metaphor, type Settings, type Todo, type TodoRepeat, type TodoScope, DEFAULT_SETTINGS } from '../domain/types'
import { reached, roundAmount } from '../domain/goal'
import { archivedSchedule, daysAt, restoredSchedule, withNewDays } from '../domain/schedule'
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
  goal?: HabitGoal
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
    ...(input.goal ? { goal: input.goal } : {}),
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
    goal: input.goal,
    startDate: input.startDate,
    schedule,
    updatedAt: Date.now(),
  })
}

/** Weiches Löschen: Das Habit verschwindet aus der App, bleibt aber als Grabstein. */
export async function deleteHabit(id: string): Promise<void> {
  await db.habits.update(id, { deleted: true, updatedAt: Date.now() })
}

/** Ins Archiv legen: aus „Heute“ und dem Garten weg, ab heute nicht mehr fällig, nichts welkt. */
export async function archiveHabit(id: string, today: DateStr): Promise<void> {
  const habit = await db.habits.get(id)
  if (!habit || habit.archived) return
  await db.habits.update(id, {
    archived: { since: today, days: daysAt(habit.schedule, today) },
    schedule: archivedSchedule(habit.schedule, today),
    updatedAt: Date.now(),
  })
}

/** Aus dem Archiv zurückholen: ab heute wieder an den alten Tagen fällig, ans Ende der Liste. */
export async function unarchiveHabit(id: string, today: DateStr): Promise<void> {
  const habit = await db.habits.get(id)
  if (!habit?.archived) return
  const last = await db.habits.orderBy('order').last()
  await db.habits.update(id, {
    archived: undefined,
    schedule: restoredSchedule(habit.schedule, habit.archived.days, today),
    order: (last?.order ?? 0) + 1,
    updatedAt: Date.now(),
  })
}

/** Neue Reihenfolge der aktiven Gewohnheiten */
export async function saveHabitOrder(ids: string[]): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.habits, async () => {
    for (const [i, id] of ids.entries()) await db.habits.update(id, { order: i + 1, updatedAt: now })
  })
}

/** Erledigt setzen bzw. zurücknehmen. Überschreibt eine evtl. Ausnahme des Tages. */
export async function setCheckin(habitId: string, date: DateStr, done: boolean): Promise<void> {
  const checkin: Checkin = { id: `${habitId}_${date}`, habitId, date, done, updatedAt: Date.now() }
  await db.checkins.put(checkin)
}

/** „Heute nicht möglich“: Tag aussetzen, mit Grund und optionaler Notiz. Eine schon eingetragene Menge bleibt. */
export async function setExcused(habitId: string, date: DateStr, reason: ExcuseReason, note?: string): Promise<void> {
  const text = note?.trim().slice(0, 140)
  const id = `${habitId}_${date}`
  await db.transaction('rw', db.checkins, async () => {
    const amount = (await db.checkins.get(id))?.amount
    const checkin: Checkin = {
      id, habitId, date, done: false, excused: true, reason,
      ...(text ? { reasonNote: text } : {}),
      ...(amount ? { amount } : {}),
      updatedAt: Date.now(),
    }
    await db.checkins.put(checkin)
  })
}

/** Ausnahme aufheben: Der Tag ist wieder offen bzw. verpasst, eine eingetragene Menge bleibt. */
export async function clearExcused(habitId: string, date: DateStr): Promise<void> {
  const id = `${habitId}_${date}`
  await db.transaction('rw', db.checkins, async () => {
    const current = await db.checkins.get(id)
    if (!current) return
    const { excused: _e, reason: _r, reasonNote: _n, ...rest } = current
    await db.checkins.put({ ...rest, updatedAt: Date.now() })
  })
}

/**
 * Menge bzw. Minuten eines Tages setzen. Erreicht heißt erledigt; ein
 * „heute nicht möglich“ bleibt stehen, solange das Ziel nicht erreicht ist.
 */
export async function setAmount(habitId: string, date: DateStr, amount: number, goal: HabitGoal): Promise<void> {
  const value = roundAmount(Math.max(0, amount))
  const id = `${habitId}_${date}`
  await db.transaction('rw', db.checkins, async () => {
    const current = await db.checkins.get(id)
    const done = reached(value, goal)
    const keepExcuse = !done && current?.excused
    const checkin: Checkin = {
      id, habitId, date, done, amount: value,
      ...(keepExcuse ? { excused: true, reason: current.reason, ...(current.reasonNote ? { reasonNote: current.reasonNote } : {}) } : {}),
      updatedAt: Date.now(),
    }
    await db.checkins.put(checkin)
  })
}

// ── Timer für Gewohnheiten mit Dauer ────────────────────────────────────────
// Gespeichert wird nur der Startzeitpunkt: Der Timer läuft so auch weiter, wenn die App zu ist.

export const timerKey = (habitId: string) => `timer.${habitId}`

export async function startTimer(habitId: string): Promise<void> {
  await db.meta.put({ key: timerKey(habitId), value: Date.now() })
}

/** Stoppt den Timer und gibt zurück, wann er gestartet wurde (null = lief nicht). */
export async function stopTimer(habitId: string): Promise<number | null> {
  return db.transaction('rw', db.meta, async () => {
    const started = (await db.meta.get(timerKey(habitId)))?.value
    await db.meta.delete(timerKey(habitId))
    return typeof started === 'number' ? started : null
  })
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
    // Ohne Wiederholung gehört es nicht mehr zur Reihe: Zurücknehmen eines früheren Termins lässt es dann in Ruhe
    ...(input.repeat ? {} : { seriesId: undefined }),
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

// ── Abwesenheiten ───────────────────────────────────────────────────────────

export interface AbsenceInput {
  from: DateStr
  to: DateStr
  reason: ExcuseReason
  note?: string
  /** fehlt = alle Gewohnheiten */
  habitIds?: string[]
}

export async function saveAbsence(id: string | undefined, input: AbsenceInput): Promise<void> {
  const now = Date.now()
  const note = input.note?.trim().slice(0, 140)
  const current = id ? await db.absences.get(id) : undefined
  const absence: Absence = {
    id: id ?? crypto.randomUUID(),
    from: input.from,
    to: input.to,
    reason: input.reason,
    ...(note ? { note } : {}),
    ...(input.habitIds ? { habitIds: input.habitIds } : {}),
    deleted: false,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  }
  await db.absences.put(absence)
}

export async function deleteAbsence(id: string): Promise<void> {
  await db.absences.update(id, { deleted: true, updatedAt: Date.now() })
}

/** „Früher zurück“: endet gestern; hat sie erst heute oder noch gar nicht begonnen, fällt sie weg. */
export async function endAbsence(absence: Absence, today: DateStr): Promise<void> {
  const ended = endedEarly(absence, today)
  if (ended) await db.absences.update(absence.id, { to: ended.to, updatedAt: Date.now() })
  else await deleteAbsence(absence.id)
}

// ── Einstellungen ───────────────────────────────────────────────────────────

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = ((await db.meta.get('settings'))?.value as Settings | undefined) ?? DEFAULT_SETTINGS
  await db.meta.put({ key: 'settings', value: { ...current, ...patch } })
}

/**
 * Wiederkehrende To-dos.
 *
 * Eine Reihe hat immer genau einen offenen Termin. Wird er abgehakt, entsteht
 * der nächste. Bleibt er liegen, steht er als überfällig da, statt dass sich die
 * Wäsche von drei Wochen stapelt.
 */
import { addDays, dayOfMonth, daysInMonth, diffDays, formatDayMonth, formatWeekdayShort, maxDate, shiftMonth, startOfWeek, type DateStr } from './dates'
import { cleanReminders, toRemindAt } from './todos'
import type { RepeatReminder, RepeatRule, Todo, TodoRepeat, TodoScope } from './types'

const DAY_RULES: RepeatRule[] = ['taeglich', 'woechentlich', 'zweiwoechentlich', 'monatlich', 'jaehrlich']
const WEEK_RULES: RepeatRule[] = ['woechentlich', 'zweiwoechentlich']

/** Was bei diesem To-do angeboten wird: Eine Wochenaufgabe kann nicht täglich kommen. */
export const rulesFor = (scope: TodoScope) => (scope === 'woche' ? WEEK_RULES : DAY_RULES)

/** Der n-te Monatstermin nach `from`. Kürzere Monate bekommen ihren letzten Tag. */
function monthlyDate(from: DateStr, n: number): DateStr {
  const month = shiftMonth(from.slice(0, 7), n)
  const day = Math.min(dayOfMonth(from), daysInMonth(month))
  return `${month}-${String(day).padStart(2, '0')}`
}

/** Der erste Termin der Reihe, der nach `after` liegt. */
export function nextOccurrence({ rule, from }: Pick<TodoRepeat, 'rule' | 'from'>, after: DateStr): DateStr {
  if (after < from) return from
  const gap = diffDays(from, after)
  if (rule === 'taeglich') return addDays(after, 1)
  if (rule === 'woechentlich') return addDays(from, (Math.floor(gap / 7) + 1) * 7)
  if (rule === 'zweiwoechentlich') return addDays(from, (Math.floor(gap / 14) + 1) * 14)
  const step = rule === 'monatlich' ? 1 : 12
  // An `from` hängt der Monatstag, deshalb immer von dort aus rechnen: So bleibt
  // aus dem 31. nach dem Februar wieder der 31. und wird nicht dauerhaft zum 28.
  let n = step
  while (monthlyDate(from, n) <= after) n += step
  return monthlyDate(from, n)
}

/** Der Termin nach diesem: Wer erst später abhakt, überspringt, was inzwischen vorbei ist. */
export function nextDateOf(todo: Pick<Todo, 'scope' | 'date'>, repeat: TodoRepeat, today: DateStr): DateStr {
  const now = todo.scope === 'woche' ? startOfWeek(today) : today
  return nextOccurrence(repeat, maxDate(todo.date, now))
}

export const applyReminder = (p: RepeatReminder, date: DateStr) => `${addDays(date, p.days)}T${p.time}`

export const offsetOf = (remindAt: string, date: DateStr): RepeatReminder => ({
  days: diffDays(date, remindAt.slice(0, 10)),
  time: remindAt.slice(11, 16),
})

/** Die Erinnerungen eines Termins. Was schon vorbei ist, klingelt nicht nachträglich. */
export function remindersOn(repeat: TodoRepeat, date: DateStr, now: Date): string[] {
  const limit = toRemindAt(now)
  return cleanReminders(repeat.reminders.map((p) => applyReminder(p, date))).filter((r) => r > limit)
}

/** Der nächste offene Termin einer Reihe. */
export function nextInstance(todo: Todo, repeat: TodoRepeat, today: DateStr, now: Date, id: string): Todo {
  const date = nextDateOf(todo, repeat, today)
  const stamp = now.getTime()
  return {
    id,
    seriesId: todo.seriesId ?? todo.id,
    title: todo.title,
    scope: todo.scope,
    date,
    reminders: remindersOn(repeat, date, now),
    repeat,
    done: false,
    deleted: false,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

const cleanPattern = (list: RepeatReminder[]): RepeatReminder[] => {
  const seen = new Set<string>()
  return list
    .filter((p) => {
      const key = `${p.days}|${p.time}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.days - b.days || a.time.localeCompare(b.time))
}

/**
 * Erinnerungen der Reihe, die gerade nicht in der Liste stehen, weil sie schon
 * geklingelt haben: Sie kommen beim nächsten Termin wieder.
 */
export function restingReminders(todo: Todo): RepeatReminder[] {
  if (!todo.repeat) return []
  return todo.repeat.reminders.filter((p) => !todo.reminders.includes(applyReminder(p, todo.date)))
}

/** Die Wiederholung, wie sie im Blatt eingestellt ist. */
export function buildRepeat(
  rule: RepeatRule,
  date: DateStr,
  reminders: string[],
  resting: RepeatReminder[],
  previous?: Todo,
): TodoRepeat {
  const prev = previous?.repeat
  // Ein „später nochmal“ aus dem Banner gilt nur für diesen einen Termin
  const snoozed = (r: string) =>
    !!prev && previous!.reminders.includes(r) && !prev.reminders.some((p) => applyReminder(p, previous!.date) === r)
  return {
    rule,
    from: prev && prev.rule === rule && previous!.date === date ? prev.from : date,
    reminders: cleanPattern([...resting, ...reminders.filter((r) => !snoozed(r)).map((r) => offsetOf(r, date))]),
  }
}

/** Für die Anzeige: „Täglich“, „Jeden Fr“, „Jeden 6. im Monat“ */
export function repeatLabel(rule: RepeatRule, from: DateStr, scope: TodoScope): string {
  switch (rule) {
    case 'taeglich':
      return 'Täglich'
    case 'woechentlich':
      return scope === 'woche' ? 'Jede Woche' : `Jeden ${formatWeekdayShort(from)}`
    case 'zweiwoechentlich':
      return scope === 'woche' ? 'Alle 2 Wochen' : `Alle 2 Wochen ${formatWeekdayShort(from)}`
    case 'monatlich':
      return `Jeden ${dayOfMonth(from)}. im Monat`
    case 'jaehrlich':
      return `Jedes Jahr am ${formatDayMonth(from)}`
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

/** Prüft eine Wiederholung aus einem Backup. Kaputtes zählt als „keine Wiederholung“. */
export function parseRepeat(raw: unknown): TodoRepeat | undefined {
  const r = raw as Partial<TodoRepeat> | null | undefined
  if (!r || !DAY_RULES.includes(r.rule as RepeatRule) || typeof r.from !== 'string' || !DATE.test(r.from)) return undefined
  const reminders = Array.isArray(r.reminders)
    ? r.reminders.filter((p) => p && Number.isInteger(p.days) && typeof p.time === 'string' && TIME.test(p.time))
    : []
  return { rule: r.rule as RepeatRule, from: r.from, reminders: cleanPattern(reminders.map((p) => ({ days: p.days, time: p.time }))) }
}

/**
 * Wochenrückblick: wie lief die Woche, was ist gewachsen, was blieb liegen?
 * Wird wie alles andere nur aus den gespeicherten Fakten berechnet.
 */
import { addDays, eachDay, logicalToday, maxDate, minDate, startOfWeek, weekdayMon0, type DateStr } from './dates'
import { stageName } from './species'
import { dayState, tallyDays, type DayState } from './stats'
import { TERRITORY_STATUS } from './shadow'
import { summarize } from './summary'
import type { DoneSet, Habit, Todo } from './types'

export interface ReviewItem {
  habit: Habit
  done: DoneSet
  excused: DoneSet
}

export interface ReviewDay {
  date: DateStr
  done: number
  due: number
  /** null = nichts fällig oder liegt noch in der Zukunft */
  rate: number | null
}

export interface ReviewHabit {
  habit: Habit
  done: number
  due: number
  rate: number | null
  /** Montag … Sonntag */
  days: DayState[]
}

export interface WeekReview {
  monday: DateStr
  sunday: DateStr
  /** die Woche läuft noch */
  running: boolean
  done: number
  due: number
  rate: number | null
  /** Quote der Woche davor */
  previousRate: number | null
  days: ReviewDay[]
  /** beste zuerst */
  habits: ReviewHabit[]
  /** längste Serie, die am Ende der Woche lief */
  streak: { habit: Habit; days: number } | null
  /** was diese Woche eine Stufe aufgestiegen ist */
  advanced: { habit: Habit; label: string }[]
  todosDone: number
  /** offen und nicht später eingeplant */
  leftOver: Todo[]
}

const rateOf = (done: number, due: number) => (due > 0 ? done / due : null)

/**
 * Stand am Ende von `date` als Zahl: Stufe der Pflanze bzw. Lage im Kampf gegen den
 * Schatten. Ein vergangener Stichtag ist vorbei, dort zählt auch ein Verpassen. Als
 * „heute“ gerechnet ließe die Berechnung ihn noch offen.
 */
function levelAt({ habit, done, excused }: ReviewItem, date: DateStr, today: DateStr): { level: number; label: string } {
  const past = date < today
  const upTo = past ? new Set([...done].filter((d) => d <= date)) : done
  const s = summarize(habit, upTo, past ? addDays(date, 1) : date, excused)
  if (habit.metaphor === 'schatten') return { level: s.shadow.status, label: TERRITORY_STATUS[s.shadow.status].label }
  return { level: s.stage, label: stageName(habit.species, s.stage) }
}

export function buildWeekReview(
  items: ReviewItem[],
  todos: Todo[],
  monday: DateStr,
  today: DateStr,
  dayStartHour = 0,
): WeekReview {
  const sunday = addDays(monday, 6)
  const last = minDate(sunday, today)
  const dates = [...eachDay(monday, sunday)]

  const tally = (item: ReviewItem, from: DateStr, to: DateStr) => tallyDays(item.habit, item.done, from, to, today, item.excused)

  const habits: ReviewHabit[] = items
    .filter((i) => i.habit.startDate <= last)
    .map((item) => {
      const { hit, due } = tally(item, monday, last)
      return {
        habit: item.habit,
        done: hit,
        due,
        rate: rateOf(hit, due),
        days: dates.map((d) => dayState(item.habit, item.done, d, today, item.excused)),
      }
    })
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.done - a.done)

  const done = habits.reduce((n, h) => n + h.done, 0)
  const due = habits.reduce((n, h) => n + h.due, 0)

  let previous = { hit: 0, due: 0 }
  for (const item of items) {
    const t = tally(item, addDays(monday, -7), addDays(monday, -1))
    previous = { hit: previous.hit + t.hit, due: previous.due + t.due }
  }

  const days: ReviewDay[] = dates.map((date) => {
    let hit = 0
    let dueOnDay = 0
    if (date <= today) {
      for (const item of items) {
        const t = tally(item, date, date)
        hit += t.hit
        dueOnDay += t.due
      }
    }
    return { date, done: hit, due: dueOnDay, rate: rateOf(hit, dueOnDay) }
  })

  let streak: WeekReview['streak'] = null
  const advanced: WeekReview['advanced'] = []
  for (const item of items) {
    if (item.habit.startDate > last) continue
    const current = summarize(item.habit, item.done, last, item.excused).streaks.current
    if (current > 0 && current > (streak?.days ?? 0)) streak = { habit: item.habit, days: current }
    const before = levelAt(item, addDays(monday, -1), today)
    const after = levelAt(item, last, today)
    if (after.level > before.level) advanced.push({ habit: item.habit, label: after.label })
  }

  const live = todos.filter((t) => !t.deleted)
  const todosDone = live.filter((t) => {
    if (!t.done || t.doneAt === undefined) return false
    const day = logicalToday(new Date(t.doneAt), dayStartHour)
    return day >= monday && day <= sunday
  }).length
  const leftOver = live.filter((t) => !t.done && (t.scope === 'tag' ? t.date <= sunday : t.date <= monday))

  return {
    monday,
    sunday,
    running: today < sunday,
    done,
    due,
    rate: rateOf(done, due),
    previousRate: rateOf(previous.hit, previous.due),
    days,
    habits,
    streak,
    advanced,
    todosDone,
    leftOver,
  }
}

/** Kurzes Urteil in Worten */
export function reviewVerdict(r: Pick<WeekReview, 'rate' | 'previousRate' | 'running'>): { title: string; detail: string | null } {
  if (r.rate === null) return { title: 'Nichts fällig', detail: null }
  const week = r.running ? 'Bisher eine' : 'Eine'
  const title =
    r.rate >= 0.9 ? `${week} starke Woche` : r.rate >= 0.7 ? `${week} gute Woche` : r.rate >= 0.4 ? `${week} durchwachsene Woche` : `${week} schwere Woche`
  if (r.previousRate === null) return { title, detail: null }
  const diff = Math.round(r.rate * 100) - Math.round(r.previousRate * 100)
  const points = Math.abs(diff) === 1 ? 'Prozentpunkt' : 'Prozentpunkte'
  const detail = diff === 0 ? 'Genauso gut wie die Woche davor' : `${Math.abs(diff)} ${points} ${diff > 0 ? 'mehr' : 'weniger'} als die Woche davor`
  return { title, detail }
}

/**
 * Welche Woche der Rückblick zuerst zeigt: Am Sonntag die laufende, sonst die
 * letzte vollständige.
 */
export const weekToReview = (today: DateStr): DateStr =>
  weekdayMon0(today) === 6 ? startOfWeek(today) : addDays(startOfWeek(today), -7)

/** Die Karte auf „Heute“ erscheint am Sonntag und Montag, bis der Rückblick einmal geöffnet wurde. */
export function reviewCardWeek(today: DateStr, seenWeek: DateStr | null): DateStr | null {
  const day = weekdayMon0(today)
  if (day !== 6 && day !== 0) return null
  const week = weekToReview(today)
  return seenWeek === week ? null : week
}

/**
 * In welche Woche Offenes gelegt wird: die nach der angesehenen, nie eine
 * vergangene. Am Sonntag ist die laufende Woche praktisch vorbei, dann die kommende.
 */
export const nextReviewWeek = (monday: DateStr, today: DateStr): DateStr =>
  maxDate(addDays(monday, 7), startOfWeek(weekdayMon0(today) === 6 ? addDays(today, 1) : today))

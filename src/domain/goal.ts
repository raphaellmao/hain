/**
 * Gewohnheiten mit Tagesziel: eine Menge („8 Gläser“) oder eine Dauer („30 min“).
 *
 * Gespeichert wird pro Tag, wie viel es war (Checkin.amount). Ist das Ziel
 * erreicht, gilt der Tag als erledigt – Baum, Serien und Schatten rechnen damit
 * wie bisher. Ein geändertes Ziel gilt ab dann; was vorher erledigt war, bleibt
 * erledigt (wie bei geänderten Wochentagen).
 */
import { addDays, eachDay, maxDate, type DateStr } from './dates'
import { isDue } from './schedule'
import { type DoneSet, type GoalKind, type Habit, type HabitGoal, NO_DAYS } from './types'

export const UNIT_SUGGESTIONS = ['Gläser', 'Liter', 'Seiten', 'km', 'Mal', 'Kapitel', 'Schritte', 'Wiederholungen']
export const MINUTE_PRESETS = [10, 15, 20, 30, 45, 60]
/** Schnell dazu bei Dauer */
export const MINUTE_STEPS = [5, 15, 30]
/** Ein Timer, der länger lief, wurde vermutlich vergessen */
export const TIMER_CAP_MIN = 12 * 60

/** Rechnen mit 0,25 l soll nicht zu 0,7500000001 l führen */
export const roundAmount = (v: number) => Math.round(v * 100) / 100

export const reached = (amount: number, goal: HabitGoal) => amount >= goal.target - 1e-9

export const progressOf = (amount: number, goal: HabitGoal) => Math.max(0, Math.min(1, amount / goal.target))

/**
 * Menge eines Tages. Ein Tag, der ohne Menge abgehakt wurde (vor dem Ziel oder
 * im Kalender), zählt als erreichtes Ziel.
 */
export const effectiveAmount = (amount: number | undefined, done: boolean, goal: HabitGoal) =>
  amount !== undefined ? amount : done ? goal.target : 0

const fmtNumber = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
export const formatNumber = (v: number) => fmtNumber.format(v)

/** „25 min“, „1 h“, „1 h 10 min“ */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}

export function formatAmount(amount: number, goal: Pick<HabitGoal, 'kind' | 'unit'>): string {
  if (goal.kind === 'dauer') return formatMinutes(amount)
  return `${formatNumber(amount)} ${goal.unit}`.trim()
}

/** „3 / 8 Gläser“, „12 / 30 min“, „45 min / 1 h 30 min“ */
export function progressText(amount: number, goal: HabitGoal): string {
  if (goal.kind === 'dauer') {
    return goal.target < 60 && amount < 60 ? `${Math.round(amount)} / ${goal.target} min` : `${formatMinutes(amount)} / ${formatMinutes(goal.target)}`
  }
  return `${formatNumber(amount)} / ${formatAmount(goal.target, goal)}`
}

export const goalLabel = (goal: HabitGoal) => `${formatAmount(goal.target, goal)} am Tag`

/** „+1“ bzw. „+5 min“: Die Einheit fehlt absichtlich, „+1 Gläser“ wäre falsch */
export const stepLabel = (goal: HabitGoal) => (goal.kind === 'dauer' ? `+${goal.step} min` : `+${formatNumber(goal.step)}`)

/** Ganze Minuten seit dem Start, höchstens TIMER_CAP_MIN */
export function timerMinutes(startedAt: number, now: number): { minutes: number; capped: boolean } {
  const minutes = Math.max(0, Math.floor((now - startedAt) / 60_000))
  return minutes > TIMER_CAP_MIN ? { minutes: TIMER_CAP_MIN, capped: true } : { minutes, capped: false }
}

/** „05:12“ bzw. „1:05:12“ für die laufende Anzeige */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  return h ? `${h}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

/** Eingabe mit Komma oder Punkt; null bei Unsinn */
export function parseAmount(text: string): number | null {
  const v = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(v) && v >= 0 ? roundAmount(v) : null
}

export interface AmountStats {
  /** Durchschnitt an fälligen Tagen der letzten 30 Tage */
  average: number | null
  /** alles seit Beginn */
  total: number
  best: number
}

/** Kennzahlen für die Detailansicht */
export function amountStats(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  goal: HabitGoal,
  amounts: ReadonlyMap<DateStr, number>,
  done: DoneSet,
  today: DateStr,
  excused: DoneSet = NO_DAYS,
): AmountStats {
  const at = (d: DateStr) => effectiveAmount(amounts.get(d), done.has(d), goal)
  let sum = 0
  let days = 0
  if (habit.startDate <= today) {
    for (const d of eachDay(maxDate(addDays(today, -29), habit.startDate), today)) {
      const v = at(d)
      // Zählt wie die Quote: heute erst, wenn schon etwas da ist; ausgesetzte und freie Tage nur mit Menge
      if (v === 0 && (d === today || !isDue(habit, d) || excused.has(d))) continue
      sum += v
      days++
    }
  }
  let total = 0
  let best = 0
  const all = new Set([...amounts.keys(), ...done])
  for (const d of all) {
    if (d < habit.startDate || d > today) continue
    const v = at(d)
    total += v
    if (v > best) best = v
  }
  return { average: days ? roundAmount(sum / days) : null, total: roundAmount(total), best }
}

/** Prüft ein Ziel aus einem Backup; Unsinn heißt: kein Ziel */
export function parseGoal(raw: unknown): HabitGoal | undefined {
  const g = raw as Partial<HabitGoal> | null | undefined
  const kinds: GoalKind[] = ['menge', 'dauer']
  if (!g || !kinds.includes(g.kind as GoalKind)) return undefined
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100_000
  if (!ok(g.target) || !ok(g.step)) return undefined
  return {
    kind: g.kind as GoalKind,
    target: roundAmount(g.target),
    unit: g.kind === 'dauer' ? '' : typeof g.unit === 'string' ? g.unit.slice(0, 20) : '',
    step: roundAmount(g.step),
  }
}

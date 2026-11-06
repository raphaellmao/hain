/**
 * Ausnahmetage: „Heute nicht möglich“ mit Grund.
 *
 * Ein ausgesetzter Tag zählt weder als erledigt noch als verpasst – er wird
 * wie ein nicht fälliger Tag behandelt: der Baum welkt nicht, die Serie läuft
 * weiter, der Schatten wird nicht stärker, die Erfolgsquote zählt ihn nicht.
 * Wird der Tag doch noch erledigt, gilt „erledigt“.
 */
import { type DateStr, addDays, eachDay } from './dates'
import type { DoneSet } from './types'

const REASONS = [
  { key: 'krank', label: 'Krank', emoji: '🤒' },
  { key: 'dienst', label: 'Dienst', emoji: '🎖️' },
  { key: 'unterwegs', label: 'Unterwegs', emoji: '🧳' },
  { key: 'familie', label: 'Familie', emoji: '👨‍👩‍👧' },
  { key: 'ruhetag', label: 'Ruhetag', emoji: '🛌' },
  { key: 'urlaub', label: 'Urlaub', emoji: '🏖️' },
  { key: 'lehrgang', label: 'Lehrgang', emoji: '📚' },
  { key: 'sonst', label: 'Anderer Grund', emoji: '✏️' },
] as const

export type ExcuseReason = (typeof REASONS)[number]['key']
type ReasonInfo = (typeof REASONS)[number]

const pick = (keys: ExcuseReason[]): ReasonInfo[] => keys.map((k) => REASONS.find((r) => r.key === k)!)

/** Für einen einzelnen Tag („heute nicht möglich“) */
export const EXCUSE_REASONS = pick(['krank', 'dienst', 'unterwegs', 'familie', 'ruhetag', 'sonst'])
/** Für längere Abwesenheiten */
export const ABSENCE_REASONS = pick(['urlaub', 'dienst', 'lehrgang', 'krank', 'unterwegs', 'familie', 'sonst'])

export const isExcuseReason = (v: unknown): v is ExcuseReason => typeof v === 'string' && REASONS.some((r) => r.key === v)

export const reasonInfo = (key: ExcuseReason | undefined): ReasonInfo =>
  REASONS.find((r) => r.key === key) ?? REASONS[REASONS.length - 1]

/**
 * Nur selbst gesetzte Ausnahmen, ohne Abwesenheiten: Für die ehrliche Selbstkontrolle
 * zählt ein geplanter Urlaub nicht als dreißig Ausreden.
 */
export function ownExcuses(days: ReadonlyMap<DateStr, { absenceId?: string }>): Set<DateStr> {
  const own = new Set<DateStr>()
  for (const [d, info] of days) if (!info.absenceId) own.add(d)
  return own
}

/** Ausnahmen in den letzten `days` Tagen (inkl. heute) – zur ehrlichen Selbstkontrolle */
export function excusesInWindow(excused: DoneSet, today: DateStr, days = 30): number {
  let n = 0
  for (const d of eachDay(addDays(today, -(days - 1)), today)) if (excused.has(d)) n++
  return n
}

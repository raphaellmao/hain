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

export const EXCUSE_REASONS = [
  { key: 'krank', label: 'Krank', emoji: '🤒' },
  { key: 'dienst', label: 'Dienst', emoji: '🎖️' },
  { key: 'unterwegs', label: 'Unterwegs', emoji: '🧳' },
  { key: 'familie', label: 'Familie', emoji: '👨‍👩‍👧' },
  { key: 'ruhetag', label: 'Ruhetag', emoji: '🛌' },
  { key: 'sonst', label: 'Anderer Grund', emoji: '✏️' },
] as const

export type ExcuseReason = (typeof EXCUSE_REASONS)[number]['key']

export const isExcuseReason = (v: unknown): v is ExcuseReason =>
  typeof v === 'string' && EXCUSE_REASONS.some((r) => r.key === v)

export const reasonInfo = (key: ExcuseReason | undefined) =>
  EXCUSE_REASONS.find((r) => r.key === key) ?? EXCUSE_REASONS[EXCUSE_REASONS.length - 1]

/** Ausnahmen in den letzten `days` Tagen (inkl. heute) – zur ehrlichen Selbstkontrolle */
export function excusesInWindow(excused: DoneSet, today: DateStr, days = 30): number {
  let n = 0
  for (const d of eachDay(addDays(today, -(days - 1)), today)) if (excused.has(d)) n++
  return n
}

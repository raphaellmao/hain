/**
 * Abwesenheiten: Urlaub, Lehrgang, Übung … einmal von–bis eintragen statt Tag für
 * Tag und je Gewohnheit. Jeder Tag darin zählt wie eine Ausnahme („heute nicht
 * möglich“): nichts welkt, die Serie läuft weiter, der Schatten wird nicht stärker.
 */
import { addDays, dayOfMonth, diffDays, formatDayMonth, type DateStr } from './dates'
import type { Absence } from './types'

/** Länger geht nicht – das wäre eher eine Pause der ganzen Gewohnheit */
export const ABSENCE_MAX_DAYS = 366

export const appliesTo = (a: Pick<Absence, 'habitIds'>, habitId: string) => !a.habitIds || a.habitIds.includes(habitId)

export const covers = (a: Pick<Absence, 'from' | 'to'>, date: DateStr) => a.from <= date && date <= a.to

export const lengthOf = (a: Pick<Absence, 'from' | 'to'>) => diffDays(a.from, a.to) + 1

/** null = in Ordnung, sonst der Grund in Worten */
export function absenceProblem(from: DateStr, to: DateStr): string | null {
  if (to < from) return 'Das Ende liegt vor dem Anfang.'
  if (diffDays(from, to) + 1 > ABSENCE_MAX_DAYS) return 'Höchstens ein Jahr am Stück.'
  return null
}

/** „3. Nov.“, „3.–14. Nov.“, „28. Okt. – 3. Nov.“ */
export function formatRange(from: DateStr, to: DateStr): string {
  if (from === to) return formatDayMonth(from)
  if (from.slice(0, 7) === to.slice(0, 7)) return `${dayOfMonth(from)}.–${formatDayMonth(to)}`
  return `${formatDayMonth(from)} – ${formatDayMonth(to)}`
}

export type AbsencePhase = 'geplant' | 'laeuft' | 'vorbei'

export const phaseOf = (a: Pick<Absence, 'from' | 'to'>, today: DateStr): AbsencePhase =>
  today < a.from ? 'geplant' : today > a.to ? 'vorbei' : 'laeuft'

/** Laufende zuerst, dann geplante nach Beginn, dann vergangene (die jüngste zuerst) */
export function sortAbsences<T extends Pick<Absence, 'from' | 'to'>>(list: T[], today: DateStr): T[] {
  const rank = { laeuft: 0, geplant: 1, vorbei: 2 }
  return [...list].sort((a, b) => {
    const pa = phaseOf(a, today)
    const pb = phaseOf(b, today)
    if (pa !== pb) return rank[pa] - rank[pb]
    return pa === 'vorbei' ? b.to.localeCompare(a.to) : a.from.localeCompare(b.from)
  })
}

/**
 * „Früher zurück“: Die Abwesenheit endet gestern. Hat sie noch gar nicht oder erst
 * heute begonnen, bleibt nichts übrig (null = löschen).
 */
export function endedEarly(a: Pick<Absence, 'from' | 'to'>, today: DateStr): { to: DateStr } | null {
  const yesterday = addDays(today, -1)
  return yesterday < a.from ? null : { to: yesterday < a.to ? yesterday : a.to }
}

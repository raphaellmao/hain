/**
 * Datumsrechnung auf Basis von Text-Daten im Format 'JJJJ-MM-TT'.
 *
 * Warum Text statt Date/Zeitstempel? Ein Habit wird für einen *Kalendertag*
 * abgehakt, nicht für einen Zeitpunkt. Mit Zeitstempeln landet ein Haken um
 * 23:30 Uhr je nach Zeitzone/Sommerzeit schnell auf dem falschen Tag.
 * Intern rechnen wir deshalb ausschließlich in UTC – dort gibt es keine
 * Sommerzeit-Sprünge, jeder Tag hat genau 24 Stunden.
 */

export type DateStr = string

const DAY_MS = 86_400_000

/** 'JJJJ-MM-TT' → Millisekunden (UTC-Mitternacht) */
function toUtcMs(d: DateStr): number {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}

function fromUtcMs(ms: number): DateStr {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Lokales Kalenderdatum eines Date-Objekts (Ortszeit des Geräts). */
export function toDateStr(date: Date): DateStr {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * „Heute“ im Sinne der App. Mit Tageswechsel um z. B. 3 Uhr gilt 01:30 Uhr
 * noch als der Vortag – wichtig bei Nachtdienst.
 */
export function logicalToday(now: Date, dayStartHour: number): DateStr {
  const shifted = new Date(now.getTime() - dayStartHour * 3_600_000)
  return toDateStr(shifted)
}

export function addDays(d: DateStr, n: number): DateStr {
  return fromUtcMs(toUtcMs(d) + n * DAY_MS)
}

/** Anzahl Tage von a nach b (b − a). */
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS)
}

/** Wochentag wie in JavaScript üblich: 0 = Sonntag … 6 = Samstag. */
export function weekday(d: DateStr): number {
  return new Date(toUtcMs(d)).getUTCDay()
}

/** Wochentag mit Montag = 0 … Sonntag = 6 (für Kalender mit Wochenstart Montag). */
export function weekdayMon0(d: DateStr): number {
  return (weekday(d) + 6) % 7
}

/** Montag der Woche, in der d liegt. */
export function startOfWeek(d: DateStr): DateStr {
  return addDays(d, -weekdayMon0(d))
}

/** Alle Tage von `from` bis einschließlich `to`. */
export function* eachDay(from: DateStr, to: DateStr): Generator<DateStr> {
  for (let ms = toUtcMs(from), end = toUtcMs(to); ms <= end; ms += DAY_MS) {
    yield fromUtcMs(ms)
  }
}

export function minDate(a: DateStr, b: DateStr): DateStr {
  return a < b ? a : b
}

export function maxDate(a: DateStr, b: DateStr): DateStr {
  return a > b ? a : b
}

// ── Anzeige (deutsch) ───────────────────────────────────────────────────────

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('de-DE', { ...opts, timeZone: 'UTC' })

const fmtLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' })
const fmtShortWd = fmt({ weekday: 'short' })
const fmtMonthYear = fmt({ month: 'long', year: 'numeric' })
const fmtDayMonth = fmt({ day: 'numeric', month: 'short' })

/** „Montag, 12. Oktober“ */
export const formatLong = (d: DateStr) => fmtLong.format(toUtcMs(d))
/** „Mo“ (ohne Punkt) */
export const formatWeekdayShort = (d: DateStr) => fmtShortWd.format(toUtcMs(d)).replace('.', '')
/** „Oktober 2026“ */
export const formatMonthYear = (d: DateStr) => fmtMonthYear.format(toUtcMs(d))
/** „12. Okt.“ */
export const formatDayMonth = (d: DateStr) => fmtDayMonth.format(toUtcMs(d))
/** Tag im Monat als Zahl */
export const dayOfMonth = (d: DateStr) => Number(d.slice(8, 10))

/** Kürzel Mo … So, Index 0 = Montag */
export const WEEKDAYS_MON0 = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

/** Monat 'JJJJ-MM' um n Monate verschieben. */
export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

const fmtMonthShort = fmt({ month: 'short' })
/** „Okt“ (ohne Punkt) */
export const formatMonthShort = (d: DateStr) => fmtMonthShort.format(toUtcMs(d)).replace('.', '')

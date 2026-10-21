/**
 * Schatten-Ich: die dunkle Metapher als Alternative zum Baum.
 *
 * Dein Schatten ist eine dunkle Version von dir. Er wird an jedem Tag
 * stärker, an dem du schwach bist, und schwächer, wenn du dranbleibst.
 * Ihr kämpft um dasselbe Territorium:
 *
 *   Schattenstärke S (0 … 100)
 *     verpasster fälliger Tag  → S + 18 % des Abstands zu 100 (wird nie ganz 100)
 *     erledigter Tag            → S − 15 %
 *   Dein Licht L (0 … 100) folgt aus dem Gesundheitswert H: L = 100 · (1 − e^(−H/25))
 *   Dein Anteil am Territorium T = (L + 10) / (L + S + 20)   → zu Beginn 50 % (Patt)
 *
 * Abgestimmt auf den Baum: Wer von voller Stärke 7 fällige Tage in Folge
 * verpasst, dem gehört nichts mehr („Er herrscht“) – wie der Baum, der dann
 * kahl ist. Nach etwa 10 erledigten Tagen ist das Land wieder umkämpft.
 *
 * Wie H wird auch S nie gespeichert, sondern aus der Historie berechnet.
 */
import { type DateStr, eachDay } from './dates'
import { isDue } from './schedule'
import { H_MAX } from './health'
import { type DoneSet, type Habit, NO_DAYS } from './types'

export const SHADOW_GAIN = 0.18
export const SHADOW_DECAY = 0.15

export interface Shadow {
  /** Stärke des Schattens 0 … 100 */
  s: number
  /** dein Licht 0 … 100 */
  light: number
  /** dein Anteil am Territorium 0 … 1 */
  territory: number
  /** Index in TERRITORY_STATUS */
  status: number
  /** Index in SHADOW_LEVELS */
  level: number
}

/** Lage im Kampf um das Territorium, nach deinem Anteil */
export const TERRITORY_STATUS = [
  { min: 0, label: 'Er herrscht' },
  { min: 0.15, label: 'Er rückt vor' },
  { min: 0.4, label: 'Patt' },
  { min: 0.6, label: 'Du drängst ihn zurück' },
  { min: 0.85, label: 'Dein Land' },
] as const

/** Wie stark ist dein Schatten? (nach S) */
export const SHADOW_LEVELS = [
  { min: 0, label: 'Flüstern' },
  { min: 10, label: 'Schemen' },
  { min: 25, label: 'Schatten' },
  { min: 45, label: 'Verfolger' },
  { min: 65, label: 'Dunkler Zwilling' },
  { min: 85, label: 'Herrscher' },
] as const

export const lightOf = (h: number) => 100 * (1 - Math.exp(-h / 25))
export const territoryOf = (light: number, s: number) => (light + 10) / (light + s + 20)

const indexOf = (list: readonly { min: number }[], v: number) => {
  let i = 0
  for (let k = 0; k < list.length; k++) if (v >= list[k].min) i = k
  return i
}
export const statusOf = (territory: number) => indexOf(TERRITORY_STATUS, territory)
export const levelOf = (s: number) => indexOf(SHADOW_LEVELS, s)

/** Schattenstärke aus der Historie. Heute zählt nur, wenn schon erledigt. */
export function computeShadowPower(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  done: DoneSet,
  today: DateStr,
  excused: DoneSet = NO_DAYS,
): number {
  let s = 0
  if (habit.startDate > today) return 0
  for (const d of eachDay(habit.startDate, today)) {
    if (done.has(d)) s *= 1 - SHADOW_DECAY
    else if (d < today && isDue(habit, d) && !excused.has(d)) s += (100 - s) * SHADOW_GAIN
  }
  return s
}

export function shadowState(h: number, s: number): Shadow {
  const light = lightOf(h)
  const territory = territoryOf(light, s)
  return { s, light, territory, status: statusOf(territory), level: levelOf(s) }
}

/**
 * Wie viele erledigte Tage in Folge braucht es bis zur nächsten besseren
 * Lage? (null = schon „Dein Land“)
 */
export function daysToNextStatus(h: number, s: number): { days: number; label: string } | null {
  const now = statusOf(territoryOf(lightOf(h), s))
  if (now >= TERRITORY_STATUS.length - 1) return null
  for (let n = 1; n <= 400; n++) {
    h = Math.min(H_MAX, h + 1)
    s *= 1 - SHADOW_DECAY
    if (statusOf(territoryOf(lightOf(h), s)) > now) return { days: n, label: TERRITORY_STATUS[now + 1].label }
  }
  return null
}

/** Beste je erreichte Lage gegen den Schatten (Index in TERRITORY_STATUS), für Erfolge. */
export function bestShadowStatus(
  habit: Pick<Habit, 'schedule' | 'startDate'>,
  done: DoneSet,
  today: DateStr,
  excused: DoneSet = NO_DAYS,
): number {
  let h = 0
  let s = 0
  let miss = 0
  let best = 0
  if (habit.startDate > today) return 0
  for (const d of eachDay(habit.startDate, today)) {
    if (done.has(d)) {
      h = Math.min(H_MAX, h + 1)
      s *= 1 - SHADOW_DECAY
      miss = 0
    } else if (d < today && isDue(habit, d) && !excused.has(d)) {
      miss++
      h = miss === 1 ? Math.max(0, h - 1) : h / 2
      s += (100 - s) * SHADOW_GAIN
    } else continue
    best = Math.max(best, statusOf(territoryOf(lightOf(h), s)))
  }
  return best
}

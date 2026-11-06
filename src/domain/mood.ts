/**
 * Stimmung pro Tag (1 = schlecht … 5 = super) und was sich daraus ablesen lässt:
 * An welchen Gewohnheiten hängen die guten Tage? Das ist ein Zusammenhang, kein
 * Beweis – die Auswertung sagt das auch so.
 */
import { addDays, eachDay, type DateStr } from './dates'
import { isDue } from './schedule'
import type { DoneSet, Habit, Mood } from './types'

export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Schlecht' },
  { value: 2, emoji: '🙁', label: 'Eher schlecht' },
  { value: 3, emoji: '😐', label: 'Geht so' },
  { value: 4, emoji: '🙂', label: 'Gut' },
  { value: 5, emoji: '😄', label: 'Super' },
]

export const isMood = (v: unknown): v is Mood => v === 1 || v === 2 || v === 3 || v === 4 || v === 5

/** Gesicht zu einem Durchschnitt, z. B. 3,8 → 🙂 */
export const moodEmoji = (avg: number) => MOODS[Math.min(4, Math.max(0, Math.round(avg) - 1))].emoji

const fmt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const formatMood = (avg: number) => fmt.format(avg)

export interface MoodSummary {
  average: number | null
  /** bewertete Tage */
  count: number
  /** Anzahl je Stufe, Index 0 = 😞 … 4 = 😄 */
  counts: number[]
}

export function moodSummary(moods: ReadonlyMap<DateStr, Mood>, from: DateStr, to: DateStr): MoodSummary {
  const counts = [0, 0, 0, 0, 0]
  let sum = 0
  let count = 0
  for (const d of eachDay(from, to)) {
    const m = moods.get(d)
    if (!m) continue
    counts[m - 1]++
    sum += m
    count++
  }
  return { average: count ? sum / count : null, count, counts }
}

export interface MoodLink {
  habit: Habit
  /** Durchschnitt an Tagen, an denen sie erledigt war */
  withAvg: number
  /** … und an fälligen Tagen, an denen nicht */
  withoutAvg: number
  diff: number
  withDays: number
  withoutDays: number
}

/**
 * Pro Gewohnheit: Stimmung an erledigten gegenüber verpassten Tagen. Nur wenn auf
 * beiden Seiten genug bewertete Tage liegen, sonst wäre es Zufall. Sortiert nach
 * Unterschied, der größte zuerst.
 */
export function moodLinks(
  items: { habit: Habit; done: DoneSet; excused: DoneSet }[],
  moods: ReadonlyMap<DateStr, Mood>,
  today: DateStr,
  minDays = 4,
): MoodLink[] {
  const links: MoodLink[] = []
  for (const { habit, done, excused } of items) {
    let withSum = 0
    let withDays = 0
    let withoutSum = 0
    let withoutDays = 0
    for (const [d, m] of moods) {
      if (d < habit.startDate || d > today) continue
      if (done.has(d)) {
        withSum += m
        withDays++
      } else if (d < today && isDue(habit, d) && !excused.has(d)) {
        withoutSum += m
        withoutDays++
      }
    }
    if (withDays < minDays || withoutDays < minDays) continue
    const withAvg = withSum / withDays
    const withoutAvg = withoutSum / withoutDays
    links.push({ habit, withAvg, withoutAvg, diff: withAvg - withoutAvg, withDays, withoutDays })
  }
  return links.sort((a, b) => b.diff - a.diff)
}

/** Zeitraum der Auswertung: die letzten 30 Tage */
export const last30 = (today: DateStr) => ({ from: addDays(today, -29), to: today })

/**
 * Erfolge (Abzeichen). Wie alles andere werden sie nicht gespeichert, sondern
 * aus der Historie berechnet – nachträgliche Korrekturen wirken also sofort.
 * Nur „schon gesehen“ merkt sich die App (für den Hinweis beim Freischalten).
 *
 * Jeder Erfolg hat eine Kategorie und eine Seltenheit (Bronze … Legendär).
 * Geheime Erfolge zeigen sich erst, wenn sie erreicht sind.
 */
import { type DateStr, addDays, diffDays, eachDay, startOfWeek } from './dates'
import { isDue } from './schedule'
import { STAGE_THRESHOLDS } from './health'
import { shadowJourney } from './shadow'
import { combineMonthly, monthlyRates, successRate, totalDone } from './stats'
import { SPECIES_KEYS, speciesOf } from './species'
import type { HabitSummary } from './summary'
import type { DoneSet, Habit } from './types'

export type Tier = 'bronze' | 'silber' | 'gold' | 'legendaer'
export type Category = 'wachstum' | 'serien' | 'fleiss' | 'quote' | 'schatten' | 'garten' | 'geheim'

export const TIERS: Record<Tier, { label: string; emoji: string }> = {
  bronze: { label: 'Bronze', emoji: '🥉' },
  silber: { label: 'Silber', emoji: '🥈' },
  gold: { label: 'Gold', emoji: '🥇' },
  legendaer: { label: 'Legendär', emoji: '💎' },
}

export const CATEGORIES: Record<Category, string> = {
  wachstum: 'Wachstum',
  serien: 'Serien',
  fleiss: 'Fleiß',
  quote: 'Quote',
  schatten: 'Schatten-Ich',
  garten: 'Garten & Tagebuch',
  geheim: 'Geheim',
}

export interface AchievementInput {
  habit: Habit
  done: DoneSet
  excused: DoneSet
  summary: HabitSummary
}

/** Wann wurden Haken gesetzt? (aus dem Zeitstempel der Einträge) */
export interface TickStats {
  /** Haken vor 7 Uhr am selben Tag */
  early: number
  /** Haken ab 23 Uhr (bis zum Tageswechsel) */
  late: number
  /** ein Haken zwischen Mitternacht und 1 Uhr */
  ghost: boolean
}

export interface Achievement {
  id: string
  emoji: string
  title: string
  description: string
  category: Category
  tier: Tier
  secret: boolean
  achieved: boolean
  /** Fortschritt für noch nicht erreichte Erfolge */
  value: number
  target: number
}

interface Context {
  items: AchievementInput[]
  today: DateStr
  notes: number
  backedUp: boolean
  ticks: TickStats
}

const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : 0)

/** Tagesweise Zahlen über alle Gewohnheiten: fällig (ohne Ausnahmen) und erledigt */
function dailyTotals(ctx: Context) {
  const days = new Map<DateStr, { due: number; doneDue: number; done: number }>()
  const first = ctx.items.reduce((m, i) => (i.habit.startDate < m ? i.habit.startDate : m), ctx.today)
  for (const d of eachDay(first, ctx.today)) {
    let due = 0
    let doneDue = 0
    let done = 0
    for (const i of ctx.items) {
      if (d < i.habit.startDate) continue
      const isDone = i.done.has(d)
      if (isDone) done++
      if (!isDue(i.habit, d) || (i.excused.has(d) && !isDone)) continue
      if (d === ctx.today && !isDone) continue
      due++
      if (isDone) doneDue++
    }
    days.set(d, { due, doneDue, done })
  }
  return days
}

/** Ganze Woche Mo–So (vor der laufenden), in der alles Fällige erledigt war */
function perfectWeeks(ctx: Context): number {
  let count = 0
  const thisWeek = startOfWeek(ctx.today)
  for (let w = 1; w <= 53; w++) {
    const mon = addDays(thisWeek, -7 * w)
    let due = 0
    let ok = true
    for (const d of eachDay(mon, addDays(mon, 6))) {
      for (const i of ctx.items) {
        if (!isDue(i.habit, d) || d < i.habit.startDate || (i.excused.has(d) && !i.done.has(d))) continue
        due++
        if (!i.done.has(d)) ok = false
      }
      if (!ok) break
    }
    if (ok && due > 0) count++
  }
  return count
}

export function computeAchievements(ctx: Context): Achievement[] {
  const { items, today } = ctx
  const plants = items.filter((i) => i.habit.metaphor !== 'schatten')
  const shadows = items.filter((i) => i.habit.metaphor === 'schatten')

  // ── Kennzahlen ────────────────────────────────────────────────────────────
  const peak = maxOf(items.map((i) => i.summary.health.peak))
  const longest = maxOf(items.map((i) => i.summary.streaks.longest))
  const total = items.reduce((n, i) => n + totalDone(i.habit, i.done, today), 0)
  const journeys = shadows.map((i) => shadowJourney(i.habit, i.done, today, i.excused))
  const bestShadow = maxOf(journeys.map((j) => j.best))
  const species = new Set(plants.map((i) => speciesOf(i.habit))).size
  const weeks = perfectWeeks(ctx)

  const days = dailyTotals(ctx)
  let perfectDays = 0
  let activeDays = 0
  let maxDoneInDay = 0
  for (const t of days.values()) {
    if (t.due >= 3 && t.doneDue === t.due) perfectDays++
    if (t.done > 0) activeDays++
    maxDoneInDay = Math.max(maxDoneInDay, t.done)
  }

  // Monate: zusammen und je Gewohnheit (nur abgeschlossene Monate zählen)
  const months = 24
  const perHabit = items.map((i) => monthlyRates(i.habit, i.done, today, i.excused, months))
  const overall = combineMonthly(perHabit).filter((m) => !m.partial)
  const perfectMonth = overall.some((m) => m.due >= 20 && m.rate === 1)
  const winterPerfect = overall.some((m) => ['12', '01', '02'].includes(m.month.slice(5)) && m.due >= 20 && m.rate === 1)
  const quoteKing = perHabit.some((list) => list.some((m) => !m.partial && m.due >= 20 && m.rate === 1))
  const rated = overall.filter((m) => m.rate !== null).slice(-4)
  const trend = rated.length === 4 && rated.every((m, k) => k === 0 || (m.rate ?? 0) > (rated[k - 1].rate ?? 0))

  // Gleichzeitig
  const blooming = plants.filter((i) => i.summary.stage >= 6).length
  const groves = plants.filter((i) => i.summary.health.h >= STAGE_THRESHOLDS[6]).length
  const streak30 = items.filter((i) => i.summary.streaks.current >= 30).length
  const shadowsWon = shadows.filter((i) => i.summary.shadow.status === 4).length

  // Dauer und Besonderes
  const oldest = maxOf(items.map((i) => Math.max(0, diffDays(i.habit.startDate, today))))
  const kaltstart = items.some((i) => i.done.has(i.habit.startDate))
  const doneDates = items.flatMap((i) => [...i.done])
  const christmas = doneDates.some((d) => d.endsWith('-12-24') || d.endsWith('-12-25'))
  const newYear = doneDates.some((d) => d.endsWith('-01-01'))

  // Keine Ausreden: 30 Tage ohne Ausnahme bei mind. 90 % Quote
  const last30 = addDays(today, -29)
  const noExcuses =
    oldest >= 30 &&
    items.length > 0 &&
    !items.some((i) => [...i.excused].some((d) => d >= last30 && d <= today)) &&
    (() => {
      let due = 0
      let hit = 0
      for (const i of items) {
        const r = successRate(i.habit, i.done, today, 30, i.excused)
        if (r) {
          due += r.due
          hit += r.done
        }
      }
      return due > 0 && hit / due >= 0.9
    })()

  const list: Achievement[] = []
  const a = (
    id: string, emoji: string, title: string, description: string,
    category: Category, tier: Tier, value: number, target: number, secret = false,
  ) => {
    list.push({ id, emoji, title, description, category, tier, secret, value: Math.min(value, target), target, achieved: value >= target })
  }

  // Wachstum
  a('keimling', '🌱', 'Erster Keimling', 'Eine Pflanze hat gekeimt.', 'wachstum', 'bronze', peak, 3)
  a('baum', '🌳', 'Erster Baum', 'Eine Pflanze ist zum jungen Baum gewachsen.', 'wachstum', 'silber', peak, 14)
  a('bluete', '🌸', 'In voller Blüte', 'Eine Pflanze blüht – 60 Tage Gesundheit.', 'wachstum', 'gold', peak, 60)
  a('hain', '🌲', 'Erster Hain', 'Um eine Pflanze wächst ein Hain.', 'wachstum', 'gold', peak, 100)
  a('alter-hain', '🏞️', 'Alter Hain', 'Ein Hain ist voll ausgewachsen.', 'wachstum', 'legendaer', peak, 365)
  a('comeback', '🌅', 'Comeback', 'Eine kahle Pflanze wieder zum Busch gebracht.', 'wachstum', 'silber', items.some((i) => i.summary.health.comeback) ? 1 : 0, 1)
  a('phoenix', '🐦‍🔥', 'Phönix', 'Aus kahler Asche bis zum Hain gewachsen.', 'wachstum', 'legendaer', items.some((i) => i.summary.health.phoenix) ? 1 : 0, 1)

  // Serien
  a('serie-7', '🔥', 'Eine Woche dran', '7 Tage in Folge.', 'serien', 'bronze', longest, 7)
  a('serie-30', '⚡', 'Ein Monat dran', '30 Tage in Folge.', 'serien', 'silber', longest, 30)
  a('serie-100', '💯', 'Hundert Tage', '100 Tage in Folge.', 'serien', 'gold', longest, 100)
  a('serie-365', '👑', 'Ein ganzes Jahr', '365 Tage in Folge.', 'serien', 'legendaer', longest, 365)
  a('unaufhaltsam', '🦾', 'Unaufhaltsam', 'Drei Gewohnheiten gleichzeitig 30 Tage in Folge.', 'serien', 'gold', streak30, 3)
  a('woche', '📅', 'Perfekte Woche', 'Eine Woche lang alles Fällige erledigt.', 'serien', 'bronze', weeks, 1)
  a('wochen-10', '🗓️', 'Zehn perfekte Wochen', 'Zehn Wochen ohne einen verpassten Tag.', 'serien', 'gold', weeks, 10)

  // Fleiß
  a('kaltstart', '🚀', 'Kaltstart', 'Eine neue Gewohnheit gleich am ersten Tag erledigt.', 'fleiss', 'bronze', kaltstart ? 1 : 0, 1)
  a('perfekter-tag', '🌟', 'Perfekter Tag', 'An einem Tag alles erledigt (mindestens drei).', 'fleiss', 'bronze', perfectDays, 1)
  a('perfekte-tage-30', '✨', 'Dreißig perfekte Tage', '30 Tage, an denen alles erledigt war.', 'fleiss', 'silber', perfectDays, 30)
  a('doppelpack', '💪', 'Doppelpack', 'Fünf Gewohnheiten an einem Tag erledigt.', 'fleiss', 'bronze', maxDoneInDay, 5)
  a('zehnkampf', '🏋️', 'Zehnkampf', 'Zehn Gewohnheiten an einem Tag erledigt.', 'fleiss', 'gold', maxDoneInDay, 10)
  a('haken-100', '✅', '100 Haken', '100 erledigte Tage insgesamt.', 'fleiss', 'bronze', total, 100)
  a('haken-1000', '🏅', '1000 Haken', '1000 erledigte Tage insgesamt.', 'fleiss', 'gold', total, 1000)
  a('aktiv-100', '📍', 'Hundert aktive Tage', 'An 100 Tagen mindestens etwas erledigt.', 'fleiss', 'silber', activeDays, 100)
  a('aktiv-365', '🌍', 'Ein Jahr aktiv', 'An 365 Tagen mindestens etwas erledigt.', 'fleiss', 'legendaer', activeDays, 365)
  a('fruehaufsteher', '🐦', 'Frühaufsteher', '10 Haken vor 7 Uhr morgens.', 'fleiss', 'silber', ctx.ticks.early, 10)
  a('nachteule', '🦉', 'Nachteule', '10 Haken nach 23 Uhr.', 'fleiss', 'silber', ctx.ticks.late, 10)

  // Quote
  a('keine-ausreden', '🗿', 'Keine Ausreden', '30 Tage ohne Ausnahme bei mindestens 90 % Quote.', 'quote', 'silber', noExcuses ? 1 : 0, 1)
  a('aufwaertstrend', '📈', 'Aufwärtstrend', 'Die Monatsquote ist dreimal in Folge gestiegen.', 'quote', 'silber', trend ? 1 : 0, 1)
  a('quotenkoenig', '👑', 'Quotenkönig', 'Eine Gewohnheit einen ganzen Monat lang zu 100 %.', 'quote', 'gold', quoteKing ? 1 : 0, 1)
  a('perfekter-monat', '🥇', 'Perfekter Monat', 'Ein ganzer Monat mit 100 % über alle Gewohnheiten.', 'quote', 'gold', perfectMonth ? 1 : 0, 1)
  a('winterhart', '❄️', 'Winterhart', 'Ein Wintermonat mit 100 % über alle Gewohnheiten.', 'quote', 'gold', winterPerfect ? 1 : 0, 1)

  // Schatten-Ich
  a('standhaft', '🛡️', 'Standhaft', 'Den Schatten zurückgedrängt.', 'schatten', 'silber', bestShadow >= 3 ? 1 : 0, 1)
  a('schatten-besiegt', '⚔️', 'Schatten besiegt', 'Das ganze Land gehört dir.', 'schatten', 'gold', bestShadow >= 4 ? 1 : 0, 1)
  a('dunkelheit', '🌑', 'Aus der Dunkelheit', 'Von „Er herrscht“ zurück zu „Dein Land“.', 'schatten', 'legendaer', journeys.some((j) => j.fromDarkness) ? 1 : 0, 1)
  a('schattenjaeger', '🗡️', 'Schattenjäger', 'Drei Schatten gleichzeitig besiegt.', 'schatten', 'gold', shadowsWon, 3)

  // Garten & Tagebuch
  a('gaertner', '🧑‍🌾', 'Gärtner', 'Fünf Gewohnheiten gleichzeitig.', 'garten', 'bronze', items.length, 5)
  a('grossgrund', '🏡', 'Großer Garten', 'Zehn Gewohnheiten gleichzeitig.', 'garten', 'gold', items.length, 10)
  a('artenvielfalt', '🌈', 'Artenvielfalt', 'Vier verschiedene Pflanzenarten im Garten.', 'garten', 'silber', species, 4)
  a('botaniker', '🌺', 'Botaniker', `Alle ${SPECIES_KEYS.length} Pflanzenarten im Garten.`, 'garten', 'gold', species, SPECIES_KEYS.length)
  a('bluetenmeer', '💐', 'Blütenmeer', 'Drei Pflanzen blühen gleichzeitig.', 'garten', 'silber', blooming, 3)
  a('wald', '🌲', 'Wald', 'Drei Haine gleichzeitig.', 'garten', 'gold', groves, 3)
  a('halbjahr', '🎂', 'Halbes Jahr', 'Eine Gewohnheit seit einem halben Jahr.', 'garten', 'silber', oldest, 182)
  a('jahrestag', '📆', 'Jahrestag', 'Eine Gewohnheit seit einem Jahr.', 'garten', 'gold', oldest, 365)
  a('tagebuch', '📝', 'Tagebuch', 'Sieben Tagesnotizen geschrieben.', 'garten', 'bronze', ctx.notes, 7)
  a('chronist', '✍️', 'Chronist', '30 Tagesnotizen geschrieben.', 'garten', 'silber', ctx.notes, 30)
  a('memoiren', '📜', 'Memoiren', '100 Tagesnotizen geschrieben.', 'garten', 'gold', ctx.notes, 100)
  a('backup', '💾', 'Auf Nummer sicher', 'Ein Backup exportiert.', 'garten', 'bronze', ctx.backedUp ? 1 : 0, 1)

  // Geheim
  a('geisterstunde', '🕛', 'Geisterstunde', 'Zwischen Mitternacht und 1 Uhr abgehakt.', 'geheim', 'gold', ctx.ticks.ghost ? 1 : 0, 1, true)
  a('weihnachten', '🎄', 'Fest der Disziplin', 'An Heiligabend oder Weihnachten drangeblieben.', 'geheim', 'gold', christmas ? 1 : 0, 1, true)
  a('neujahr', '🎆', 'Vorsatz gehalten', 'Am Neujahrstag drangeblieben.', 'geheim', 'gold', newYear ? 1 : 0, 1, true)

  return list
}

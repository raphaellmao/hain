/**
 * Erfolge (Abzeichen). Wie alles andere werden sie nicht gespeichert, sondern
 * aus der Historie berechnet – nachträgliche Korrekturen wirken also sofort.
 * Nur „schon gesehen“ merkt sich die App (für den Hinweis beim Freischalten).
 */
import { type DateStr, addDays, eachDay, startOfWeek } from './dates'
import { isDue } from './schedule'
import { bestShadowStatus } from './shadow'
import { totalDone } from './stats'
import type { HabitSummary } from './summary'
import type { DoneSet, Habit } from './types'
import { speciesOf } from './species'

export interface AchievementInput {
  habit: Habit
  done: DoneSet
  excused: DoneSet
  summary: HabitSummary
}

export interface Achievement {
  id: string
  emoji: string
  title: string
  description: string
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
}

const maxOf = (xs: number[]) => (xs.length ? Math.max(...xs) : 0)

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
        if (!isDue(i.habit, d) || (i.excused.has(d) && !i.done.has(d))) continue
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
  const peak = maxOf(ctx.items.map((i) => i.summary.health.peak))
  const longest = maxOf(ctx.items.map((i) => i.summary.streaks.longest))
  const total = ctx.items.reduce((n, i) => n + totalDone(i.habit, i.done, ctx.today), 0)
  const shadows = ctx.items.filter((i) => i.habit.metaphor === 'schatten')
  const bestShadow = maxOf(shadows.map((i) => bestShadowStatus(i.habit, i.done, ctx.today, i.excused)))
  const species = new Set(ctx.items.filter((i) => i.habit.metaphor !== 'schatten').map((i) => speciesOf(i.habit))).size
  const comeback = ctx.items.some((i) => i.summary.health.comeback)
  const weeks = perfectWeeks(ctx)

  const a = (id: string, emoji: string, title: string, description: string, value: number, target: number): Achievement => ({
    id, emoji, title, description, value: Math.min(value, target), target, achieved: value >= target,
  })

  return [
    a('keimling', '🌱', 'Erster Keimling', 'Eine Pflanze hat gekeimt.', peak, 3),
    a('baum', '🌳', 'Erster Baum', 'Eine Pflanze ist zum jungen Baum gewachsen.', peak, 14),
    a('bluete', '🌸', 'In voller Blüte', 'Eine Pflanze blüht – 60 Tage Gesundheit.', peak, 60),
    a('hain', '🌲', 'Erster Hain', 'Um eine Pflanze wächst ein Hain.', peak, 100),
    a('alter-hain', '🏞️', 'Alter Hain', 'Ein Hain ist voll ausgewachsen.', peak, 365),
    a('serie-7', '🔥', 'Eine Woche dran', '7 Tage in Folge.', longest, 7),
    a('serie-30', '⚡', 'Ein Monat dran', '30 Tage in Folge.', longest, 30),
    a('serie-100', '💯', 'Hundert Tage', '100 Tage in Folge.', longest, 100),
    a('serie-365', '👑', 'Ein ganzes Jahr', '365 Tage in Folge.', longest, 365),
    a('haken-100', '✅', '100 Haken', '100 erledigte Tage insgesamt.', total, 100),
    a('haken-1000', '🏅', '1000 Haken', '1000 erledigte Tage insgesamt.', total, 1000),
    a('woche', '📅', 'Perfekte Woche', 'Eine Woche lang alles Fällige erledigt.', weeks, 1),
    a('wochen-10', '🗓️', 'Zehn perfekte Wochen', 'Zehn Wochen ohne einen verpassten Tag.', weeks, 10),
    a('comeback', '🌅', 'Comeback', 'Eine kahle Pflanze wieder zum Busch gebracht.', comeback ? 1 : 0, 1),
    a('standhaft', '🛡️', 'Standhaft', 'Den Schatten zurückgedrängt.', bestShadow >= 3 ? 1 : 0, 1),
    a('schatten-besiegt', '⚔️', 'Schatten besiegt', 'Das ganze Land gehört dir.', bestShadow >= 4 ? 1 : 0, 1),
    a('artenvielfalt', '🌈', 'Artenvielfalt', 'Vier verschiedene Pflanzenarten im Garten.', species, 4),
    a('gaertner', '🧑‍🌾', 'Gärtner', 'Fünf Gewohnheiten gleichzeitig.', ctx.items.length, 5),
    a('tagebuch', '📝', 'Tagebuch', 'Sieben Tagesnotizen geschrieben.', ctx.notes, 7),
    a('backup', '💾', 'Auf Nummer sicher', 'Ein Backup exportiert.', ctx.backedUp ? 1 : 0, 1),
  ]
}

/**
 * Demo-Daten (nur Entwicklung): legt Habits mit unterschiedlicher
 * Vorgeschichte an, damit man alle Baumstufen im Garten sieht.
 * Aufruf in der Browser-Konsole: await hainDemo()
 * Fügt nur hinzu – vorhandene Daten bleiben unangetastet.
 */
import { db } from '../db/schema'
import { addDays, logicalToday, weekday, type DateStr } from '../domain/dates'
import { ALL_DAYS } from '../domain/schedule'
import type { Checkin, Habit } from '../domain/types'
import type { ColorKey } from '../domain/colors'

interface DemoSpec {
  name: string
  emoji: string
  color: ColorKey
  days: number[]
  /** Tage seit Start */
  age: number
  /** ob Tag i (0 = Starttag) erledigt ist */
  done: (i: number, date: DateStr) => boolean
}

export async function hainDemo() {
  const today = logicalToday(new Date(), 0)
  const specs: DemoSpec[] = [
    { name: 'Lesen', emoji: '📖', color: 'koralle', days: ALL_DAYS, age: 95, done: (i) => i % 23 !== 5 },
    { name: 'Laufen', emoji: '🏃', color: 'blau', days: [1, 3, 5], age: 70, done: () => true },
    { name: 'Wasser trinken', emoji: '💧', color: 'tuerkis', days: ALL_DAYS, age: 19, done: () => true },
    { name: 'Meditieren', emoji: '🧘', color: 'flieder', days: ALL_DAYS, age: 45, done: (i) => i < 43 },
    { name: 'Zahnseide', emoji: '🦷', color: 'rosa', days: ALL_DAYS, age: 5, done: () => true },
    { name: 'Vokabeln', emoji: '🗣️', color: 'gold', days: ALL_DAYS, age: 42, done: (i) => i < 32 },
    { name: 'Handyfrei', emoji: '📵', color: 'apricot', days: ALL_DAYS, age: 1, done: (i) => i === 0 },
  ]

  const now = Date.now()
  const maxOrder = (await db.habits.orderBy('order').last())?.order ?? 0
  const habits: Habit[] = []
  const checkins: Checkin[] = []

  specs.forEach((s, idx) => {
    const id = `demo-${idx + 1}` // feste IDs, damit Detail-URLs reproduzierbar sind
    const startDate = addDays(today, -s.age)
    habits.push({
      id,
      name: s.name,
      emoji: s.emoji,
      color: s.color,
      schedule: [{ from: startDate, days: s.days }],
      startDate,
      seed: 1000 + idx * 97,
      order: maxOrder + idx + 1,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    })
    for (let i = 0; i < s.age; i++) {
      const date = addDays(startDate, i)
      if (!s.days.includes(weekday(date))) continue
      if (s.done(i, date)) checkins.push({ id: `${id}_${date}`, habitId: id, date, done: true, updatedAt: now })
    }
  })

  await db.transaction('rw', db.habits, db.checkins, async () => {
    await db.habits.bulkAdd(habits)
    await db.checkins.bulkAdd(checkins)
  })
  return `${habits.length} Habits, ${checkins.length} Einträge angelegt`
}

/** Demo-Daten nur anlegen, wenn noch gar keine Habits existieren. */
export async function hainDemoIfEmpty() {
  if ((await db.habits.count()) === 0) await hainDemo()
}

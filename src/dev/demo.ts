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
import type { SpeciesKey } from '../domain/species'

interface DemoSpec {
  name: string
  emoji: string
  color: ColorKey
  species: SpeciesKey
  metaphor?: 'schatten'
  days: number[]
  /** Tage seit Start */
  age: number
  /** ob Tag i (0 = Starttag) erledigt ist */
  done: (i: number, date: DateStr) => boolean
}

export async function hainDemo() {
  const today = logicalToday(new Date(), 0)
  const specs: DemoSpec[] = [
    { name: 'Lesen', emoji: '📖', color: 'koralle', species: 'laubbaum', days: ALL_DAYS, age: 400, done: (i) => i % 61 !== 5 },
    { name: 'Laufen', emoji: '🏃', color: 'blau', species: 'tanne', days: [1, 3, 5], age: 330, done: () => true },
    { name: 'Wasser trinken', emoji: '💧', color: 'tuerkis', species: 'birke', days: ALL_DAYS, age: 19, done: () => true },
    { name: 'Meditieren', emoji: '🧘', color: 'flieder', species: 'kirsche', days: ALL_DAYS, age: 75, done: (i) => i < 73 },
    { name: 'Zahnseide', emoji: '🦷', color: 'rosa', species: 'weide', days: ALL_DAYS, age: 5, done: () => true },
    { name: 'Vokabeln', emoji: '🗣️', color: 'gold', species: 'apfel', days: ALL_DAYS, age: 42, done: (i) => i < 32 },
    { name: 'Handyfrei', emoji: '📵', color: 'apricot', species: 'sonnenblume', days: ALL_DAYS, age: 1, done: (i) => i === 0 },
    { name: 'Gitarre', emoji: '🎸', color: 'weinrot', species: 'kaktus', days: ALL_DAYS, age: 90, done: () => true },
    { name: 'Spazieren', emoji: '🚶', color: 'gold', species: 'sonnenblume', days: ALL_DAYS, age: 70, done: () => true },
    { name: 'Dehnen', emoji: '🤸', color: 'rosa', species: 'apfel', days: ALL_DAYS, age: 160, done: () => true },
    // Schatten-Ich in drei Lagen: gewonnen, umkämpft, fast verloren
    { name: 'Sport', emoji: '💪', color: 'blau', species: 'laubbaum', metaphor: 'schatten', days: ALL_DAYS, age: 40, done: () => true },
    { name: 'Früh aufstehen', emoji: '☀️', color: 'gold', species: 'laubbaum', metaphor: 'schatten', days: ALL_DAYS, age: 30, done: (i) => i < 20 || i % 3 === 0 },
    { name: 'Kein Social Media', emoji: '📵', color: 'tuerkis', species: 'laubbaum', metaphor: 'schatten', days: ALL_DAYS, age: 30, done: (i) => i < 22 },
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
      species: s.species,
      ...(s.metaphor ? { metaphor: s.metaphor } : {}),
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

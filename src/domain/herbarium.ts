/**
 * Herbarium: welche Arten schon einmal zur Blüte gebracht wurden (H ≥ 60 erreicht,
 * auch wenn die Pflanze inzwischen welkt oder im Archiv liegt) und welche seltenen
 * Mutationen schon im Garten standen (ab dem Busch). Alles aus der Historie berechnet.
 */
import { type MutationKey, mutationOf } from './mutation'
import { type SpeciesKey, speciesOf } from './species'
import type { HabitSummary } from './summary'
import type { Habit } from './types'

/** Ab dieser Gesundheit blüht eine Pflanze (Stufe „Blühend“) */
export const BLOOM_H = 60
/** Ab dieser Gesundheit zählt eine Mutation als entdeckt (Busch) */
export const BUSH_H = 7

export interface Herbarium {
  /** Art → Gewohnheit, die sie zur Blüte gebracht hat (die mit der höchsten Spitze) */
  bloomed: Map<SpeciesKey, Habit>
  mutations: Map<MutationKey, Habit>
}

export function herbariumOf(items: { habit: Habit; summary: HabitSummary }[]): Herbarium {
  const bloomed = new Map<SpeciesKey, { habit: Habit; peak: number }>()
  const mutations = new Map<MutationKey, Habit>()
  for (const { habit, summary } of items) {
    if (habit.metaphor === 'schatten') continue
    const peak = summary.health.peak
    const sp = speciesOf(habit)
    if (peak >= BLOOM_H && peak > (bloomed.get(sp)?.peak ?? -1)) bloomed.set(sp, { habit, peak })
    const m = mutationOf(habit.seed)
    if (m && peak >= BUSH_H && !mutations.has(m)) mutations.set(m, habit)
  }
  return { bloomed: new Map([...bloomed].map(([k, v]) => [k, v.habit])), mutations }
}

/**
 * Seltene Mutationen: Etwa jede 16. Pflanze trägt eine besondere Laubfarbe. Ob, und
 * welche, steht allein im Seed – also fest für jede Pflanze, nichts zu tun, nur zu
 * entdecken. Gespeichert wird nichts (palette.ts färbt, Herbarium sammelt).
 */
export type MutationKey = 'goldlaub' | 'silberlaub' | 'nachtlaub' | 'feuerlaub' | 'regenbogenlaub'

export const MUTATIONS: Record<MutationKey, { label: string; emoji: string; description: string }> = {
  goldlaub: { label: 'Goldlaub', emoji: '🪙', description: 'Blätter wie aus Gold.' },
  silberlaub: { label: 'Silberlaub', emoji: '🥈', description: 'Fast weiße, silbrig schimmernde Blätter.' },
  nachtlaub: { label: 'Nachtlaub', emoji: '🌌', description: 'Tiefviolettes Laub wie der Nachthimmel.' },
  feuerlaub: { label: 'Feuerlaub', emoji: '🔥', description: 'Glutrotes Laub, das ganze Jahr.' },
  regenbogenlaub: { label: 'Regenbogenlaub', emoji: '🌈', description: 'Jedes Blatt in einer anderen Farbe.' },
}

export const MUTATION_KEYS = Object.keys(MUTATIONS) as MutationKey[]

/** Wie selten: 1 von RARITY Pflanzen */
export const RARITY = 16

/** Mutation einer Pflanze aus ihrem Seed (null = keine) */
export function mutationOf(seed: number): MutationKey | null {
  const h = Math.imul((seed ^ 0x5bd1e995) >>> 0, 0x27d4eb2d) >>> 0
  if (h % RARITY !== 7) return null
  return MUTATION_KEYS[(h >>> 8) % MUTATION_KEYS.length]
}

/** Ein Seed mit genau dieser Mutation (für Vorschauen im Herbarium) */
export function seedWith(key: MutationKey, from = 1): number {
  for (let s = from; s < from + 100000; s++) if (mutationOf(s) === key) return s
  return from
}

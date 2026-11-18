import { describe, expect, it } from 'vitest'
import { MUTATION_KEYS, RARITY, mutationOf, seedWith } from './mutation'

describe('Seltene Mutationen', () => {
  it('sind selten (etwa 1 von 16) und alle Arten kommen vor', () => {
    const counts = new Map<string, number>()
    let total = 0
    for (let s = 1; s <= 20000; s++) {
      const m = mutationOf(s)
      if (m) {
        total++
        counts.set(m, (counts.get(m) ?? 0) + 1)
      }
    }
    expect(total / 20000).toBeGreaterThan(1 / RARITY / 1.4)
    expect(total / 20000).toBeLessThan((1 / RARITY) * 1.4)
    for (const k of MUTATION_KEYS) expect(counts.get(k) ?? 0, k).toBeGreaterThan(50)
  })

  it('stehen fest im Seed', () => {
    expect(mutationOf(1234)).toBe(mutationOf(1234))
    for (const k of MUTATION_KEYS) expect(mutationOf(seedWith(k))).toBe(k)
  })
})

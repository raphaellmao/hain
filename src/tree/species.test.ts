import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { generateTree, leafVisible, plantModel } from './generate'
import { SPECIES_KEYS } from '../domain/species'
import { growthOf } from '../domain/health'

/**
 * Fingerabdrücke des ursprünglichen Laubbaums (vor Einführung der Arten,
 * 20.10.2026). Ändern sie sich, sähen bestehende Bäume der Nutzer anders aus.
 */
const LAUBBAUM_SNAPSHOT: Record<number, string> = {
  11: 'b38f69aa304a80b0',
  77: 'cbd2f5a75381743b',
  1000: '6d61e1515a14c606',
  1097: '124aa2af5d57447c',
  2024: '7fbbd0d637e90df5',
  123456789: '73a389a27e4db358',
}

/** Nur die Felder, die es damals schon gab – in der damaligen Reihenfolge */
function legacyView(seed: number) {
  const m = generateTree(seed)
  return {
    branches: m.branches.map((b) => ({ id: b.id, d: b.d, width: b.width, depth: b.depth, start: b.start, span: b.span })),
    leaves: m.leaves.map((l) => ({
      id: l.id, x: l.x, y: l.y, d: l.d, angle: l.angle, size: l.size, shade: l.shade, appear: l.appear, vanish: l.vanish,
    })),
    blossoms: m.blossoms.map((b) => ({ id: b.id, x: b.x, y: b.y, d: b.d, size: b.size, rot: b.rot, shade: b.shade, appear: b.appear })),
    flare: m.flare,
  }
}

describe('Pflanzenarten', () => {
  it('der Laubbaum sieht exakt aus wie vor dem Umbau', () => {
    for (const [seed, hash] of Object.entries(LAUBBAUM_SNAPSHOT)) {
      const h = createHash('sha256').update(JSON.stringify(legacyView(Number(seed)))).digest('hex').slice(0, 16)
      expect(h, `Seed ${seed}`).toBe(hash)
    }
  })

  it('jede Art wächst Tag für Tag sichtbar und bleibt in der Bildfläche', () => {
    for (const species of SPECIES_KEYS) {
      for (const seed of [1, 42, 9001]) {
        const m = plantModel(species, seed)
        const visible = (h: number) => {
          const g = growthOf(h)
          return (
            m.leaves.filter((l) => leafVisible(l, g)).length +
            m.blossoms.filter((b) => b.appear <= g).length +
            m.branches.filter((b) => b.start < g).length
          )
        }
        // In jeder Stufe ab dem Busch kommt etwas dazu
        for (const [a, b] of [[7, 14], [14, 30], [30, 60], [60, 100]]) {
          expect(visible(b), `${species}/${seed}: H ${a}→${b}`).toBeGreaterThan(visible(a))
        }
        // Mit voller Blüte sind Blüten/Früchte da
        expect(m.blossoms.filter((b) => b.appear <= 7).length, `${species}/${seed} Blüten`).toBeGreaterThan(10)
        // Alles Wichtige liegt in der viewBox (etwas Rand erlaubt)
        for (const l of m.leaves) {
          expect(l.x, `${species} x`).toBeGreaterThan(-10)
          expect(l.x, `${species} x`).toBeLessThan(210)
          expect(l.y, `${species} y`).toBeGreaterThan(-10)
          expect(l.y, `${species} y`).toBeLessThan(185)
        }
      }
    }
  })
})

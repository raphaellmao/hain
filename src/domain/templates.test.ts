import { describe, expect, it } from 'vitest'
import { COLOR_KEYS } from './colors'
import { HABIT_TEMPLATES, templateById, templateHint } from './templates'

describe('Vorlagen', () => {
  it('sind alle gültig und eindeutig', () => {
    const ids = new Set<string>()
    for (const t of HABIT_TEMPLATES) {
      expect(ids.has(t.id), t.id).toBe(false)
      ids.add(t.id)
      expect(/^[a-z]+$/.test(t.id), `${t.id}: nur Kleinbuchstaben, steht in der URL`).toBe(true)
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.name.length).toBeLessThanOrEqual(40)
      expect(COLOR_KEYS).toContain(t.color)
      expect(t.days.length).toBeGreaterThan(0)
      expect(t.days.every((d) => d >= 0 && d <= 6)).toBe(true)
      if (t.goal) {
        expect(t.goal.target).toBeGreaterThan(0)
        expect(t.goal.step).toBeGreaterThan(0)
        if (t.goal.kind === 'menge') expect(t.goal.unit.length).toBeGreaterThan(0)
      }
    }
  })

  it('findet per ID und beschreibt kurz', () => {
    expect(templateById('wasser')?.name).toBe('Wasser trinken')
    expect(templateById('gibtsnicht')).toBeUndefined()
    expect(templateById(undefined)).toBeUndefined()
    expect(templateHint(templateById('wasser')!)).toBe('8 Gläser · täglich')
    expect(templateHint(templateById('laufen')!)).toBe('30 min · Mo, Mi, Fr')
    expect(templateHint(templateById('frueh')!)).toBe('abhaken · Mo–Fr')
  })
})

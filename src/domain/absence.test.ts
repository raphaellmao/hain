import { describe, expect, it } from 'vitest'
import { absenceProblem, appliesTo, covers, endedEarly, formatRange, lengthOf, phaseOf, sortAbsences } from './absence'
import { ownExcuses, reasonInfo, isExcuseReason, EXCUSE_REASONS, ABSENCE_REASONS } from './excuse'

const a = (from: string, to: string, habitIds?: string[]) => ({ from, to, habitIds })

describe('Abwesenheit', () => {
  it('gilt für alle oder nur für ausgewählte Gewohnheiten', () => {
    expect(appliesTo(a('2026-11-03', '2026-11-14'), 'x')).toBe(true)
    expect(appliesTo(a('2026-11-03', '2026-11-14', ['y']), 'x')).toBe(false)
    expect(appliesTo(a('2026-11-03', '2026-11-14', ['x']), 'x')).toBe(true)
  })

  it('umfasst Anfang und Ende', () => {
    const v = a('2026-11-03', '2026-11-14')
    expect(covers(v, '2026-11-03')).toBe(true)
    expect(covers(v, '2026-11-14')).toBe(true)
    expect(covers(v, '2026-11-15')).toBe(false)
    expect(lengthOf(v)).toBe(12)
  })

  it('prüft die Eingabe', () => {
    expect(absenceProblem('2026-11-03', '2026-11-03')).toBeNull()
    expect(absenceProblem('2026-11-03', '2026-11-02')).toMatch(/vor dem Anfang/)
    expect(absenceProblem('2026-01-01', '2027-01-02')).toMatch(/Jahr/)
  })

  it('schreibt Zeiträume kurz', () => {
    expect(formatRange('2026-11-03', '2026-11-03')).toBe('3. Nov.')
    expect(formatRange('2026-11-03', '2026-11-14')).toBe('3.–14. Nov.')
    expect(formatRange('2026-10-28', '2026-11-03')).toBe('28. Okt. – 3. Nov.')
  })

  it('weiß, ob sie geplant ist, läuft oder vorbei ist, und sortiert danach', () => {
    const today = '2026-11-06'
    expect(phaseOf(a('2026-11-07', '2026-11-09'), today)).toBe('geplant')
    expect(phaseOf(a('2026-11-06', '2026-11-06'), today)).toBe('laeuft')
    expect(phaseOf(a('2026-11-01', '2026-11-05'), today)).toBe('vorbei')
    const sorted = sortAbsences([a('2026-10-01', '2026-10-02'), a('2026-12-01', '2026-12-02'), a('2026-11-05', '2026-11-08'), a('2026-11-20', '2026-11-21'), a('2026-10-20', '2026-10-21')], today)
    expect(sorted.map((x) => x.from)).toEqual(['2026-11-05', '2026-11-20', '2026-12-01', '2026-10-20', '2026-10-01'])
  })

  it('früher zurück: endet gestern, oder fällt ganz weg', () => {
    const today = '2026-11-06'
    expect(endedEarly(a('2026-11-01', '2026-11-14'), today)).toEqual({ to: '2026-11-05' })
    expect(endedEarly(a('2026-11-06', '2026-11-14'), today)).toBeNull() // erst heute begonnen
    expect(endedEarly(a('2026-11-10', '2026-11-14'), today)).toBeNull() // noch gar nicht begonnen
    expect(endedEarly(a('2026-11-01', '2026-11-03'), today)).toEqual({ to: '2026-11-03' }) // schon vorbei
  })
})

describe('Gründe', () => {
  it('Urlaub und Lehrgang gibt es nur für Abwesenheiten, das Blatt bleibt bei sechs', () => {
    expect(EXCUSE_REASONS).toHaveLength(6)
    expect(ABSENCE_REASONS.map((r) => r.key)).toContain('urlaub')
    expect(ABSENCE_REASONS.map((r) => r.key)).toContain('lehrgang')
    expect(reasonInfo('urlaub').label).toBe('Urlaub')
    expect(isExcuseReason('lehrgang')).toBe(true)
    expect(isExcuseReason('quatsch')).toBe(false)
  })

  it('zählt für „Ausnahmen in den letzten 30 Tagen“ nur eigene, keine Abwesenheit', () => {
    const days = new Map([
      ['2026-11-01', { reason: 'krank' as const }],
      ['2026-11-02', { reason: 'urlaub' as const, absenceId: 'a' }],
    ])
    expect([...ownExcuses(days)]).toEqual(['2026-11-01'])
  })
})

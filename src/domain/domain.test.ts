import { describe, expect, it } from 'vitest'
import { addDays, diffDays, eachDay, logicalToday, shiftMonth, weekday, weekdayMon0, startOfWeek } from './dates'
import { ALL_DAYS, daysAt, describeDays, isDue, withNewDays } from './schedule'
import { computeStreaks } from './streaks'
import { computeHealth, growthOf, healthOfGrowth, nextStage, stageOf, H_MAX } from './health'
import { successRate, dayState } from './stats'
import type { ScheduleVersion } from './types'

/** Habit-Stub: täglich ab Startdatum */
const daily = (startDate: string, schedule: ScheduleVersion[] = [{ from: startDate, days: ALL_DAYS }]) => ({
  startDate,
  schedule,
})

/** n Tage ab `from` als erledigt */
const run = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i))

describe('dates', () => {
  it('rechnet über Monats-, Jahres- und Sommerzeitgrenzen', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26') // Zeitumstellung 25.10.
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2)
    expect([...eachDay('2026-10-30', '2026-11-02')]).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })

  it('kennt Wochentage', () => {
    expect(weekday('2026-10-12')).toBe(1) // Montag
    expect(weekdayMon0('2026-10-18')).toBe(6) // Sonntag
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12')
  })

  it('verschiebt Monate', () => {
    expect(shiftMonth('2026-10', 1)).toBe('2026-11')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('verschiebt den Tageswechsel', () => {
    const halbZwei = new Date(2026, 9, 13, 1, 30)
    expect(logicalToday(halbZwei, 0)).toBe('2026-10-13')
    expect(logicalToday(halbZwei, 3)).toBe('2026-10-12')
  })
})

describe('schedule', () => {
  const schedule: ScheduleVersion[] = [
    { from: '2026-10-01', days: ALL_DAYS },
    { from: '2026-10-10', days: [1, 3, 5] }, // ab 10.10.: Mo, Mi, Fr
  ]

  it('nimmt die zum Datum gültige Version', () => {
    expect(daysAt(schedule, '2026-10-05')).toEqual(ALL_DAYS)
    expect(daysAt(schedule, '2026-10-10')).toEqual([1, 3, 5])
  })

  it('ist vor dem Start nie fällig', () => {
    const h = { startDate: '2026-10-05', schedule }
    expect(isDue(h, '2026-10-04')).toBe(false)
    expect(isDue(h, '2026-10-06')).toBe(true) // Di, noch täglich
    expect(isDue(h, '2026-10-13')).toBe(false) // Di, jetzt nur Mo/Mi/Fr
    expect(isDue(h, '2026-10-14')).toBe(true) // Mi
  })

  it('ersetzt bei mehrfacher Änderung am selben Tag die Version', () => {
    const once = withNewDays(schedule, [1, 2], '2026-10-12')
    const twice = withNewDays(once, [6], '2026-10-12')
    expect(twice).toHaveLength(3)
    expect(twice[2]).toEqual({ from: '2026-10-12', days: [6] })
    expect(withNewDays(schedule, [5, 3, 1], '2026-10-12')).toBe(schedule) // unverändert
  })

  it('beschreibt Wochentage', () => {
    expect(describeDays(ALL_DAYS)).toBe('Täglich')
    expect(describeDays([1, 2, 3, 4, 5])).toBe('Mo–Fr')
    expect(describeDays([0, 6])).toBe('Wochenende')
    expect(describeDays([5, 1, 3])).toBe('Mo, Mi, Fr')
  })
})

describe('streaks', () => {
  const today = '2026-10-12'

  it('zählt die laufende Serie, heute offen bricht nichts', () => {
    const done = new Set(run('2026-10-07', 5)) // 7.–11.
    expect(computeStreaks(daily('2026-10-01'), done, today)).toEqual({ current: 5, longest: 5 })
  })

  it('ein verpasster Tag bricht die Serie, die längste bleibt', () => {
    const done = new Set([...run('2026-10-01', 6), ...run('2026-10-09', 4)]) // 1.–6., 9.–12.
    expect(computeStreaks(daily('2026-10-01'), done, today)).toEqual({ current: 4, longest: 6 })
  })

  it('nicht fällige Tage sind neutral, erledigte Bonustage zählen', () => {
    // Mo–Fr, Wochenende 10./11.10. nicht erledigt
    const h = daily('2026-10-05', [{ from: '2026-10-05', days: [1, 2, 3, 4, 5] }])
    const done = new Set(run('2026-10-05', 5)) // Mo–Fr
    expect(computeStreaks(h, done, today).current).toBe(5)
    done.add('2026-10-11') // Sonntag trotzdem erledigt
    expect(computeStreaks(h, done, today).current).toBe(6)
  })
})

describe('health', () => {
  it('wächst um 1 pro erledigtem Tag', () => {
    const done = new Set(run('2026-10-01', 10))
    const r = computeHealth(daily('2026-10-01'), done, '2026-10-10')
    expect(r.h).toBe(10)
    expect(r.wilted).toBe(false)
  })

  it('erster Fehltag: welk und −1, danach halbieren', () => {
    const start = '2026-01-01'
    const done = new Set(run(start, 20))
    const h = daily(start)
    expect(computeHealth(h, done, '2026-01-21').h).toBe(20) // 21. noch offen
    const one = computeHealth(h, done, '2026-01-22') // 21. verpasst
    expect(one).toMatchObject({ h: 19, missRun: 1, wilted: true })
    expect(computeHealth(h, done, '2026-01-23').h).toBe(9.5)
    expect(computeHealth(h, done, '2026-01-24').h).toBe(4.75)
  })

  it('blühender Baum (60) ist nach 7 Fehltagen kahl', () => {
    const start = '2026-01-01'
    const done = new Set(run(start, 60))
    const h = daily(start)
    const before = computeHealth(h, done, addDays(start, 60))
    expect(before.h).toBe(60)
    expect(stageOf(before.h)).toBe(6)
    const stages = [1, 2, 3, 4, 5, 6, 7].map((miss) => computeHealth(h, done, addDays(start, 60 + miss)))
    // 59 → 29,5 → 14,75 → 7,4 → 3,7 → 1,8 → 0,9
    expect(stages.map((s) => stageOf(s.h))).toEqual([5, 4, 4, 3, 2, 1, 0])
    expect(stages[6].dormant).toBe(true)
    expect(stages[5].dormant).toBe(false)
  })

  it('erholt sich von dort aus, nicht von null', () => {
    const start = '2026-01-01'
    // 30 Tage erledigt, 2 verpasst (→ 29 → 14,5), dann wieder erledigt
    const done = new Set([...run(start, 30), ...run(addDays(start, 32), 3)])
    const r = computeHealth(daily(start), done, addDays(start, 34))
    expect(r.h).toBe(17.5)
    expect(r.wilted).toBe(false)
  })

  it('jeder zweite Tag verpasst = Stillstand', () => {
    const start = '2026-01-01'
    const done = new Set(Array.from({ length: 20 }, (_, i) => addDays(start, i * 2)))
    // pendelt zwischen 1 (nach Erledigung) und 0 (nach Fehltag)
    expect(computeHealth(daily(start), done, addDays(start, 39)).h).toBe(1)
    expect(computeHealth(daily(start), done, addDays(start, 40)).h).toBe(0)
  })

  it('wird bei H_MAX (365) gedeckelt', () => {
    const done = new Set(run('2025-01-01', 400))
    expect(H_MAX).toBe(365)
    expect(computeHealth(daily('2025-01-01'), done, addDays('2025-01-01', 400)).h).toBe(H_MAX)
  })

  it('voller Hain (365) ist nach 10 Fehltagen kahl', () => {
    const start = '2025-01-01'
    const done = new Set(run(start, 400))
    const h = daily(start)
    const after = (miss: number) => computeHealth(h, done, addDays(start, 400 + miss))
    expect(stageOf(after(0).h)).toBe(9)
    expect(after(9).dormant).toBe(false)
    expect(after(10).dormant).toBe(true)
  })

  it('Fehltage zählen nur an fälligen Tagen', () => {
    // nur montags fällig, 4 Montage erledigt, dazwischen nichts
    const h = daily('2026-10-05', [{ from: '2026-10-05', days: [1] }])
    const done = new Set(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(computeHealth(h, done, '2026-11-01')).toMatchObject({ h: 4, wilted: false })
  })
})

describe('growth & stages', () => {
  it('bildet H stufenlos auf g ab', () => {
    expect(growthOf(0)).toBe(0)
    expect(growthOf(1)).toBe(1)
    expect(growthOf(2)).toBe(1.5)
    expect(growthOf(7)).toBe(3)
    expect(growthOf(10)).toBeCloseTo(3 + 3 / 7)
    expect(growthOf(60)).toBe(6)
    expect(growthOf(100)).toBe(7)
    expect(growthOf(150)).toBeCloseTo(7.5)
    expect(growthOf(365)).toBe(9)
    for (const h of [0.5, 2, 10, 75, 150, 300]) expect(healthOfGrowth(growthOf(h))).toBeCloseTo(h)
  })

  it('kennt die nächste Stufe', () => {
    expect(nextStage(0)).toMatchObject({ name: 'Samen', daysNeeded: 1 })
    expect(nextStage(10)).toMatchObject({ name: 'Junger Baum', daysNeeded: 4 })
    expect(nextStage(14.75)).toMatchObject({ name: 'Großer Baum', daysNeeded: 16 })
    expect(nextStage(60)).toMatchObject({ name: 'Kleiner Hain', daysNeeded: 40 })
    expect(nextStage(365)).toBeNull()
  })
})

describe('stats', () => {
  it('Erfolgsquote ignoriert den offenen heutigen Tag', () => {
    const start = '2026-10-01'
    const done = new Set(run(start, 9)) // 1.–9., 10. und 11. verpasst
    expect(successRate(daily(start), done, '2026-10-12')).toEqual({ rate: 9 / 11, done: 9, due: 11 })
  })

  it('liefert Tageszustände', () => {
    const h = daily('2026-10-05', [{ from: '2026-10-05', days: [1, 2, 3, 4, 5] }])
    const done = new Set(['2026-10-05'])
    expect(dayState(h, done, '2026-10-04', '2026-10-12')).toBe('before')
    expect(dayState(h, done, '2026-10-05', '2026-10-12')).toBe('done')
    expect(dayState(h, done, '2026-10-06', '2026-10-12')).toBe('missed')
    expect(dayState(h, done, '2026-10-10', '2026-10-12')).toBe('rest')
    expect(dayState(h, done, '2026-10-12', '2026-10-12')).toBe('open')
    expect(dayState(h, done, '2026-10-13', '2026-10-12')).toBe('future')
  })
})

describe('Ausnahmetage („heute nicht möglich“)', () => {
  const start = '2026-01-01'
  // 20 Tage erledigt, Tag 21 und 22 ausgesetzt (z. B. krank), heute = Tag 23
  const done = new Set(run(start, 20))
  const excused = new Set([addDays(start, 20), addDays(start, 21)])
  const today = addDays(start, 22)

  it('zählen nicht als verpasst: kein Welken, kein Halbieren', () => {
    expect(computeHealth(daily(start), done, today, excused)).toMatchObject({ h: 20, wilted: false, missRun: 0 })
    expect(computeHealth(daily(start), done, today).h).toBe(9.5) // ohne Ausnahme
  })

  it('die Serie läuft weiter', () => {
    expect(computeStreaks(daily(start), done, today, excused).current).toBe(20)
    expect(computeStreaks(daily(start), done, today).current).toBe(0)
  })

  it('fallen aus der Erfolgsquote heraus und haben einen eigenen Tageszustand', () => {
    expect(successRate(daily(start), done, today, 30, excused)).toMatchObject({ done: 20, due: 20 })
    expect(dayState(daily(start), done, addDays(start, 20), today, excused)).toBe('excused')
  })

  it('erledigt schlägt ausgesetzt', () => {
    const both = new Set([...done, addDays(start, 20)])
    expect(dayState(daily(start), both, addDays(start, 20), today, excused)).toBe('done')
  })
})

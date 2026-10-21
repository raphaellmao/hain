import { useMemo } from 'react'
import { motion } from 'motion/react'
import { doneFor, excusedSet, excusesFor, useDoneMap, useExcuseMap, useHabits, useToday } from '../db/hooks'
import { combineMonthly, monthlyRates } from '../domain/stats'
import { useAchievements } from '../app/achievements'
import { MonthBars } from '../components/MonthBars'

export function AchievementsScreen() {
  const list = useAchievements()
  const habits = useHabits()
  const doneMap = useDoneMap()
  const excuseMap = useExcuseMap()
  const today = useToday()

  // Erfolgsquote je Monat über alle Gewohnheiten
  const monthly = useMemo(() => {
    if (!habits || !doneMap) return []
    return combineMonthly(
      habits.map((h) => monthlyRates(h, doneFor(doneMap, h.id), today, excusedSet(excusesFor(excuseMap, h.id)), 6)),
    )
  }, [habits, doneMap, excuseMap, today])

  if (!list) return null
  const achieved = list.filter((a) => a.achieved)
  const open = list.filter((a) => !a.achieved).sort((a, b) => b.value / b.target - a.value / a.target)

  return (
    <div className="pb-nav">
      <header className="px-safe pt-safe">
        <div className="pt-2 pb-4">
          <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">
            {achieved.length} von {list.length} freigeschaltet
          </p>
          <h1 className="text-[32px] font-bold leading-tight">Erfolge</h1>
        </div>
      </header>

      <main className="px-safe flex flex-col gap-4">
        {monthly.length > 0 && (
          <section className="rounded-3xl bg-surface p-4">
            <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">Erfolgsquote je Monat · alle Gewohnheiten</h2>
            <MonthBars data={monthly} color="var(--accent)" />
          </section>
        )}

        {achieved.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">Freigeschaltet</h2>
            <ul className="grid grid-cols-2 gap-2">
              {achieved.map((a, i) => (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i, 10) * 0.04 }}
                  className="badge-earned relative overflow-hidden rounded-3xl bg-surface p-3"
                >
                  <span className="badge-glow" aria-hidden />
                  <span className="relative block text-[34px] leading-none" aria-hidden>
                    {a.emoji}
                  </span>
                  <p className="relative mt-2 text-[15px] font-semibold leading-tight">{a.title}</p>
                  <p className="relative mt-0.5 text-[12px] leading-snug text-muted">{a.description}</p>
                </motion.li>
              ))}
            </ul>
          </section>
        )}

        {open.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">Noch offen</h2>
            <ul className="grid grid-cols-2 gap-2">
              {open.map((a) => (
                <li key={a.id} className="rounded-3xl bg-surface p-3">
                  <span className="block text-[34px] leading-none opacity-35 grayscale" aria-hidden>
                    {a.emoji}
                  </span>
                  <p className="mt-2 text-[15px] font-semibold leading-tight">{a.title}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted">{a.description}</p>
                  {a.target > 1 && (
                    <>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(a.value / a.target) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted tabular-nums">
                        {Math.floor(a.value)} / {a.target}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

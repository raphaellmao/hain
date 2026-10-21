import { useMemo } from 'react'
import { motion } from 'motion/react'
import { doneFor, excusedSet, excusesFor, useDoneMap, useExcuseMap, useHabits, useToday } from '../db/hooks'
import { combineMonthly, monthlyRates } from '../domain/stats'
import { CATEGORIES, TIERS, type Achievement, type Category, type Tier } from '../domain/achievements'
import { useAchievements } from '../app/achievements'
import { MonthBars } from '../components/MonthBars'

const TIER_ORDER: Tier[] = ['bronze', 'silber', 'gold', 'legendaer']
const tierRank = (t: Tier) => TIER_ORDER.indexOf(t)

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

  // nach Kategorie gruppieren: erreichte zuerst (seltenste oben), dann offene nach Fortschritt
  const groups = (Object.keys(CATEGORIES) as Category[])
    .map((cat) => {
      const items = list
        .filter((a) => a.category === cat)
        .sort((a, b) =>
          a.achieved !== b.achieved
            ? Number(b.achieved) - Number(a.achieved)
            : a.achieved
              ? tierRank(b.tier) - tierRank(a.tier)
              : b.value / b.target - a.value / a.target,
        )
      return { cat, items, done: items.filter((a) => a.achieved).length }
    })
    .filter((g) => g.items.length > 0)

  return (
    <div className="pb-nav">
      <header className="px-safe pt-safe">
        <div className="pt-2 pb-3">
          <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">
            {achieved.length} von {list.length} freigeschaltet
          </p>
          <h1 className="text-[32px] font-bold leading-tight">Erfolge</h1>
        </div>
        {/* Übersicht je Seltenheit */}
        <div className="grid grid-cols-4 gap-2">
          {TIER_ORDER.map((t) => {
            const all = list.filter((a) => a.tier === t)
            const got = all.filter((a) => a.achieved).length
            return (
              <div key={t} className={`tier-${t} rounded-2xl bg-surface px-2 py-2 text-center`} style={{ boxShadow: 'inset 0 0 0 1.5px var(--tier)' }}>
                <span className="block text-[20px] leading-none" aria-hidden>
                  {TIERS[t].emoji}
                </span>
                <span className="mt-1 block text-[13px] font-semibold tabular-nums">
                  {got}/{all.length}
                </span>
                <span className="block text-[10px] text-muted">{TIERS[t].label}</span>
              </div>
            )
          })}
        </div>
      </header>

      <main className="px-safe mt-4 flex flex-col gap-5">
        {monthly.length > 0 && (
          <section className="rounded-3xl bg-surface p-4">
            <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">Erfolgsquote je Monat · alle Gewohnheiten</h2>
            <MonthBars data={monthly} color="var(--accent)" />
          </section>
        )}

        {groups.map((g) => (
          <section key={g.cat}>
            <h2 className="mb-2 flex items-baseline justify-between px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
              {CATEGORIES[g.cat]}
              <span className="tabular-nums normal-case">
                {g.done}/{g.items.length}
              </span>
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {g.items.map((a, i) => (
                <Badge key={a.id} a={a} index={i} />
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  )
}

function Badge({ a, index }: { a: Achievement; index: number }) {
  const hidden = a.secret && !a.achieved
  return (
    <motion.li
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index, 8) * 0.035 }}
      className={`badge tier-${a.tier} ${a.achieved ? 'badge-earned' : ''} relative overflow-hidden rounded-3xl bg-surface p-3`}
    >
      {a.achieved && <span className="badge-glow" aria-hidden />}
      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-1">
          <span
            className={`block text-[34px] leading-none ${a.achieved ? (a.tier === 'legendaer' ? 'badge-float' : '') : 'opacity-35 grayscale'}`}
            aria-hidden
          >
            {hidden ? '❓' : a.emoji}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${a.achieved ? '' : 'opacity-50'}`}
            style={{ background: 'color-mix(in srgb, var(--tier) 22%, transparent)' }}
            title={TIERS[a.tier].label}
          >
            {TIERS[a.tier].emoji} {TIERS[a.tier].label}
          </span>
        </div>
        <p className="mt-2 text-[15px] font-semibold leading-tight">{hidden ? 'Geheimer Erfolg' : a.title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{hidden ? 'Finde ihn selbst heraus.' : a.description}</p>
        {!a.achieved && !hidden && a.target > 1 && (
          <>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${(a.value / a.target) * 100}%`, background: 'var(--tier)' }} />
            </div>
            <p className="mt-1 text-[11px] text-muted tabular-nums">
              {Math.floor(a.value)} / {a.target}
            </p>
          </>
        )}
      </div>
    </motion.li>
  )
}

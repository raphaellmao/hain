import { useMemo } from 'react'
import { motion } from 'motion/react'
import { doneFor, excusedSet, excusesFor, useDoneMap, useExcuseMap, useHabits, useToday } from '../db/hooks'
import { stageLabel, summarize } from '../domain/summary'
import { navigate, paths } from '../app/router'
import { HabitVisual } from '../components/HabitVisual'
import { TERRITORY_STATUS } from '../domain/shadow'
import { Fab } from '../components/Fab'
import { GardenScene } from '../components/GardenScene'
import { useSky } from '../lib/sky'

/**
 * Alle Bäume auf einen Blick. Bewusst ohne Animationen pro Blatt – hier
 * stehen viele Bäume gleichzeitig, das soll auch auf älteren Handys flüssig
 * scrollen.
 */
export function GardenScreen() {
  const habits = useHabits()
  const doneMap = useDoneMap()
  const excuseMap = useExcuseMap()
  const today = useToday()
  const sky = useSky()

  const items = useMemo(() => {
    if (!habits || !doneMap) return []
    return habits.map((habit) => ({
      habit,
      summary: summarize(habit, doneFor(doneMap, habit.id), today, excusedSet(excusesFor(excuseMap, habit.id))),
    }))
  }, [habits, doneMap, excuseMap, today])

  if (!habits || !doneMap) return null

  const isBare = (s: (typeof items)[number]['summary']) => s.health.dormant && s.stage === 0
  const bare = items.filter((i) => isBare(i.summary)).length
  const wilting = items.filter((i) => i.summary.health.wilted && !isBare(i.summary)).length
  const thriving = items.length - wilting - bare
  const summaryLine = [
    thriving && `${thriving} gedeih${thriving === 1 ? 't' : 'en'}`,
    wilting && `${wilting} welk${wilting === 1 ? 't' : 'en'}`,
    bare && `${bare} kahl`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <GardenScene sky={sky}>
    <div className="pb-nav">
      <header className="px-safe pt-safe">
        <div className="pt-2 pb-4 [text-shadow:0_1px_8px_rgba(0,0,0,0.18)]">
          <p className="text-[13px] font-semibold tracking-wide uppercase opacity-85">
            {items.length === 0 ? 'Noch leer' : summaryLine}
          </p>
          <h1 className="text-[32px] font-bold leading-tight">Garten</h1>
        </div>
      </header>

      <main className="px-safe pt-10">
        {items.length === 0 ? (
          <p className="mx-auto mt-24 max-w-xs rounded-2xl bg-surface/85 p-4 text-center text-[15px] text-ink">
            Hier wachsen deine Bäume, sobald du eine Gewohnheit anlegst.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-x-2 gap-y-3">
            {items.map(({ habit, summary }, idx) => (
              <motion.li
                key={habit.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx, 12) * 0.03 }}
              >
                <button
                  type="button"
                  onClick={() => navigate(paths.habit(habit.id))}
                  className="flex w-full flex-col items-center rounded-3xl pt-1 pb-2 active:bg-white/15"
                >
                  {/* jede Pflanze wiegt sich in ihrem eigenen Takt */}
                  <span className="sway aspect-square w-full" style={{ animationDuration: `${4.5 + (idx % 5) * 0.7}s`, animationDelay: `${-idx * 0.9}s` }}>
                    <HabitVisual habit={habit} summary={summary} className="size-full" />
                  </span>
                  <span className="mt-0.5 flex max-w-full items-center justify-center gap-1 rounded-t-xl bg-surface/85 px-2 pt-0.5 text-[13px] font-semibold text-ink">
                    <span aria-hidden>{habit.emoji}</span>
                    <span className="truncate">{habit.name}</span>
                  </span>
                  {habit.metaphor === 'schatten' ? (
                    <span className={`rounded-b-xl bg-surface/85 px-2 pb-0.5 text-[11px] ${summary.shadow.status <= 1 ? 'font-semibold text-warn' : 'text-muted'}`}>
                      {TERRITORY_STATUS[summary.shadow.status].label}
                    </span>
                  ) : (
                    <span
                      className={`rounded-b-xl bg-surface/85 px-2 pb-0.5 text-[11px] ${summary.health.wilted && !isBare(summary) ? 'font-semibold text-warn' : 'text-muted'}`}
                    >
                      {summary.health.wilted && !isBare(summary) ? 'welkt' : stageLabel(summary, habit.species)}
                    </span>
                  )}
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </main>

      <Fab onClick={() => navigate(paths.new)} />
    </div>
    </GardenScene>
  )
}

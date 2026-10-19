import { useMemo } from 'react'
import { motion } from 'motion/react'
import { doneFor, useDoneMap, useHabits, useToday } from '../db/hooks'
import { stageLabel, summarize } from '../domain/summary'
import { navigate, paths } from '../app/router'
import { Tree } from '../tree/Tree'
import { Fab } from '../components/Fab'

/**
 * Alle Bäume auf einen Blick. Bewusst ohne Animationen pro Blatt – hier
 * stehen viele Bäume gleichzeitig, das soll auch auf älteren Handys flüssig
 * scrollen.
 */
export function GardenScreen() {
  const habits = useHabits()
  const doneMap = useDoneMap()
  const today = useToday()

  const items = useMemo(() => {
    if (!habits || !doneMap) return []
    return habits.map((habit) => ({ habit, summary: summarize(habit, doneFor(doneMap, habit.id), today) }))
  }, [habits, doneMap, today])

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
    <div className="pb-nav">
      <header className="px-safe pt-safe">
        <div className="pt-2 pb-4">
          <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">
            {items.length === 0 ? 'Noch leer' : summaryLine}
          </p>
          <h1 className="text-[32px] font-bold leading-tight">Garten</h1>
        </div>
      </header>

      <main className="px-safe">
        {items.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-muted">Hier wachsen deine Bäume, sobald du eine Gewohnheit anlegst.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-x-2 gap-y-2">
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
                  className="flex w-full flex-col items-center rounded-3xl pt-1 pb-2 active:bg-surface-2"
                >
                  <span className="aspect-square w-full">
                    <Tree
                      seed={habit.seed}
                      color={habit.color}
                      g={summary.g}
                      wilted={summary.health.wilted}
                      dormant={summary.health.dormant}
                      className="size-full"
                    />
                  </span>
                  <span className="mt-0.5 flex w-full items-center justify-center gap-1 px-1 text-[13px] font-semibold">
                    <span aria-hidden>{habit.emoji}</span>
                    <span className="truncate">{habit.name}</span>
                  </span>
                  <span
                    className={`text-[11px] ${summary.health.wilted && !isBare(summary) ? 'font-semibold text-warn' : 'text-muted'}`}
                  >
                    {summary.health.wilted && !isBare(summary) ? 'welkt' : stageLabel(summary)}
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </main>

      <Fab onClick={() => navigate(paths.new)} />
    </div>
  )
}

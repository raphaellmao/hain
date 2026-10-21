import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { doneFor, excusedSet, excusesFor, useDoneMap, useExcuseMap, useHabits, useMeta, useToday } from '../db/hooks'
import { excusesInWindow } from '../domain/excuse'
import { openExcuseSheet } from '../lib/excuseSheet'
import { GREETING, useSky } from '../lib/sky'
import { formatLong, type DateStr } from '../domain/dates'
import { isDue } from '../domain/schedule'
import { summarize } from '../domain/summary'
import { toggleDay } from '../app/actions'
import { navigate, paths } from '../app/router'
import { HabitRow } from '../components/HabitRow'
import { WeekStrip } from '../components/WeekStrip'
import { Fab } from '../components/Fab'
import { DayNote } from '../components/DayNote'
import { Tree } from '../tree/Tree'

export function TodayScreen() {
  const habits = useHabits()
  const doneMap = useDoneMap()
  const excuseMap = useExcuseMap()
  const today = useToday()
  const sky = useSky()
  const [selected, setSelected] = useState<DateStr>(today)
  const [showRest, setShowRest] = useState(false)
  const lastBackupAt = useMeta<number>('lastBackupAt')

  // Neuer Tag (z. B. App über Nacht offen) → zurück auf „Heute“
  useEffect(() => setSelected(today), [today])

  // Zustand aller Habits. Der Baum zeigt immer den Stand von *heute*,
  // auch wenn ein vergangener Tag zum Nachtragen ausgewählt ist.
  const items = useMemo(() => {
    if (!habits || !doneMap) return []
    return habits.map((habit) => {
      const done = doneFor(doneMap, habit.id)
      const excuses = excusesFor(excuseMap, habit.id)
      const excused = excusedSet(excuses)
      return { habit, done, excuses, excused, summary: summarize(habit, done, today, excused) }
    })
  }, [habits, doneMap, excuseMap, today])

  if (!habits || !doneMap) return null

  if (habits.length === 0) return <EmptyState />

  const isToday = selected === today
  const active = items.filter((i) => i.habit.startDate <= selected)
  const due = active.filter((i) => isDue(i.habit, selected))
  const rest = active.filter((i) => !isDue(i.habit, selected))
  // Ausgesetzte Tage zählen weder als offen noch als erledigt
  const isOff = (i: (typeof items)[number], date: DateStr) => i.excused.has(date) && !i.done.has(date)
  const countable = due.filter((i) => !isOff(i, selected))
  const doneCount = countable.filter((i) => i.done.has(selected)).length
  const allDone = due.length > 0 && doneCount === countable.length

  const progress = (date: DateStr) => {
    const d = items.filter((i) => isDue(i.habit, date) && !isOff(i, date))
    return d.length === 0 ? null : d.filter((i) => i.done.has(date)).length / d.length
  }

  const row = (i: (typeof items)[number], dimmed = false) => (
    <HabitRow
      key={i.habit.id}
      habit={i.habit}
      summary={i.summary}
      done={i.done.has(selected)}
      excuse={i.excuses.get(selected)}
      showWilt={isToday}
      dimmed={dimmed}
      onToggle={() => toggleDay(i.habit, i.done, selected, today, i.excused)}
      onMore={() =>
        openExcuseSheet({
          habit: i.habit,
          date: selected,
          today,
          current: i.excuses.get(selected),
          done: i.done.has(selected),
          recent: excusesInWindow(i.excused, today),
          showDetails: true,
        })
      }
    />
  )

  return (
    <div className="pb-nav">
      <header className="px-safe pt-safe">
        <div className="flex items-end justify-between gap-3 pt-2 pb-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">
              {isToday ? `${GREETING[sky.phase]} · ${formatLong(today)}` : 'Nachtragen'}
            </p>
            <h1 className={`truncate font-bold leading-tight ${isToday ? 'text-[32px]' : 'text-[26px]'}`}>
              {isToday ? 'Heute' : formatLong(selected)}
            </h1>
          </div>
          {countable.length > 0 && (
            <span className="pb-1.5 text-[15px] font-semibold text-muted tabular-nums">
              {doneCount}/{countable.length}
            </span>
          )}
        </div>
        <WeekStrip today={today} selected={selected} progress={progress} onSelect={setSelected} />
      </header>

      <main className="px-safe mt-4">
        <AnimatePresence>
          {allDone && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden text-center text-[15px] text-muted"
            >
              <span className="block pb-3">{isToday ? 'Alles erledigt für heute 🌿' : 'An diesem Tag war alles erledigt 🌿'}</span>
            </motion.p>
          )}
        </AnimatePresence>

        {due.length > 0 ? (
          <ul className="flex flex-col gap-2.5">{due.map((i) => row(i))}</ul>
        ) : (
          <p className="py-8 text-center text-[15px] text-muted">
            {isToday ? 'Heute ist nichts fällig.' : 'An diesem Tag war nichts fällig.'}
          </p>
        )}

        {rest.length > 0 && (
          <section className="mt-6">
            <button
              type="button"
              onClick={() => setShowRest((v) => !v)}
              className="flex min-h-11 w-full items-center justify-between text-[13px] font-semibold tracking-wide text-muted uppercase"
              aria-expanded={showRest}
            >
              {isToday ? 'Heute nicht fällig' : 'Nicht fällig'} ({rest.length})
              <span className={`transition-transform ${showRest ? 'rotate-90' : ''}`} aria-hidden>
                ›
              </span>
            </button>
            {showRest && <ul className="mt-1 flex flex-col gap-2.5">{rest.map((i) => row(i, true))}</ul>}
          </section>
        )}

        <DayNote date={selected} isToday={isToday} />
      </main>

      {needsBackup(habits, lastBackupAt) && (
        <div className="px-safe mt-8">
          <button
            type="button"
            onClick={() => navigate(paths.settings, { replace: true })}
            className="w-full rounded-2xl border border-dashed border-line px-4 py-3 text-left text-[14px] text-muted"
          >
            {lastBackupAt ? 'Dein letztes Backup ist über einen Monat alt.' : 'Du hast noch kein Backup.'}{' '}
            <span className="font-semibold text-accent">Jetzt sichern ›</span>
          </button>
        </div>
      )}

      <Fab onClick={() => navigate(paths.new)} />
    </div>
  )
}

const DAY_MS = 86_400_000

/**
 * Sanfte Backup-Erinnerung: ohne Backup ab 14 Tagen Nutzung, sonst wenn das
 * letzte Backup älter als 30 Tage ist. (undefined = lädt noch → nichts zeigen)
 */
function needsBackup(habits: { createdAt: number }[], lastBackupAt: number | null | undefined): boolean {
  if (lastBackupAt === undefined || habits.length === 0) return false
  if (lastBackupAt) return Date.now() - lastBackupAt > 30 * DAY_MS
  const oldest = Math.min(...habits.map((h) => h.createdAt))
  return Date.now() - oldest > 14 * DAY_MS
}

function EmptyState() {
  return (
    <div className="px-safe pt-safe pb-nav flex min-h-dvh flex-col items-center justify-center text-center">
      <div className="size-44">
        <Tree seed={7} color="koralle" g={1.5} className="size-full" />
      </div>
      <h1 className="mt-2 text-2xl font-bold">Dein Hain ist noch leer</h1>
      <p className="mt-2 max-w-xs text-[15px] text-muted">
        Leg eine Gewohnheit an. Jeder erledigte Tag lässt ihren Baum ein Stück wachsen.
      </p>
      <button
        type="button"
        onClick={() => navigate(paths.new)}
        className="mt-6 h-13 rounded-2xl bg-accent px-6 text-[17px] font-semibold text-accent-ink"
      >
        Erste Gewohnheit pflanzen
      </button>
    </div>
  )
}

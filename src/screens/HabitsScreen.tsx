import { useEffect, useState, type KeyboardEvent } from 'react'
import { Reorder, useDragControls } from 'motion/react'
import { goBack, navigate, paths } from '../app/router'
import { useArchivedHabits, useHabits, useRoutines, useToday } from '../db/hooks'
import { saveHabitOrder, unarchiveHabit } from '../db/repo'
import { formatDayMonth } from '../domain/dates'
import { describeDays, daysAt } from '../domain/schedule'
import type { Habit } from '../domain/types'
import { IconChevronLeft, IconGrip } from '../components/icons'
import { tick } from '../lib/haptics'
import { showToast } from '../lib/toast'

/** Reihenfolge per Ziehen ändern und Pausiertes aus dem Archiv zurückholen */
export function HabitsScreen() {
  const habits = useHabits()
  const archived = useArchivedHabits()
  const routines = useRoutines()
  const today = useToday()
  const [list, setList] = useState<Habit[]>([])

  // Nach dem Speichern kommt dieselbe Reihenfolge aus der Datenbank zurück
  useEffect(() => {
    if (habits) setList(habits)
  }, [habits])

  const persist = (next: Habit[]) => void saveHabitOrder(next.map((h) => h.id))

  /** Mit der Tastatur: Pfeil hoch/runter verschiebt um einen Platz */
  function onKey(e: KeyboardEvent, index: number) {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1
    if (to < 0 || to >= list.length) return
    e.preventDefault()
    const next = [...list]
    const [moved] = next.splice(index, 1)
    next.splice(to, 0, moved)
    setList(next)
    persist(next)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-grip="${moved.id}"]`)?.focus())
  }

  return (
    <div className="pb-nav">
      <header className="px-safe pt-safe">
        <button type="button" onClick={() => goBack(paths.settings)} className="-ml-2 flex h-11 items-center gap-0.5 pr-3 text-[17px] font-medium text-accent">
          <IconChevronLeft width={22} height={22} />
          Zurück
        </button>
        <h1 className="text-[32px] font-bold leading-tight">Gewohnheiten</h1>
      </header>

      <main className="px-safe mt-4 flex flex-col gap-6">
        <section>
          <h2 className="mb-1 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">Reihenfolge</h2>
          <p className="mb-2 px-1 text-[13px] text-muted">Am Griff ziehen – so stehen sie auf „Heute“ und im Garten.</p>
          {list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[14px] text-muted">Noch keine aktiven Gewohnheiten.</p>
          ) : (
            <Reorder.Group axis="y" values={list} onReorder={setList} className="flex flex-col gap-2">
              {list.map((h, i) => (
                <Row key={h.id} habit={h} today={today} onDrop={() => persist(list)} onKey={(e) => onKey(e, i)} />
              ))}
            </Reorder.Group>
          )}
        </section>

        <section>
          <h2 className="mb-1 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">Routinen</h2>
          <p className="mb-2 px-1 text-[13px] text-muted">Gewohnheiten aneinanderketten – eine erledigte ist der Auslöser für die nächste.</p>
          <ul className="flex flex-col gap-2">
            {routines?.map((r) => {
              const names = r.habitIds.map((id) => habits?.find((h) => h.id === id)).filter((h): h is Habit => !!h)
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => navigate(paths.routine(r.id))}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface px-4 py-2 text-left"
                  >
                    <span className="text-[22px] leading-none" aria-hidden>
                      {r.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium">{r.name}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {names.length ? names.map((h) => `${h.emoji} ${h.name}`).join(' → ') : 'keine aktiven Gewohnheiten'}
                      </span>
                    </span>
                    <span className="text-muted" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              )
            })}
            <li>
              <button
                type="button"
                onClick={() => navigate(paths.routine())}
                disabled={(habits?.length ?? 0) < 2}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-[16px] font-medium text-accent disabled:text-muted"
              >
                + Neue Routine
              </button>
              {(habits?.length ?? 0) < 2 && <p className="mt-1 px-1 text-[13px] text-muted">Dafür braucht es mindestens zwei Gewohnheiten.</p>}
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">Archiv</h2>
          {!archived?.length ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[14px] leading-snug text-muted">
              Leer. Was du pausieren willst, legst du beim Bearbeiten einer Gewohnheit ins Archiv: Sie verschwindet aus „Heute“ und dem
              Garten, nichts welkt, der Verlauf bleibt.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {archived.map((h) => (
                <li key={h.id} className="flex items-center gap-2 rounded-2xl bg-surface py-1.5 pr-1.5 pl-4">
                  <button type="button" onClick={() => navigate(paths.habit(h.id))} className="min-w-0 flex-1 py-1 text-left">
                    <span className="block truncate text-[16px] font-medium">
                      <span aria-hidden>{h.emoji}</span> {h.name}
                    </span>
                    <span className="block text-[13px] text-muted">im Archiv seit {formatDayMonth(h.archived!.since)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      tick()
                      void unarchiveHabit(h.id, today).then(() => showToast(`„${h.name}“ ist zurück`, h.emoji))
                    }}
                    className="h-11 shrink-0 rounded-xl bg-surface-2 px-3 text-[15px] font-semibold text-accent"
                  >
                    Zurückholen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

function Row({ habit, today, onDrop, onKey }: { habit: Habit; today: string; onDrop: () => void; onKey: (e: KeyboardEvent) => void }) {
  const drag = useDragControls()
  return (
    <Reorder.Item
      value={habit}
      dragListener={false}
      dragControls={drag}
      onDragEnd={onDrop}
      className="flex items-center gap-2 rounded-2xl bg-surface py-1.5 pr-4 pl-1.5 select-none"
      whileDrag={{ scale: 1.03, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}
    >
      <button
        type="button"
        data-grip={habit.id}
        aria-label={`${habit.name} verschieben (Pfeiltasten)`}
        onPointerDown={(e) => drag.start(e)}
        onKeyDown={onKey}
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted active:cursor-grabbing"
      >
        <IconGrip width={22} height={22} />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium">
          <span aria-hidden>{habit.emoji}</span> {habit.name}
        </span>
        <span className="block text-[13px] text-muted">{describeDays(daysAt(habit.schedule, today))}</span>
      </span>
    </Reorder.Item>
  )
}

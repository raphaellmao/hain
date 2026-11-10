import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { navigate, paths } from '../app/router'
import type { DateStr } from '../domain/dates'
import { routineProgress } from '../domain/routine'
import type { DoneSet, Habit, Routine } from '../domain/types'
import { showToast } from '../lib/toast'

interface Item {
  habit: Habit
  done: DoneSet
  excused: DoneSet
}

/**
 * Eine Routine auf „Heute“: ihre fälligen Gewohnheiten als Kette, die nächste
 * offene ist hervorgehoben. Abhaken geht in jeder Reihenfolge – die Kette zeigt
 * nur den Weg. Ist sie komplett, leuchtet die Karte kurz auf.
 */
export function RoutineCard({
  routine,
  items,
  date,
  isToday,
  dayComplete,
  renderRow,
}: {
  routine: Routine
  items: Item[]
  date: DateStr
  isToday: boolean
  /** Ist damit der ganze Tag erledigt, übernimmt die große Belohnung */
  dayComplete: boolean
  renderRow: (item: Item, next: boolean) => ReactNode
}) {
  const p = routineProgress(items, date)
  const [burst, setBurst] = useState(false)
  const before = useRef<{ date: DateStr; complete: boolean } | null>(null)

  useEffect(() => {
    const prev = before.current
    before.current = { date, complete: p.complete }
    if (!prev || prev.date !== date || prev.complete || !p.complete || !isToday) return
    setBurst(true)
    if (!dayComplete) showToast(`${routine.name} geschafft`, routine.emoji)
    const t = window.setTimeout(() => setBurst(false), 1400)
    return () => window.clearTimeout(t)
  }, [p.complete, date, isToday, dayComplete, routine.name, routine.emoji])

  const status = p.complete
    ? 'Geschafft ✓'
    : p.next >= 0 && isToday
      ? `Als Nächstes: ${items[p.next].habit.name}`
      : `${p.done} von ${p.total} erledigt`

  return (
    <li
      className={`rounded-[28px] border p-1.5 transition-colors ${p.complete ? 'border-accent/70 bg-accent/5' : 'border-line'} ${burst ? 'routine-burst' : ''}`}
      aria-label={`Routine ${routine.name}`}
    >
      <button
        type="button"
        onClick={() => navigate(paths.routine(routine.id))}
        className="flex min-h-11 w-full items-center gap-2.5 px-2.5 pt-1 pb-2 text-left"
        aria-label={`${routine.name}: ${status}. Routine bearbeiten`}
      >
        <span className="text-[22px] leading-none" aria-hidden>
          {routine.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-tight font-semibold">{routine.name}</span>
          <span className={`block truncate text-[12px] ${p.complete ? 'font-semibold text-accent' : 'text-muted'}`}>
            {status}
            {routine.cue && !p.complete ? ` · ${routine.cue}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 gap-1" aria-hidden>
          {p.states.map((s, k) => (
            <span
              key={k}
              className={`size-2 rounded-full ${s === 'done' ? 'bg-accent' : s === 'off' ? 'bg-line' : k === p.next ? 'bg-accent/40 ring-2 ring-accent/40' : 'bg-line'}`}
            />
          ))}
        </span>
      </button>
      <ul className="flex flex-col">
        {items.map((item, k) => (
          <Fragment key={item.habit.id}>
            {k > 0 && (
              <li aria-hidden className="flex h-3 items-center pl-[38px]">
                <span className={`h-full w-0.5 rounded-full ${p.states[k - 1] === 'done' ? 'bg-accent/70' : 'bg-line'}`} />
              </li>
            )}
            {renderRow(item, isToday && k === p.next)}
          </Fragment>
        ))}
      </ul>
    </li>
  )
}

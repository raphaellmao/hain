import { useState } from 'react'
import { addDays, dayOfMonth, diffDays, formatDayMonth, formatMonthYear, shiftMonth, startOfWeek, WEEKDAYS_MON0, type DateStr } from '../domain/dates'
import { dayState } from '../domain/stats'
import type { DoneSet, Habit } from '../domain/types'
import { toggleDay } from '../app/actions'
import { IconChevronLeft, IconChevronRight } from './icons'

/**
 * Monatskalender zum Nachtragen und Korrigieren. Jeder Tag ist ein 44-px-
 * Knopf; ein Tipp hakt ab oder nimmt den Haken weg. Baum, Serien und
 * Statistik rechnen sich danach automatisch neu.
 */
export function MonthCalendar({ habit, done, today, color }: { habit: Habit; done: DoneSet; today: DateStr; color: string }) {
  const thisMonth = today.slice(0, 7)
  const firstMonth = habit.startDate.slice(0, 7)
  const [month, setMonth] = useState(thisMonth)

  const first = `${month}-01`
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1)
  const gridStart = startOfWeek(first)
  const weeks = Math.ceil((diffDays(gridStart, last) + 1) / 7)
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          disabled={month <= firstMonth}
          aria-label="Vorheriger Monat"
          className="flex size-11 items-center justify-center rounded-full text-ink disabled:opacity-25"
        >
          <IconChevronLeft width={22} height={22} />
        </button>
        <span className="text-[16px] font-semibold">{formatMonthYear(first)}</span>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={month >= thisMonth}
          aria-label="Nächster Monat"
          className="flex size-11 items-center justify-center rounded-full text-ink disabled:opacity-25"
        >
          <IconChevronRight width={22} height={22} />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[12px] font-medium text-muted">
        {WEEKDAYS_MON0.map((w) => (
          <span key={w} className="pb-1">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          if (d.slice(0, 7) !== month) return <span key={d} />
          const s = dayState(habit, done, d, today)
          const disabled = s === 'before' || s === 'future'
          const isDone = s === 'done'
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => toggleDay(habit, done, d, today)}
              aria-pressed={isDone}
              aria-label={`${formatDayMonth(d)}: ${LABEL[s]}`}
              className="relative mx-auto flex size-11 flex-col items-center justify-center rounded-full text-[15px] tabular-nums transition-colors disabled:opacity-25"
              style={
                isDone
                  ? { background: color, color: '#fff', fontWeight: 600 }
                  : s === 'open'
                    ? { boxShadow: `inset 0 0 0 2px ${color}`, fontWeight: 600 }
                    : s === 'missed'
                      ? { color: 'var(--warn)', fontWeight: 600 }
                      : s === 'rest'
                        ? { color: 'var(--muted)' }
                        : undefined
              }
            >
              {dayOfMonth(d)}
              {s === 'missed' && <span className="absolute bottom-1.5 size-1 rounded-full bg-warn" aria-hidden />}
            </button>
          )
        })}
      </div>

      {month === firstMonth && habit.startDate.slice(8) !== '01' && (
        <p className="mt-2 text-[12px] text-muted">
          Vor dem Start am {formatDayMonth(habit.startDate)} lässt sich nichts abhaken – das Startdatum kannst du unter
          „Bearbeiten“ vorverlegen.
        </p>
      )}
    </div>
  )
}

const LABEL = {
  done: 'erledigt',
  missed: 'verpasst',
  open: 'heute offen',
  rest: 'nicht fällig',
  before: 'vor dem Start',
  future: 'Zukunft',
} as const

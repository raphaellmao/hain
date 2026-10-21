import { useState } from 'react'
import { addDays, dayOfMonth, diffDays, formatDayMonth, formatMonthYear, shiftMonth, startOfWeek, WEEKDAYS_MON0, type DateStr } from '../domain/dates'
import { dayState, type DayState } from '../domain/stats'
import type { DoneSet, Habit } from '../domain/types'
import { excusesInWindow, reasonInfo } from '../domain/excuse'
import { excusedSet, type ExcuseDays } from '../db/hooks'
import { toggleDay } from '../app/actions'
import { openExcuseSheet } from '../lib/excuseSheet'
import { useLongPress } from '../lib/useLongPress'
import { IconChevronLeft, IconChevronRight } from './icons'

/**
 * Monatskalender zum Nachtragen und Korrigieren. Jeder Tag ist ein 44-px-
 * Knopf; ein Tipp hakt ab oder nimmt den Haken weg, langes Drücken setzt den
 * Tag aus („nicht möglich“). Baum, Serien und Statistik rechnen sich danach
 * automatisch neu.
 */
export function MonthCalendar({
  habit,
  done,
  excuses,
  today,
  color,
}: {
  habit: Habit
  done: DoneSet
  excuses: ExcuseDays
  today: DateStr
  color: string
}) {
  const thisMonth = today.slice(0, 7)
  const firstMonth = habit.startDate.slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const excused = excusedSet(excuses)

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
        {days.map((d) =>
          d.slice(0, 7) !== month ? (
            <span key={d} />
          ) : (
            <DayCell
              key={d}
              date={d}
              state={dayState(habit, done, d, today, excused)}
              emoji={excuses.has(d) ? reasonInfo(excuses.get(d)?.reason).emoji : undefined}
              color={color}
              onTap={() => toggleDay(habit, done, d, today, excused)}
              onLong={() =>
                openExcuseSheet({
                  habit,
                  date: d,
                  today,
                  current: excuses.get(d),
                  done: done.has(d),
                  recent: excusesInWindow(excused, today),
                })
              }
            />
          ),
        )}
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

function DayCell({
  date,
  state,
  emoji,
  color,
  onTap,
  onLong,
}: {
  date: DateStr
  state: DayState
  emoji?: string
  color: string
  onTap: () => void
  onLong: () => void
}) {
  const disabled = state === 'before' || state === 'future'
  const isDone = state === 'done'
  const longPress = useLongPress(onLong)

  return (
    <button
      type="button"
      disabled={disabled}
      {...longPress.handlers}
      onClick={() => {
        if (!longPress.consumeLongPress()) onTap()
      }}
      aria-pressed={isDone}
      aria-label={`${formatDayMonth(date)}: ${LABEL[state]}`}
      className="relative mx-auto flex size-11 touch-manipulation flex-col items-center justify-center rounded-full text-[15px] tabular-nums transition-colors select-none disabled:opacity-25"
      style={
        isDone
          ? { background: color, color: '#fff', fontWeight: 600 }
          : state === 'open'
            ? { boxShadow: `inset 0 0 0 2px ${color}`, fontWeight: 600 }
            : state === 'missed'
              ? { color: 'var(--warn)', fontWeight: 600 }
              : state === 'excused'
                ? { border: '2px dashed var(--line)', color: 'var(--muted)' }
                : state === 'rest'
                  ? { color: 'var(--muted)' }
                  : undefined
      }
    >
      {state === 'excused' && emoji ? (
        <>
          <span className="text-[11px] leading-none">{dayOfMonth(date)}</span>
          <span className="text-[13px] leading-none" aria-hidden>
            {emoji}
          </span>
        </>
      ) : (
        dayOfMonth(date)
      )}
      {state === 'missed' && <span className="absolute bottom-1.5 size-1 rounded-full bg-warn" aria-hidden />}
    </button>
  )
}

const LABEL: Record<DayState, string> = {
  done: 'erledigt',
  missed: 'verpasst',
  open: 'heute offen',
  rest: 'nicht fällig',
  excused: 'ausgesetzt',
  before: 'vor dem Start',
  future: 'Zukunft',
}

import { useEffect, useState, type ReactNode } from 'react'
import { changeAmount, toggleTimer } from '../app/actions'
import { useDayCheckin, useSettings, useTimers } from '../db/hooks'
import type { DateStr } from '../domain/dates'
import { clock, effectiveAmount, formatAmount, formatNumber, MINUTE_STEPS, parseAmount, progressOf, reached, timerMinutes } from '../domain/goal'
import type { Habit, HabitGoal } from '../domain/types'
import { colorHex } from '../domain/colors'

/**
 * Menge bzw. Minuten eines Tages genau einstellen: − und +, die Zahl selbst ist
 * ein Eingabefeld. Bei Dauer zusätzlich Schnelltasten und – für heute – der Timer.
 */
export function GoalEditor({ habit, goal, date, today }: { habit: Habit; goal: HabitGoal; date: DateStr; today: DateStr }) {
  const entry = useDayCheckin(habit.id, date)
  const timers = useTimers()
  const { dayStartHour } = useSettings()
  const [draft, setDraft] = useState<string | null>(null)
  if (!entry || !timers) return null

  const amount = effectiveAmount(entry.amount, entry.done, goal)
  const step = goal.kind === 'dauer' ? MINUTE_STEPS[0] : goal.step
  const set = (next: number) => void changeAmount(habit, date, today, amount, next)
  const running = date === today ? timers.get(habit.id) : undefined
  const color = colorHex(habit.color)

  function commit() {
    const value = draft === null ? null : parseAmount(draft)
    setDraft(null)
    if (value !== null && value !== amount) set(value)
  }

  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center gap-2">
        <RoundButton label={`${formatAmount(step, goal)} weniger`} disabled={amount <= 0} onClick={() => set(amount - step)}>
          −
        </RoundButton>
        <div className="min-w-0 flex-1 text-center">
          <input
            value={draft ?? formatNumber(amount)}
            inputMode="decimal"
            enterKeyHint="done"
            aria-label={goal.kind === 'dauer' ? 'Minuten' : `Menge${goal.unit ? ` in ${goal.unit}` : ''}`}
            onFocus={(e) => {
              setDraft(formatNumber(amount))
              e.currentTarget.select()
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="w-full bg-transparent text-center text-[34px] leading-tight font-bold tabular-nums outline-none"
          />
          <p className="text-[13px] text-muted">
            {goal.kind === 'dauer' ? 'Minuten · ' : goal.unit ? `${goal.unit} · ` : ''}Ziel {formatAmount(goal.target, goal)}
            {reached(amount, goal) && ' ✓'}
          </p>
        </div>
        <RoundButton label={`${formatAmount(step, goal)} mehr`} onClick={() => set(amount + step)}>
          +
        </RoundButton>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progressOf(amount, goal) * 100}%`, background: color }} />
      </div>

      {goal.kind === 'dauer' && (
        <div className="mt-3 flex gap-2">
          {MINUTE_STEPS.map((m) => (
            <button key={m} type="button" onClick={() => set(amount + m)} className="h-11 flex-1 rounded-xl bg-surface text-[15px] font-medium tabular-nums">
              +{m} min
            </button>
          ))}
        </div>
      )}
      {goal.kind === 'dauer' && date === today && (
        <button
          type="button"
          onClick={() => void toggleTimer(habit, running, today, dayStartHour)}
          className={`mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-semibold ${running ? 'bg-ink text-bg' : 'bg-accent text-accent-ink'}`}
        >
          {running ? (
            <>
              <span className="timer-pulse inline-block size-3 rounded-sm bg-current" aria-hidden />
              Timer stoppen · <RunningClock since={running} />
            </>
          ) : (
            '▶ Timer starten'
          )}
        </button>
      )}
    </div>
  )
}

function RoundButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-[26px] leading-none font-medium transition-opacity disabled:opacity-35"
    >
      {children}
    </button>
  )
}

/** Laufende Zeit seit dem Start, jede Sekunde neu */
export function RunningClock({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return <span className="tabular-nums">{clock(now - since)}</span>
}

/** Minuten, die ein laufender Timer schon gesammelt hat (für die Anzeige, jede Sekunde neu) */
export function useRunningMinutes(since: number | undefined): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (since === undefined) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [since])
  return since === undefined ? 0 : timerMinutes(since, now).minutes
}

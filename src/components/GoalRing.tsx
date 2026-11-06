import { motion } from 'motion/react'
import { progressOf } from '../domain/goal'
import type { HabitGoal } from '../domain/types'
import { CheckCircle } from './CheckCircle'

/**
 * Rechts in der Zeile einer Gewohnheit mit Ziel: Der Ring füllt sich mit dem
 * Fortschritt. Innen steht, was ein Tipp tut: „+“ zählt dazu, ▶ startet den
 * Timer, ■ stoppt ihn. Ist das Ziel erreicht, wird daraus der gewohnte Haken.
 */
export function GoalRing({ amount, goal, done, running, color, size = 32 }: {
  amount: number
  goal: HabitGoal
  done: boolean
  running: boolean
  color: string
  size?: number
}) {
  if (done && !running) return <CheckCircle done color={color} size={size} />
  const r = 13
  const c = 2 * Math.PI * r
  const p = progressOf(amount, goal)
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="16" cy="16" r={r} fill="none" stroke="var(--line)" strokeWidth="2.5" />
        <motion.circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - p) }}
          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
        />
      </svg>
      <svg viewBox="0 0 16 16" width={size * 0.42} height={size * 0.42} className={running ? 'timer-pulse' : undefined} aria-hidden>
        {running ? (
          <rect x="3" y="3" width="10" height="10" rx="2" fill={color} />
        ) : goal.kind === 'dauer' ? (
          <path d="M4.5 2.6v10.8L13.4 8Z" fill={color} />
        ) : (
          <path d="M8 2.5v11M2.5 8h11" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
        )}
      </svg>
    </span>
  )
}

import { motion } from 'motion/react'
import { colorHex } from '../domain/colors'
import { stageLabel, type HabitSummary } from '../domain/summary'
import type { Habit } from '../domain/types'
import { Tree } from '../tree/Tree'
import { useLastSeen } from '../lib/lastSeen'
import { CheckCircle } from './CheckCircle'
import { IconChevronRight } from './icons'

/**
 * Eine Zeile der Heute-Ansicht. Die ganze linke Fläche (Baum, Name, Haken)
 * ist ein einziger großer Tap-Bereich zum Abhaken; rechts geht es zur
 * Detailansicht. Der Mini-Baum wächst direkt beim Abhaken.
 */
export function HabitRow({
  habit,
  summary,
  done,
  showWilt,
  dimmed = false,
  onToggle,
  onOpen,
}: {
  habit: Habit
  summary: HabitSummary
  done: boolean
  /** Welk-Hinweis zeigen (nur, wenn heute angezeigt wird) */
  showWilt: boolean
  dimmed?: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const color = colorHex(habit.color)
  const fromG = useLastSeen(habit.id, summary.g)
  const { current } = summary.streaks
  const wilted = summary.health.wilted

  const stage = stageLabel(summary)
  let sub: string
  let subClass = 'text-muted'
  if (summary.health.dormant && summary.stage === 0) {
    sub = 'Kahl – ein neuer Samen liegt bereit'
  } else if (wilted && showWilt) {
    sub = `welkt · ${stage}`
    subClass = 'text-warn'
  } else if (current > 0) {
    sub = `${current} ${current === 1 ? 'Tag' : 'Tage'} in Folge · ${stage}`
  } else {
    sub = stage
  }

  return (
    <motion.li
      layout="position"
      className={`flex items-stretch overflow-hidden rounded-3xl bg-surface shadow-[0_1px_0_var(--line)] ${dimmed ? 'opacity-70' : ''}`}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.97 }}
        aria-pressed={done}
        aria-label={`${habit.name} ${done ? 'erledigt' : 'abhaken'}`}
        className="flex min-h-[76px] min-w-0 flex-1 items-center gap-3 py-2 pl-2 pr-1 text-left"
      >
        <span className="size-16 shrink-0">
          <Tree
            seed={habit.seed}
            color={habit.color}
            g={summary.g}
            wilted={wilted}
            dormant={summary.health.dormant}
            animated
            fromG={fromG}
            className="size-full"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[17px] font-semibold leading-tight">
            <span aria-hidden>{habit.emoji}</span>
            <span className="truncate">{habit.name}</span>
          </span>
          <span className={`mt-0.5 block truncate text-[13px] ${subClass}`}>{sub}</span>
        </span>
        <CheckCircle done={done} color={color} />
      </motion.button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${habit.name} – Details`}
        className="flex w-11 shrink-0 items-center justify-center text-muted"
      >
        <IconChevronRight width={20} height={20} />
      </button>
    </motion.li>
  )
}

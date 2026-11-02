import { useState, type Ref } from 'react'
import { motion } from 'motion/react'
import { setTodoDone } from '../db/repo'
import type { DateStr } from '../domain/dates'
import { isOverdue, remindLabel, whenLabel } from '../domain/todos'
import type { Todo } from '../domain/types'
import { tick } from '../lib/haptics'
import { openTodoSheet } from '../lib/todoSheet'
import { CheckCircle } from './CheckCircle'

/** So lange bleibt ein abgehaktes To-do stehen, damit man den Haken noch sieht */
const LEAVE_DELAY_MS = 320
/** Mehr Uhrzeiten passen nicht gut in die Zeile, der Rest steht als „+2“ dahinter */
const MAX_TIMES = 3

/**
 * Eine Zeile: links abhaken, sonst antippen zum Bearbeiten.
 * `showWhen`: den Termin mit anzeigen, wenn er sich nicht schon aus dem Abschnitt ergibt.
 */
export function TodoRow({ todo, today, showWhen = false, compact = false, ref }: {
  todo: Todo
  today: DateStr
  showWhen?: boolean
  compact?: boolean
  ref?: Ref<HTMLLIElement>
}) {
  const [leaving, setLeaving] = useState(false)
  const done = todo.done || leaving
  const overdue = isOverdue(todo, today)

  function toggle() {
    tick()
    if (todo.done) {
      void setTodoDone(todo.id, false)
      return
    }
    setLeaving(true)
    window.setTimeout(() => void setTodoDone(todo.id, true), LEAVE_DELAY_MS)
  }

  // Steht der Tag schon davor, reicht bei Erinnerungen an diesem Tag die Uhrzeit
  const shownDay = showWhen && todo.scope === 'tag' ? todo.date : today
  const times = todo.done ? [] : todo.reminders.slice(0, MAX_TIMES).map((r) => remindLabel(r, today, shownDay))
  const more = todo.done ? 0 : todo.reminders.length - times.length
  const meta = [
    showWhen ? whenLabel(todo, today) : null,
    times.length > 0 ? `🔔 ${times.join(', ')}${more > 0 ? ` +${more}` : ''}` : null,
  ].filter(Boolean)

  return (
    <motion.li
      ref={ref}
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className={`flex items-center ${compact ? '' : 'rounded-2xl bg-surface'}`}
    >
      <button
        type="button"
        onClick={toggle}
        role="checkbox"
        aria-checked={done}
        aria-label={`${todo.title} erledigt`}
        className={`flex shrink-0 items-center justify-center ${compact ? 'size-11' : 'size-14'}`}
      >
        <CheckCircle done={done} color="var(--accent)" size={compact ? 24 : 28} />
      </button>
      <button
        type="button"
        onClick={() => openTodoSheet({ todo })}
        className={`min-w-0 flex-1 pr-3 text-left ${compact ? 'py-1.5' : 'min-h-14 py-2.5'}`}
      >
        <span className={`block text-[16px] leading-snug break-words ${done ? 'text-muted line-through' : ''}`}>{todo.title}</span>
        {meta.length > 0 && (
          <span className={`mt-0.5 block text-[13px] ${overdue ? 'text-warn' : 'text-muted'}`}>{meta.join(' · ')}</span>
        )}
      </button>
    </motion.li>
  )
}

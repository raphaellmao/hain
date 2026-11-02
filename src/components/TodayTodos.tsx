import { AnimatePresence } from 'motion/react'
import { navigate, paths } from '../app/router'
import { useTodos } from '../db/hooks'
import { startOfWeek, type DateStr } from '../domain/dates'
import { urgentTodos } from '../domain/todos'
import { IconChevronRight } from './icons'
import { TodoRow } from './TodoRow'

const MAX_ROWS = 3

/** Auf „Heute“: was heute nicht vergessen werden darf – direkt abhakbar. */
export function TodayTodos({ today }: { today: DateStr }) {
  const todos = useTodos()
  if (!todos) return null

  const urgent = urgentTodos(todos, today)
  const monday = startOfWeek(today)
  const week = todos.filter((t) => !t.done && t.scope === 'woche' && t.date === monday && !urgent.includes(t)).length
  if (urgent.length === 0 && week === 0) return null

  const hidden = urgent.length - MAX_ROWS
  const summary = [
    urgent.length > 0 ? `${urgent.length} für heute` : null,
    week > 0 ? `${week} diese Woche` : null,
  ].filter(Boolean)

  return (
    <section className="mb-3 rounded-3xl bg-surface px-1.5 pt-1 pb-1.5">
      <button
        type="button"
        onClick={() => navigate(paths.todos, { replace: true })}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-2.5 text-left"
      >
        <span className="text-[13px] font-semibold tracking-wide text-muted uppercase">To-dos · {summary.join(' · ')}</span>
        <IconChevronRight width={18} height={18} className="shrink-0 text-muted" />
      </button>
      {urgent.length > 0 && (
        <ul>
          <AnimatePresence mode="popLayout" initial={false}>
            {urgent.slice(0, MAX_ROWS).map((t) => (
              <TodoRow key={t.id} todo={t} today={today} compact showWhen={t.date < today} />
            ))}
          </AnimatePresence>
        </ul>
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => navigate(paths.todos, { replace: true })}
          className="h-10 w-full px-2.5 text-left text-[14px] font-medium text-accent"
        >
          Noch {hidden} weitere ansehen
        </button>
      )}
    </section>
  )
}

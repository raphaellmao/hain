import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { useToday, useTodos } from '../db/hooks'
import { moveTodosToNow } from '../db/repo'
import { startOfWeek, type DateStr } from '../domain/dates'
import { calendarItems } from '../domain/ics'
import { daysLeftInWeek, groupTodos } from '../domain/todos'
import type { Todo } from '../domain/types'
import { Fab } from '../components/Fab'
import { IconPlus } from '../components/icons'
import { TodoRow } from '../components/TodoRow'
import { addToCalendar } from '../lib/calendar'
import { notificationState, requestNotifications, type NotifyState } from '../lib/reminders'
import { openTodoSheet } from '../lib/todoSheet'

export function TodosScreen() {
  const todos = useTodos()
  const today = useToday()
  const [showDone, setShowDone] = useState(false)
  const groups = useMemo(() => groupTodos(todos ?? [], today), [todos, today])

  if (!todos) return null

  const open = groups.overdue.length + groups.today.length + groups.week.length + groups.later.length
  const left = daysLeftInWeek(today)

  return (
    <div className="pb-nav">
      <header className="px-safe pt-safe">
        <div className="pt-2 pb-3">
          <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">
            {open === 0 ? 'Nichts offen' : `${open} offen`}
            {groups.overdue.length > 0 && ` · ${groups.overdue.length} überfällig`}
          </p>
          <h1 className="text-[32px] font-bold leading-tight">To-dos</h1>
        </div>
      </header>

      {/* pb-16: Der Plus-Knopf soll am Ende der Liste nichts verdecken */}
      <main className="px-safe flex flex-col gap-5 pb-16">
        {groups.overdue.length > 0 && (
          <Section
            title="Überfällig"
            warn
            action={
              <button
                type="button"
                onClick={() => void moveTodosToNow(groups.overdue, today, startOfWeek(today))}
                className="h-9 rounded-xl px-2 text-[14px] font-semibold text-accent"
              >
                Auf heute legen
              </button>
            }
          >
            <Rows todos={groups.overdue} today={today} showWhen />
          </Section>
        )}

        <Section title="Heute" onAdd={() => openTodoSheet({ scope: 'tag' })} addLabel="To-do für heute">
          {groups.today.length > 0 ? <Rows todos={groups.today} today={today} /> : <Empty>Für heute steht nichts an.</Empty>}
        </Section>

        <Section
          title="Diese Woche"
          note={left === 1 ? 'letzter Tag' : `noch ${left} Tage`}
          onAdd={() => openTodoSheet({ scope: 'woche' })}
          addLabel="To-do für diese Woche"
        >
          {groups.week.length > 0 ? (
            <Rows todos={groups.week} today={today} showWhen={(t) => t.scope === 'tag'} />
          ) : (
            <Empty>Für den Rest der Woche steht nichts an.</Empty>
          )}
        </Section>

        {groups.later.length > 0 && (
          <Section title="Später">
            <Rows todos={groups.later} today={today} showWhen />
          </Section>
        )}

        {groups.done.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              className="flex min-h-11 w-full items-center justify-between px-1 text-[13px] font-semibold tracking-wide text-muted uppercase"
            >
              Erledigt ({groups.done.length})
              <span className={`transition-transform ${showDone ? 'rotate-90' : ''}`} aria-hidden>
                ›
              </span>
            </button>
            {showDone && <Rows todos={groups.done} today={today} />}
          </section>
        )}

        <ReminderInfo todos={todos} />
      </main>

      <Fab onClick={() => openTodoSheet()} label="Neues To-do" />
    </div>
  )
}

function Section({ title, note, warn, action, onAdd, addLabel, children }: {
  title: string
  note?: string
  warn?: boolean
  action?: ReactNode
  onAdd?: () => void
  addLabel?: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-1 flex min-h-9 items-center justify-between gap-2 px-1">
        <h2 className={`text-[13px] font-semibold tracking-wide uppercase ${warn ? 'text-warn' : 'text-muted'}`}>
          {title}
          {note && <span className="font-medium normal-case"> · {note}</span>}
        </h2>
        {action}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={addLabel}
            className="-mr-1 flex size-9 items-center justify-center rounded-xl text-accent"
          >
            <IconPlus width={20} height={20} />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function Rows({ todos, today, showWhen = false }: { todos: Todo[]; today: DateStr; showWhen?: boolean | ((t: Todo) => boolean) }) {
  return (
    <ul className="flex flex-col gap-2">
      <AnimatePresence mode="popLayout" initial={false}>
        {todos.map((t) => (
          <TodoRow key={t.id} todo={t} today={today} showWhen={typeof showWhen === 'function' ? showWhen(t) : showWhen} />
        ))}
      </AnimatePresence>
    </ul>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[14px] text-muted">{children}</p>
}

/** Ehrlich erklären, wann Hain sich melden kann – und was bei geschlossener App hilft. */
function ReminderInfo({ todos }: { todos: Todo[] }) {
  const [permission, setPermission] = useState<NotifyState>(notificationState)
  const upcoming = calendarItems(todos, new Date())

  return (
    <section className="rounded-3xl bg-surface p-4 text-[14px] leading-snug">
      <h2 className="text-[15px] font-semibold">🔔 So erinnert dich Hain</h2>
      <ul className="mt-2 flex flex-col gap-1.5 text-muted">
        <li>
          <b className="font-semibold text-ink">App offen:</b> Banner zur eingestellten Uhrzeit. Verpasstes kommt beim nächsten Öffnen.
        </li>
        <li>
          <b className="font-semibold text-ink">App zu:</b> Eine Web-App kann ohne Server nichts auslösen – das übernimmt dein Kalender.
        </li>
      </ul>
      <button
        type="button"
        disabled={upcoming.length === 0}
        onClick={() => void addToCalendar(upcoming)}
        className="mt-3 h-12 w-full rounded-2xl bg-surface-2 text-[15px] font-semibold transition-opacity disabled:opacity-50"
      >
        📅{' '}
        {upcoming.length === 0
          ? 'Keine anstehenden Erinnerungen'
          : upcoming.length === 1
            ? '1 Erinnerung in den Kalender'
            : `${upcoming.length} Erinnerungen in den Kalender`}
      </button>
      {permission === 'default' && (
        <button
          type="button"
          onClick={() => void requestNotifications().then(setPermission)}
          className="mt-2 h-12 w-full rounded-2xl bg-surface-2 text-[15px] font-semibold"
        >
          Benachrichtigungen erlauben
        </button>
      )}
      <p className="mt-2 text-[13px] text-muted">
        {permission === 'granted' && 'Benachrichtigungen sind an: Sie kommen, solange Hain im Hintergrund noch läuft.'}
        {permission === 'denied' && 'Benachrichtigungen sind in den Browser-Einstellungen blockiert.'}
        {permission === 'default' && 'Benachrichtigungen kommen nur, solange Hain im Hintergrund noch läuft.'}
        {permission === 'unsupported' && 'Benachrichtigungen gibt es hier nicht. Auf dem iPhone gehen sie erst in der installierten App.'}
      </p>
    </section>
  )
}

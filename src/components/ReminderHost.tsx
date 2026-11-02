import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useToday, useTodos } from '../db/hooks'
import { dismissDueReminders, setTodoDone, snoozeDueReminders } from '../db/repo'
import { addDays, toDateStr } from '../domain/dates'
import { dueReminders, remindLabel, toRemindAt, urgentTodos } from '../domain/todos'
import { celebrate, tick } from '../lib/haptics'
import { notifyTodo, setAppBadge } from '../lib/reminders'

const CHECK_EVERY_MS = 15_000

/**
 * Hält die Erinnerungen im Blick: Banner oben, solange die App offen ist – auch
 * für alles, was verpasst wurde, während sie zu war. Läuft sie noch im
 * Hintergrund, kommt zusätzlich eine Benachrichtigung (falls erlaubt).
 */
export function ReminderHost() {
  const todos = useTodos()
  const today = useToday()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  // Pro To-do ein Banner, auch wenn mehrere seiner Erinnerungen verpasst wurden.
  // Angezeigt wird die jüngste davon.
  const ringing = useMemo(
    () =>
      (todos ?? [])
        .flatMap((todo) => {
          const due = dueReminders(todo, now)
          return due.length > 0 ? [{ todo, at: due[due.length - 1] }] : []
        })
        .sort((a, b) => a.at.localeCompare(b.at)),
    [todos, now],
  )

  // Jede Erinnerung meldet sich nur einmal (Banner bleibt, bis sie weggeklickt ist)
  const announced = useRef(new Set<string>())
  useEffect(() => {
    const fresh = ringing.filter((r) => !announced.current.has(`${r.todo.id}|${r.at}`))
    if (fresh.length === 0) return
    for (const r of fresh) {
      announced.current.add(`${r.todo.id}|${r.at}`)
      if (document.visibilityState === 'hidden') void notifyTodo(r.todo)
    }
    // Vibrieren dürfen Seiten erst, nachdem einmal getippt wurde
    if (document.visibilityState === 'visible' && navigator.userActivation?.hasBeenActive) celebrate()
  }, [ringing])

  // Zahl am App-Symbol: bleibt auch sichtbar, wenn die App zu ist
  const urgent = todos ? urgentTodos(todos, today).length : undefined
  useEffect(() => {
    if (urgent !== undefined) setAppBadge(urgent)
  }, [urgent])

  const first = ringing[0]

  return (
    <AnimatePresence>
      {first && (
        <motion.div
          key={`${first.todo.id}|${first.at}`}
          role="alert"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          className="pointer-events-none fixed inset-x-0 top-0 z-30 px-safe pt-safe"
        >
          <div className="pointer-events-auto mx-auto max-w-md rounded-3xl bg-ink p-3 text-bg shadow-xl">
            <div className="flex items-start gap-2.5 px-1">
              <span className="bell-ring text-[24px] leading-none" aria-hidden>
                🔔
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] opacity-70">
                  Erinnerung · {remindLabel(first.at, today)}
                  {ringing.length > 1 && ` · ${ringing.length - 1} weitere`}
                </p>
                <p className="text-[16px] leading-snug font-semibold break-words">{first.todo.title}</p>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-1.5">
              <button
                type="button"
                onClick={() => {
                  tick()
                  void setTodoDone(first.todo.id, true)
                }}
                className="h-11 rounded-xl bg-accent text-[14px] font-semibold text-accent-ink"
              >
                Erledigt
              </button>
              <BannerButton onClick={() => void snoozeDueReminders(first.todo.id, toRemindAt(new Date(Date.now() + 3_600_000)))}>1 Std.</BannerButton>
              <BannerButton onClick={() => void snoozeDueReminders(first.todo.id, `${addDays(toDateStr(new Date()), 1)}T08:00`)}>Morgen</BannerButton>
              <BannerButton onClick={() => void dismissDueReminders(first.todo.id)}>OK</BannerButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BannerButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="h-11 rounded-xl bg-bg/15 text-[14px] font-medium">
      {children}
    </button>
  )
}

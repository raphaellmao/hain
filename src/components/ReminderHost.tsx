import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useToday, useTodos } from '../db/hooks'
import { finishTodo } from '../app/actions'
import { dismissDueReminders, snoozeDueReminders } from '../db/repo'
import { addDays, toDateStr } from '../domain/dates'
import { dueReminders, remindLabel, toRemindAt, urgentTodos } from '../domain/todos'
import { celebrate, tick } from '../lib/haptics'
import { notifyTodo, setAppBadge } from '../lib/reminders'
import { IconChevronRight } from './icons'

const CHECK_EVERY_MS = 15_000
/** So lange liegt das Banner über dem Seitenkopf, dann wird es zur kleinen Glocke */
const COLLAPSE_AFTER_MS = 12_000

/**
 * Hält die Erinnerungen im Blick: Banner oben, solange die App offen ist – auch
 * für alles, was verpasst wurde, während sie zu war. Läuft sie noch im
 * Hintergrund, kommt zusätzlich eine Benachrichtigung (falls erlaubt).
 *
 * Das Banner soll erinnern, aber nicht im Weg liegen: Nach ein paar Sekunden oder per
 * Wischen nach oben wird es zu einer kleinen Glocke im Daumenbereich. Weg ist die
 * Erinnerung erst, wenn sie erledigt, verschoben oder mit OK bestätigt ist.
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

  // Pro To-do ein Banner, auch wenn mehrere seiner Erinnerungen verpasst wurden. Angezeigt
  // wird jeweils die jüngste, die neueste steht vorn: Sie soll nicht hinter älteren warten.
  const ringing = useMemo(
    () =>
      (todos ?? [])
        .flatMap((todo) => {
          const due = dueReminders(todo, now)
          return due.length > 0 ? [{ todo, at: due[due.length - 1] }] : []
        })
        .sort((a, b) => b.at.localeCompare(a.at)),
    [todos, now],
  )

  // Eingeklappt gilt für genau diese Erinnerung: Die nächste klappt wieder auf
  const [collapsed, setCollapsed] = useState<string | null>(null)

  // Jede Erinnerung meldet sich nur einmal (Banner bleibt, bis sie weggeklickt ist)
  const announced = useRef(new Set<string>())
  useEffect(() => {
    const fresh = ringing.filter((r) => !announced.current.has(`${r.todo.id}|${r.at}`))
    if (fresh.length === 0) return
    setCollapsed(null)
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
  const key = first ? `${first.todo.id}|${first.at}` : null
  const expanded = key !== null && collapsed !== key

  useEffect(() => {
    if (!expanded) return
    const timer = window.setTimeout(() => setCollapsed(key), COLLAPSE_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [expanded, key])

  return (
    <AnimatePresence>
      {first && !expanded && (
        <motion.button
          key="bell"
          type="button"
          onClick={() => setCollapsed(null)}
          aria-label={`Erinnerung: ${first.todo.title}${ringing.length > 1 ? `, ${ringing.length - 1} weitere` : ''}. Anzeigen`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed bottom-nav left-3 z-30 mb-4 flex h-11 max-w-[58vw] items-center gap-1.5 rounded-full bg-ink pr-3.5 pl-3 text-[14px] font-medium text-bg shadow-lg"
        >
          <span className="bell-ring text-[18px] leading-none" aria-hidden>
            🔔
          </span>
          <span className="truncate">{first.todo.title}</span>
          {ringing.length > 1 && <span className="shrink-0 opacity-70">+{ringing.length - 1}</span>}
        </motion.button>
      )}
      {first && expanded && (
        <motion.div
          key={key}
          role="alert"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.7, bottom: 0.05 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (info.offset.y < -28 || info.velocity.y < -300) setCollapsed(key)
          }}
          className="pointer-events-none fixed inset-x-0 top-0 z-30 touch-none px-safe pt-safe"
        >
          <Card>
            <div className="flex items-start gap-2 px-0.5">
              <span className="bell-ring text-[20px] leading-tight" aria-hidden>
                🔔
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] leading-snug font-semibold break-words">{first.todo.title}</p>
                <p className="text-[12px] opacity-70">
                  {remindLabel(first.at, today)}
                  {ringing.length > 1 && ` · ${ringing.length - 1} weitere`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(key)}
                aria-label="Einklappen"
                className="-mt-1 -mr-0.5 flex size-9 shrink-0 items-center justify-center rounded-full opacity-70"
              >
                <IconChevronRight width={18} height={18} className="-rotate-90" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-1.5">
              <button
                type="button"
                onClick={() => {
                  tick()
                  void finishTodo(first.todo.id, today)
                }}
                className="h-10 rounded-xl bg-accent text-[14px] font-semibold text-accent-ink"
              >
                Erledigt
              </button>
              <BannerButton onClick={() => void snoozeDueReminders(first.todo.id, toRemindAt(new Date(Date.now() + 3_600_000)))}>1 Std.</BannerButton>
              <BannerButton onClick={() => void snoozeDueReminders(first.todo.id, `${addDays(toDateStr(new Date()), 1)}T08:00`)}>Morgen</BannerButton>
              <BannerButton onClick={() => void dismissDueReminders(first.todo.id)}>OK</BannerButton>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Die Karte des Banners. Fährt sie gerade weg, nimmt sie keine Tipps mehr an: Sonst träfe „OK“ die vorige Erinnerung. */
function Card({ children }: { children: ReactNode }) {
  const present = useIsPresent()
  return (
    <div inert={!present} className="pointer-events-auto mx-auto max-w-md rounded-3xl bg-ink px-3 pt-2.5 pb-3 text-bg shadow-xl">
      {children}
    </div>
  )
}

function BannerButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="h-10 rounded-xl bg-bg/15 text-[14px] font-medium">
      {children}
    </button>
  )
}

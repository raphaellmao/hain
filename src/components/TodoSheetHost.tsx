import { useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSettings, useToday } from '../db/hooks'
import { createTodo, deleteTodo, TODO_MAX_LENGTH, updateTodo } from '../db/repo'
import { addDays, diffDays, formatDayMonth, maxDate, startOfWeek, type DateStr } from '../domain/dates'
import { calendarItems } from '../domain/ics'
import { dayChipLabel, reminderDays, remindAtFor, remindLabel, shiftRemindAt, toRemindAt } from '../domain/todos'
import type { TodoScope } from '../domain/types'
import { addToCalendar } from '../lib/calendar'
import { tick } from '../lib/haptics'
import { requestNotifications } from '../lib/reminders'
import { closeTodoSheet, useTodoSheetRequest, type TodoSheetRequest } from '../lib/todoSheet'

const TIME_PRESETS = ['08:00', '12:00', '18:00', '20:00']

/** Blatt zum Anlegen und Bearbeiten: Was, wann, und wann Hain überall daran erinnern soll. */
export function TodoSheetHost() {
  const req = useTodoSheetRequest()
  return <AnimatePresence>{req && <Sheet key="todo" req={req} />}</AnimatePresence>
}

const nextFullHour = () => `${String((new Date().getHours() + 1) % 24).padStart(2, '0')}:00`

function Sheet({ req }: { req: TodoSheetRequest }) {
  const today = useToday()
  const { dayStartHour } = useSettings()
  const monday = startOfWeek(today)
  const nextMonday = addDays(monday, 7)
  const todo = req.todo

  const [title, setTitle] = useState(todo?.title ?? '')
  const [scope, setScope] = useState<TodoScope>(todo?.scope ?? req.scope ?? 'tag')
  const [date, setDate] = useState<DateStr>(todo?.date ?? (req.scope === 'woche' ? monday : today))
  const [reminders, setReminders] = useState<string[]>(todo?.reminders ?? [])
  // Für welchen Tag die Uhrzeiten unten gelten; null = der erste passende
  const [remindDay, setRemindDay] = useState<DateStr | null>(null)
  const [customTime, setCustomTime] = useState(nextFullHour)

  const anchor = (d: DateStr) => maxDate(today, d)
  const day = remindDay ?? anchor(date)
  const days = reminderDays(scope, date, today)
  const nowText = toRemindAt(new Date())

  const isChosenDay = scope === 'tag' && date !== today && date !== addDays(today, 1)
  const atFor = (time: string) => remindAtFor(day, time, dayStartHour)
  // Vorbei ist vorbei: Verstrichene Uhrzeiten nur anbieten, solange sie noch zum Abwählen gebraucht werden
  const presets = TIME_PRESETS.filter((t) => atFor(t) > nowText || reminders.includes(atFor(t)))
  const customAt = customTime ? atFor(customTime) : null
  const inPast = reminders.some((r) => r <= nowText && !todo?.reminders.includes(r))
  const hasUpcoming = reminders.some((r) => r > nowText)

  /** Wandert das To-do auf einen anderen Tag, wandern seine Erinnerungen mit. Was dabei in die Vergangenheit rutscht, entfällt. */
  function pick(s: TodoScope, d: DateStr) {
    const delta = diffDays(anchor(date), anchor(d))
    if (delta !== 0) setReminders((list) => list.map((r) => shiftRemindAt(r, delta)).filter((r) => r > nowText))
    setScope(s)
    setDate(d)
    setRemindDay(null)
  }

  const toggle = (at: string) =>
    setReminders((list) => (list.includes(at) ? list.filter((r) => r !== at) : [...list, at].sort()))

  function addCustom() {
    if (customAt && !reminders.includes(customAt)) toggle(customAt)
  }

  function save(withCalendar: boolean) {
    const text = title.trim()
    if (!text) return
    const id = todo?.id ?? crypto.randomUUID()
    const input = { title: text, scope, date, reminders }
    const saved = todo ? updateTodo(id, input) : createTodo(id, input)
    tick()
    closeTodoSheet()
    // Beides braucht das Tippen als Auslöser, deshalb direkt hier und ohne vorheriges Warten
    if (withCalendar) void addToCalendar(calendarItems([{ id, title: text, done: false, reminders }], new Date()), saved)
    else if (reminders.length > 0) void requestNotifications()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save(false)
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Schließen" className="absolute inset-0 bg-black/40" onClick={closeTodoSheet} />
      <motion.form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-title"
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface px-5 pt-3 pb-safe"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <h2 id="todo-title" className="text-[22px] font-bold leading-tight">
          {todo ? 'To-do bearbeiten' : 'Neues To-do'}
        </h2>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TODO_MAX_LENGTH}
          placeholder="Was darfst du nicht vergessen?"
          aria-label="Was darfst du nicht vergessen?"
          enterKeyHint="done"
          autoFocus={!todo}
          className="mt-3 h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
        />

        <Label>Wann</Label>
        <div className="flex flex-wrap gap-2">
          <Chip active={scope === 'tag' && date === today} onClick={() => pick('tag', today)}>
            Heute
          </Chip>
          <Chip active={scope === 'tag' && date === addDays(today, 1)} onClick={() => pick('tag', addDays(today, 1))}>
            Morgen
          </Chip>
          <Chip active={scope === 'woche' && date === monday} onClick={() => pick('woche', monday)}>
            Diese Woche
          </Chip>
          <Chip active={scope === 'woche' && date === nextMonday} onClick={() => pick('woche', nextMonday)}>
            Nächste Woche
          </Chip>
          <DateChip
            active={isChosenDay}
            label={isChosenDay ? `📅 ${formatDayMonth(date)}` : '📅 Tag wählen'}
            ariaLabel="Tag wählen"
            min={today}
            value={scope === 'tag' ? date : ''}
            onChange={(v) => pick('tag', v)}
          />
        </div>

        <Label>{reminders.length > 1 ? `${reminders.length} Erinnerungen` : 'Erinnern'}</Label>
        {reminders.length > 0 ? (
          <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Eingestellte Erinnerungen">
            {reminders.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  aria-label={`Erinnerung ${remindLabel(r, today, null)} entfernen`}
                  className={`flex h-10 items-center gap-1.5 rounded-full pr-2.5 pl-3 text-[14px] font-medium tabular-nums ${
                    r <= nowText ? 'bg-warn/15' : 'bg-accent/15'
                  }`}
                >
                  🔔 {remindLabel(r, today, null)}
                  <span className="text-[12px] text-muted" aria-hidden>
                    ✕
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 text-[13px] text-muted">Tippe eine oder mehrere Uhrzeiten an – auch an verschiedenen Tagen.</p>
        )}

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Erinnern an welchem Tag">
          {days.map((d) => (
            <Chip key={d} small active={d === day} onClick={() => setRemindDay(d)}>
              {dayChipLabel(d, today)}
            </Chip>
          ))}
          <DateChip
            small
            active={!days.includes(day)}
            label={days.includes(day) ? '📅 Anderer Tag' : `📅 ${formatDayMonth(day)}`}
            ariaLabel="Anderer Tag für die Erinnerung"
            min={today}
            value={day}
            onChange={setRemindDay}
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Uhrzeiten">
          {presets.map((t) => (
            <Chip key={t} small active={reminders.includes(atFor(t))} onClick={() => toggle(atFor(t))}>
              {t}
            </Chip>
          ))}
          {/* Eigene Zeit mit eigenem Knopf: Beim Drehen am Rad entstünde sonst bei jedem Schritt eine Erinnerung */}
          <span className="flex gap-1.5">
            <input
              type="time"
              aria-label="Eigene Uhrzeit"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                addCustom()
              }}
              className="h-10 min-w-24 rounded-xl bg-surface-2 px-2.5 text-[15px] font-medium tabular-nums outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!customAt || reminders.includes(customAt)}
              className="h-10 rounded-xl bg-surface-2 px-3 text-[15px] font-semibold text-accent transition-opacity disabled:opacity-40"
            >
              + Dazu
            </button>
          </span>
        </div>

        {inPast && <p className="mt-2 text-[13px] text-warn">Eine Uhrzeit ist schon vorbei – diese Erinnerung kommt sofort.</p>}
        {reminders.length > 0 && !inPast && (
          <p className="mt-2 text-[13px] leading-snug text-muted">
            Hain meldet sich, wenn es offen ist, sonst beim nächsten Öffnen. Bei geschlossener App erinnert dich nur der Kalender.
          </p>
        )}

        <div className="mt-4 mb-3 flex flex-col gap-2">
          <button
            type="submit"
            disabled={!title.trim()}
            className="h-13 rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink transition-opacity disabled:opacity-40"
          >
            {todo ? 'Speichern' : 'Hinzufügen'}
          </button>
          {hasUpcoming && (
            <button
              type="button"
              disabled={!title.trim()}
              onClick={() => save(true)}
              className="h-12 rounded-2xl bg-surface-2 text-[16px] font-medium transition-opacity disabled:opacity-40"
            >
              📅 {todo ? 'Speichern' : 'Hinzufügen'} und in den Kalender
            </button>
          )}
          {todo && (
            <button
              type="button"
              onClick={() => {
                void deleteTodo(todo.id)
                closeTodoSheet()
              }}
              className="h-12 rounded-2xl text-[16px] font-medium text-danger"
            >
              To-do löschen
            </button>
          )}
        </div>
      </motion.form>
    </motion.div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mt-4 mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</p>
}

const chipClass = (active: boolean, small = false) =>
  `flex items-center justify-center rounded-xl font-medium tabular-nums transition-colors ${
    small ? 'h-10 px-3 text-[14px]' : 'h-11 px-3.5 text-[15px]'
  } ${active ? 'bg-ink text-bg' : 'bg-surface-2'}`

function Chip({ active, small, onClick, children }: { active: boolean; small?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={chipClass(active, small)}>
      {children}
    </button>
  )
}

/** Sieht aus wie die anderen, darüber liegt unsichtbar das Datumsfeld – so öffnet sich die Auswahl des Handys. */
function DateChip({ active, small, label, ariaLabel, min, value, onChange }: {
  active: boolean
  small?: boolean
  label: string
  ariaLabel: string
  min: string
  value: string
  onChange: (value: DateStr) => void
}) {
  return (
    <label className={`relative overflow-hidden ${chipClass(active, small)}`}>
      {label}
      <input
        type="date"
        aria-label={ariaLabel}
        min={min}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  )
}

import { useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSettings, useToday } from '../db/hooks'
import { createTodo, deleteTodo, TODO_MAX_LENGTH, updateTodo } from '../db/repo'
import { addDays, eachDay, formatDayMonth, maxDate, minDate, startOfWeek, WEEKDAYS_MON0, weekdayMon0, type DateStr } from '../domain/dates'
import { remindAtFor, remindTimeOf, toRemindAt } from '../domain/todos'
import type { TodoScope } from '../domain/types'
import { addToCalendar } from '../lib/calendar'
import { tick } from '../lib/haptics'
import { requestNotifications } from '../lib/reminders'
import { closeTodoSheet, useTodoSheetRequest, type TodoSheetRequest } from '../lib/todoSheet'

const TIME_PRESETS = ['08:00', '12:00', '18:00', '20:00']

/** Blatt zum Anlegen und Bearbeiten: Was, wann, und ob Hain daran erinnern soll. */
export function TodoSheetHost() {
  const req = useTodoSheetRequest()
  return <AnimatePresence>{req && <Sheet key="todo" req={req} />}</AnimatePresence>
}

function Sheet({ req }: { req: TodoSheetRequest }) {
  const today = useToday()
  const { dayStartHour } = useSettings()
  const monday = startOfWeek(today)
  const nextMonday = addDays(monday, 7)
  const todo = req.todo

  const [title, setTitle] = useState(todo?.title ?? '')
  const [scope, setScope] = useState<TodoScope>(todo?.scope ?? req.scope ?? 'tag')
  const [date, setDate] = useState<DateStr>(todo?.date ?? (req.scope === 'woche' ? monday : today))
  const [time, setTime] = useState<string | null>(todo?.remindAt ? remindTimeOf(todo.remindAt) : null)
  // Nur für Wochenaufgaben wählbar: an welchem Tag der Woche erinnern?
  const [remindDay, setRemindDay] = useState<DateStr | null>(todo?.scope === 'woche' && todo.remindAt ? todo.remindAt.slice(0, 10) : null)

  const lastDay = addDays(date, 6)
  const remindOn = scope === 'tag' ? date : minDate(maxDate(remindDay ?? today, date), lastDay)
  const remindAt = time ? remindAtFor(remindOn, time, dayStartHour) : undefined
  const nowText = toRemindAt(new Date())
  const inPast = !!remindAt && remindAt <= nowText && remindAt !== todo?.remindAt

  const pick = (s: TodoScope, d: DateStr) => {
    setScope(s)
    setDate(d)
  }
  const isChosenDay = scope === 'tag' && date !== today && date !== addDays(today, 1)
  // Vorbei ist vorbei: Uhrzeiten, die heute schon verstrichen sind, nicht anbieten
  const presets = TIME_PRESETS.filter((t) => remindAtFor(remindOn, t, dayStartHour) > nowText)
  const customTime = time && !presets.includes(time) ? time : null

  function save(withCalendar: boolean) {
    const text = title.trim()
    if (!text) return
    const id = todo?.id ?? crypto.randomUUID()
    const input = { title: text, scope, date, remindAt }
    void (todo ? updateTodo(id, input) : createTodo(id, input))
    tick()
    closeTodoSheet()
    // Beides braucht das Tippen als Auslöser, deshalb direkt hier und ohne vorheriges Warten
    if (withCalendar && remindAt) void addToCalendar([{ id, title: text, remindAt }])
    else if (remindAt) void requestNotifications()
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
          <InputChip
            active={isChosenDay}
            label={isChosenDay ? `📅 ${formatDayMonth(date)}` : '📅 Tag wählen'}
            type="date"
            ariaLabel="Tag wählen"
            min={today}
            value={scope === 'tag' ? date : ''}
            onChange={(v) => v && pick('tag', v)}
          />
        </div>

        <Label>Erinnern</Label>
        {scope === 'woche' && (
          <div className="mb-2 grid grid-cols-7 gap-1" role="group" aria-label="Erinnern an welchem Tag">
            {[...eachDay(date, lastDay)].map((d) => (
              <button
                key={d}
                type="button"
                disabled={d < today}
                onClick={() => setRemindDay(d)}
                aria-pressed={d === remindOn}
                className={`h-11 rounded-xl text-[14px] font-medium transition-colors disabled:opacity-30 ${
                  d === remindOn ? 'bg-ink text-bg' : 'bg-surface-2'
                }`}
              >
                {WEEKDAYS_MON0[weekdayMon0(d)]}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Chip active={time === null} onClick={() => setTime(null)}>
            Keine
          </Chip>
          {presets.map((t) => (
            <Chip key={t} active={time === t} onClick={() => setTime(t)}>
              {t}
            </Chip>
          ))}
          <InputChip
            active={!!customTime}
            label={customTime ?? 'Uhrzeit …'}
            type="time"
            ariaLabel="Eigene Uhrzeit"
            value={time ?? ''}
            onChange={(v) => setTime(v || null)}
          />
        </div>
        {inPast && <p className="mt-2 text-[13px] text-warn">Diese Uhrzeit ist schon vorbei – die Erinnerung kommt sofort.</p>}
        {remindAt && !inPast && (
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
          {remindAt && (
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

const chipClass = (active: boolean) =>
  `flex h-11 items-center justify-center rounded-xl px-3.5 text-[15px] font-medium tabular-nums transition-colors ${
    active ? 'bg-ink text-bg' : 'bg-surface-2'
  }`

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={chipClass(active)}>
      {children}
    </button>
  )
}

/** Sieht aus wie die anderen, darüber liegt unsichtbar das Eingabefeld – so öffnet sich die Auswahl des Handys. */
function InputChip({ active, label, type, ariaLabel, min, value, onChange }: {
  active: boolean
  label: string
  type: 'date' | 'time'
  ariaLabel: string
  min?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className={`relative overflow-hidden ${chipClass(active)}`}>
      {label}
      <input
        type={type}
        aria-label={ariaLabel}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  )
}

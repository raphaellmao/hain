import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { useSettings, useToday } from '../db/hooks'
import { createTodo, deleteTodo, skipTodo, TODO_MAX_LENGTH, updateTodo } from '../db/repo'
import { addDays, diffDays, formatDayMonth, maxDate, startOfWeek, type DateStr } from '../domain/dates'
import { calendarItems } from '../domain/ics'
import { buildRepeat, repeatLabel, restingReminders, rulesFor } from '../domain/repeat'
import { dayChipLabel, reminderDays, remindAtFor, remindLabel, shiftRemindAt, toRemindAt, whenLabel } from '../domain/todos'
import type { RepeatRule, TodoScope } from '../domain/types'
import { addToCalendar } from '../lib/calendar'
import { tick } from '../lib/haptics'
import { requestNotifications } from '../lib/reminders'
import { showToast } from '../lib/toast'
import { closeTodoSheet, useTodoSheetRequest, type TodoSheetRequest } from '../lib/todoSheet'
import { BottomSheet } from './BottomSheet'

const TIME_PRESETS = ['08:00', '12:00', '18:00', '20:00']

/** Blatt zum Anlegen und Bearbeiten: Was, wann, und wann Hain überall daran erinnern soll. */
export function TodoSheetHost() {
  const req = useTodoSheetRequest()
  return <AnimatePresence>{req && <Sheet key="todo" req={req} />}</AnimatePresence>
}

/** Vorschlag für die eigene Uhrzeit. Nach 23 Uhr nicht 00:00: Das läge heute in der Vergangenheit */
function nextFullHour(): string {
  const hour = new Date().getHours()
  return hour === 23 ? '23:59' : `${String(hour + 1).padStart(2, '0')}:00`
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
  const [reminders, setReminders] = useState<string[]>(todo?.reminders ?? [])
  // Für welchen Tag die Uhrzeiten unten gelten; null = der erste passende
  const [remindDay, setRemindDay] = useState<DateStr | null>(null)
  const [customTime, setCustomTime] = useState(nextFullHour)
  const [rule, setRule] = useState<RepeatRule | null>(todo?.repeat?.rule ?? null)
  const [showRepeat, setShowRepeat] = useState(!!todo?.repeat)
  // Erinnerungen der Reihe, die heute schon geklingelt haben: kommen beim nächsten Termin wieder
  const [resting, setResting] = useState(() => (todo ? restingReminders(todo) : []))
  // Ein Blatt speichert genau einmal, auch bei schnellem Doppeltipp
  const saved = useRef(false)

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
    setRule((r) => (r && rulesFor(s).includes(r) ? r : null))
  }

  const toggle = (at: string) =>
    setReminders((list) => (list.includes(at) ? list.filter((r) => r !== at) : [...list, at].sort()))

  function addCustom() {
    if (customAt && !reminders.includes(customAt)) toggle(customAt)
  }

  function save(withCalendar: boolean) {
    const text = title.trim()
    if (!text || saved.current) return
    saved.current = true
    const id = todo?.id ?? crypto.randomUUID()
    // Bereits erledigte Termine behalten ihre Wiederholung, nur so lässt sich das Abhaken zurücknehmen
    const repeat = todo?.done ? todo.repeat : rule ? buildRepeat(rule, date, reminders, resting, todo) : undefined
    const input = { title: text, scope, date, reminders, repeat }
    const written = todo ? updateTodo(id, input) : createTodo(id, input)
    tick()
    closeTodoSheet()
    // Beides braucht das Tippen als Auslöser, deshalb direkt hier und ohne vorheriges Warten
    if (withCalendar) void addToCalendar(calendarItems([{ id, title: text, done: false, reminders }], new Date()), written)
    else if (reminders.length > 0) void requestNotifications()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save(false)
  }

  return (
    <BottomSheet
      labelledBy="todo-title"
      onClose={closeTodoSheet}
      onSubmit={onSubmit}
      footer={
        <button
          type="submit"
          disabled={!title.trim()}
          className="h-13 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink transition-opacity disabled:opacity-40"
        >
          {todo ? 'Speichern' : 'Hinzufügen'}
        </button>
      }
    >
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

        {!todo?.done && (
          <>
            <button
              type="button"
              onClick={() => setShowRepeat((v) => !v)}
              aria-expanded={showRepeat}
              className="mt-4 flex min-h-8 w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-[13px] font-semibold tracking-wide text-muted uppercase">Wiederholen</span>
              <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-medium">
                <span className="truncate">{rule ? `🔁 ${repeatLabel(rule, date, scope)}` : 'Nie'}</span>
                <span className={`text-muted transition-transform ${showRepeat ? 'rotate-90' : ''}`} aria-hidden>
                  ›
                </span>
              </span>
            </button>
            {showRepeat && (
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Wie oft wiederholen">
                <Chip small active={rule === null} onClick={() => setRule(null)}>
                  Nie
                </Chip>
                {rulesFor(scope).map((r) => (
                  <Chip key={r} small active={rule === r} onClick={() => setRule(r)}>
                    {repeatLabel(r, date, scope)}
                  </Chip>
                ))}
              </div>
            )}
          </>
        )}

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
        {rule && resting.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Erinnerungen ab dem nächsten Termin">
            {resting.map((p) => (
              <li key={`${p.days}|${p.time}`}>
                <button
                  type="button"
                  onClick={() => setResting((list) => list.filter((x) => x !== p))}
                  aria-label={`Erinnerung ${p.time} aus der Reihe entfernen`}
                  className="flex h-10 items-center gap-1.5 rounded-full bg-surface-2 pr-2.5 pl-3 text-[14px] text-muted tabular-nums"
                >
                  🔁 nächstes Mal {p.time}
                  <span className="text-[12px]" aria-hidden>
                    ✕
                  </span>
                </button>
              </li>
            ))}
          </ul>
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

        <div className="mt-4 flex flex-col gap-2 empty:hidden">
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
          {todo?.repeat && !todo.done && (
            <button
              type="button"
              onClick={() => {
                closeTodoSheet()
                void skipTodo(todo.id, today).then((d) => {
                  if (d) showToast(`Nächster Termin: ${whenLabel({ scope: todo.scope, date: d }, today)}`, '🔁')
                })
              }}
              className="h-12 rounded-2xl bg-surface-2 text-[16px] font-medium"
            >
              Diesen Termin überspringen
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
              {todo.repeat && !todo.done ? 'Wiederholung beenden und löschen' : 'To-do löschen'}
            </button>
          )}
        </div>
    </BottomSheet>
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

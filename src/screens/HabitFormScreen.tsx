import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useHabit, useToday } from '../db/hooks'
import { createHabit, deleteHabit, newSeed, updateHabit, type HabitInput } from '../db/repo'
import { COLOR_KEYS, COLORS, colorHex, type ColorKey } from '../domain/colors'
import { type DateStr, WEEKDAYS_MON0 } from '../domain/dates'
import { ALL_DAYS, daysAt } from '../domain/schedule'
import type { Habit } from '../domain/types'
import { goBack, navigate, paths } from '../app/router'
import { confirmDialog } from '../lib/confirm'
import { Tree } from '../tree/Tree'
import { IconDice, IconTrash } from '../components/icons'

const QUICK_EMOJIS = [
  '📖', '🏃', '💧', '🧘', '💪', '🥗', '😴', '✍️',
  '🎸', '🧠', '🚶', '🦷', '🌱', '☀️', '📵', '🧹',
  '💊', '🗣️', '🚴', '🙏', '🎨', '💰', '🧊', '🍎',
]

/** Neues Habit anlegen (id fehlt) oder bestehendes bearbeiten. */
export function HabitFormScreen({ id }: { id?: string }) {
  const habit = useHabit(id ?? '')
  const today = useToday()
  if (id && habit === undefined) return null // lädt noch
  if (id && habit === null) {
    return (
      <div className="px-safe pt-safe py-10 text-center text-muted">
        Diese Gewohnheit gibt es nicht mehr.
        <button type="button" onClick={() => navigate(paths.today, { replace: true })} className="mt-4 block w-full h-11 text-accent">
          Zu „Heute“
        </button>
      </div>
    )
  }
  return <Form habit={habit ?? undefined} today={today} />
}

function Form({ habit, today }: { habit?: Habit; today: DateStr }) {
  const [name, setName] = useState(habit?.name ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? '🌱')
  const [color, setColor] = useState<ColorKey>(habit?.color ?? randomColor())
  const [days, setDays] = useState<number[]>(habit ? daysAt(habit.schedule, today) : ALL_DAYS)
  const [startDate, setStartDate] = useState<DateStr>(habit?.startDate ?? today)
  const [seed, setSeed] = useState(habit?.seed ?? newSeed())
  const [saving, setSaving] = useState(false)

  const daily = days.length === 7
  const valid = name.trim().length > 0 && days.length > 0 && startDate <= today

  async function save() {
    if (!valid || saving) return
    setSaving(true)
    const input: HabitInput = { name, emoji, color, days, startDate, seed }
    if (habit) {
      await updateHabit(habit.id, input, today)
      goBack(paths.habit(habit.id))
    } else {
      await createHabit(input)
      navigate(paths.today, { replace: true })
    }
  }

  async function remove() {
    if (!habit) return
    const ok = await confirmDialog({
      title: `„${habit.name}“ löschen?`,
      message: 'Der Baum und alle abgehakten Tage verschwinden aus der App.',
      confirm: 'Löschen',
      danger: true,
    })
    if (!ok) return
    await deleteHabit(habit.id)
    navigate(paths.garden, { replace: true })
  }

  const toggleDay = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)))

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="min-h-dvh"
    >
      <div className="px-safe pt-safe pb-32">
        <div className="flex h-12 items-center justify-between">
          <button type="button" onClick={() => goBack()} className="-ml-1 h-11 pr-3 text-[17px] text-accent">
            Abbrechen
          </button>
          <h1 className="text-[17px] font-semibold">{habit ? 'Bearbeiten' : 'Neue Gewohnheit'}</h1>
          <span className="w-20" />
        </div>

        {/* Vorschau: so sieht der Baum ausgewachsen aus */}
        <section className="mt-2 rounded-3xl bg-surface px-4 pt-3 pb-1">
          <div className="mx-auto aspect-square w-48">
            <Tree seed={seed} color={color} g={6.7} className="size-full" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted">Dein Baum, wenn er blüht</p>
            <button
              type="button"
              onClick={() => setSeed(newSeed())}
              className="-mr-2 flex h-11 items-center gap-1.5 rounded-full px-2 text-[15px] font-medium text-accent"
            >
              <IconDice width={20} height={20} />
              Andere Form
            </button>
          </div>
        </section>

        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="z. B. 10 Minuten lesen"
            enterKeyHint="done"
            className="h-13 w-full rounded-2xl bg-surface px-4 text-[17px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
          />
        </Field>

        <Field label="Symbol">
          <div className="grid grid-cols-8 gap-1 rounded-2xl bg-surface p-2">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
                className={`flex aspect-square min-h-10 items-center justify-center rounded-xl text-[22px] ${
                  emoji === e ? 'bg-surface-2 ring-2 ring-accent' : ''
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <label className="mt-2 flex h-12 items-center gap-3 rounded-2xl bg-surface px-4 text-[15px] text-muted">
            Eigenes Emoji:
            <input
              value={QUICK_EMOJIS.includes(emoji) ? '' : emoji}
              onChange={(e) => {
                const g = lastGrapheme(e.target.value)
                if (g) setEmoji(g)
              }}
              placeholder="tippen"
              className="w-24 bg-transparent text-[22px] text-ink outline-none placeholder:text-[15px] placeholder:text-muted"
            />
          </label>
        </Field>

        <Field label="Farbe der Blüten">
          <div className="grid grid-cols-4 justify-items-center gap-1 rounded-2xl bg-surface p-2">
            {COLOR_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setColor(k)}
                aria-label={COLORS[k].label}
                aria-pressed={color === k}
                className="flex size-11 items-center justify-center rounded-full"
              >
                <span
                  className={`size-8 rounded-full transition-transform ${color === k ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`}
                  style={{ background: colorHex(k) }}
                />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Häufigkeit">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
            {[
              { label: 'Täglich', on: daily, set: () => setDays(ALL_DAYS) },
              { label: 'Bestimmte Tage', on: !daily, set: () => daily && setDays([1, 2, 3, 4, 5]) },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={o.set}
                aria-pressed={o.on}
                className={`h-11 rounded-xl text-[15px] font-medium transition-colors ${o.on ? 'bg-ink text-bg' : 'text-muted'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {!daily && (
            <div className="mt-2 grid grid-cols-7 gap-1">
              {WEEKDAYS_MON0.map((label, i) => {
                const d = (i + 1) % 7 // Mo=1 … So=0
                const on = days.includes(d)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={on}
                    className={`h-11 rounded-xl text-[15px] font-semibold transition-colors ${
                      on ? 'bg-accent text-accent-ink' : 'bg-surface text-muted'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
          {days.length === 0 && <p className="mt-1.5 text-[13px] text-danger">Mindestens einen Tag wählen.</p>}
          {habit && <p className="mt-1.5 text-[13px] text-muted">Änderungen gelten ab heute, vergangene Tage bleiben, wie sie waren.</p>}
        </Field>

        <Field label="Startdatum">
          <input
            type="date"
            value={startDate}
            max={today}
            onChange={(e) => e.target.value && setStartDate(e.target.value)}
            className="h-13 w-full rounded-2xl bg-surface px-4 text-[17px] outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="mt-1.5 text-[13px] text-muted">
            Ab hier zählen verpasste Tage. Früher anfangen, um eine laufende Serie nachzutragen.
          </p>
        </Field>

        {habit && (
          <button
            type="button"
            onClick={remove}
            className="mt-8 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-surface text-[17px] font-medium text-danger"
          >
            <IconTrash width={20} height={20} />
            Gewohnheit löschen
          </button>
        )}
      </div>

      {/* Speichern unten im Daumenbereich */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 px-safe pt-3 pb-safe backdrop-blur-md">
        <button
          type="button"
          onClick={save}
          disabled={!valid || saving}
          className="mb-3 h-13 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink transition-opacity disabled:opacity-40"
        >
          {habit ? 'Speichern' : 'Pflanzen'}
        </button>
      </div>
    </motion.div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-1.5 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{label}</h2>
      {children}
    </section>
  )
}

/**
 * Letztes sichtbares Zeichen der Eingabe (= das zuletzt getippte Emoji).
 * Intl.Segmenter hält zusammengesetzte Emojis (👩‍💻, 🇩🇪) zusammen.
 */
function lastGrapheme(s: string): string {
  const seg = new Intl.Segmenter('de', { granularity: 'grapheme' })
  let last = ''
  for (const { segment } of seg.segment(s.trim())) last = segment
  return last
}

function randomColor(): ColorKey {
  return COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)]
}

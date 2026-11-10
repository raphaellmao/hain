import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { goBack, navigate, paths } from '../app/router'
import { useHabits, useRoutines } from '../db/hooks'
import { deleteRoutine, saveRoutine } from '../db/repo'
import { PLAN_MAX, PLAN_SUGGESTIONS, ROUTINE_EMOJIS, ROUTINE_NAME_MAX } from '../domain/routine'
import type { Habit, Routine } from '../domain/types'
import { confirmDialog } from '../lib/confirm'
import { tick } from '../lib/haptics'
import { showToast } from '../lib/toast'
import { IconTrash } from '../components/icons'

/** Routine anlegen (id fehlt) oder bearbeiten: Name, Anker und die Kette der Gewohnheiten */
export function RoutineFormScreen({ id }: { id?: string }) {
  const habits = useHabits()
  const routines = useRoutines()
  if (!habits || !routines) return null
  const routine = id ? routines.find((r) => r.id === id) : undefined
  if (id && !routine) {
    return (
      <div className="px-safe pt-safe py-10 text-center text-muted">
        Diese Routine gibt es nicht mehr.
        <button type="button" onClick={() => navigate(paths.habits, { replace: true })} className="mt-4 block h-11 w-full text-accent">
          Zu den Gewohnheiten
        </button>
      </div>
    )
  }
  return <Form routine={routine} habits={habits} routines={routines} />
}

function Form({ routine, habits, routines }: { routine?: Routine; habits: Habit[]; routines: Routine[] }) {
  const byId = new Map(habits.map((h) => [h.id, h]))
  const [name, setName] = useState(routine?.name ?? '')
  const [emoji, setEmoji] = useState(routine?.emoji ?? ROUTINE_EMOJIS[0])
  const [cue, setCue] = useState(routine?.cue ?? '')
  // Archivierte oder gelöschte fallen hier still heraus
  const [steps, setSteps] = useState<string[]>(() => (routine?.habitIds ?? []).filter((h) => byId.has(h)))
  const [saving, setSaving] = useState(false)

  const valid = name.trim().length > 0 && steps.length >= 2
  const inOther = (habitId: string) => routines.find((r) => r.id !== routine?.id && r.habitIds.includes(habitId))
  const available = habits.filter((h) => !steps.includes(h.id))

  function move(index: number, by: number) {
    const to = index + by
    if (to < 0 || to >= steps.length) return
    tick()
    const next = [...steps]
    const [m] = next.splice(index, 1)
    next.splice(to, 0, m)
    setSteps(next)
  }

  async function save() {
    if (!valid || saving) return
    setSaving(true)
    await saveRoutine({ name, emoji, cue, habitIds: steps }, routine?.id)
    showToast(routine ? 'Routine gespeichert' : `${name.trim()} angelegt – sie steht jetzt auf „Heute“`, emoji)
    goBack(paths.habits)
  }

  async function remove() {
    if (!routine) return
    const ok = await confirmDialog({
      title: `„${routine.name}“ auflösen?`,
      message: 'Die Gewohnheiten bleiben, wie sie sind – sie stehen dann wieder einzeln auf „Heute“.',
      confirm: 'Auflösen',
      danger: true,
    })
    if (!ok) return
    await deleteRoutine(routine.id)
    navigate(paths.habits, { replace: true })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="min-h-dvh">
      <div className="px-safe pt-safe pb-32">
        <div className="flex h-12 items-center justify-between">
          <button type="button" onClick={() => goBack(paths.habits)} className="-ml-1 h-11 pr-3 text-[17px] text-accent">
            Abbrechen
          </button>
          <h1 className="text-[17px] font-semibold">{routine ? 'Routine bearbeiten' : 'Neue Routine'}</h1>
          <span className="w-20" />
        </div>

        <p className="mt-1 rounded-2xl bg-surface px-4 py-3 text-[14px] leading-snug text-muted">
          <strong className="text-ink">Gewohnheiten stapeln:</strong> Jede erledigte Gewohnheit ist der Auslöser für die nächste. Auf „Heute“
          stehen sie als Kette, die nächste ist hervorgehoben.
        </p>

        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={ROUTINE_NAME_MAX}
            placeholder="z. B. Morgenroutine"
            enterKeyHint="done"
            className="h-13 w-full rounded-2xl bg-surface px-4 text-[17px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
          />
          <div className="mt-2 grid grid-cols-8 gap-1 rounded-2xl bg-surface p-1.5" role="radiogroup" aria-label="Symbol">
            {ROUTINE_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                onClick={() => setEmoji(e)}
                className={`flex aspect-square items-center justify-center rounded-xl text-[22px] ${emoji === e ? 'bg-surface-2 ring-2 ring-accent' : ''}`}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Beginnt … (optional)">
          <input
            value={cue}
            onChange={(e) => setCue(e.target.value)}
            maxLength={PLAN_MAX}
            placeholder="z. B. Nach dem Aufstehen"
            enterKeyHint="done"
            className="h-13 w-full rounded-2xl bg-surface px-4 text-[17px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLAN_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setCue(s)}
                aria-pressed={cue === s}
                className={`h-9 rounded-full px-3 text-[14px] ${cue === s ? 'bg-ink text-bg' : 'bg-surface text-muted'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label={`Reihenfolge (${steps.length})`}>
          {steps.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[14px] text-muted">Füge unten mindestens zwei Gewohnheiten hinzu.</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {steps.map((hid, k) => {
                const h = byId.get(hid)!
                return (
                  <li key={hid} className="flex items-center gap-1 rounded-2xl bg-surface py-1 pr-1 pl-3">
                    <span className="w-5 shrink-0 text-[14px] font-semibold text-muted tabular-nums">{k + 1}.</span>
                    <span className="min-w-0 flex-1 truncate text-[16px]">
                      <span aria-hidden>{h.emoji}</span> {h.name}
                    </span>
                    <StepButton label={`${h.name} nach oben`} disabled={k === 0} onClick={() => move(k, -1)}>
                      ↑
                    </StepButton>
                    <StepButton label={`${h.name} nach unten`} disabled={k === steps.length - 1} onClick={() => move(k, 1)}>
                      ↓
                    </StepButton>
                    <StepButton label={`${h.name} entfernen`} onClick={() => setSteps(steps.filter((x) => x !== hid))}>
                      ✕
                    </StepButton>
                  </li>
                )
              })}
            </ol>
          )}
        </Field>

        {available.length > 0 && (
          <Field label="Hinzufügen">
            <ul className="flex flex-col gap-1.5">
              {available.map((h) => {
                const other = inOther(h.id)
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => {
                        tick()
                        setSteps([...steps, h.id])
                      }}
                      className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface px-4 py-1.5 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px]">
                          <span aria-hidden>{h.emoji}</span> {h.name}
                        </span>
                        {other && <span className="block text-[12px] text-muted">steckt in „{other.name}“ – wird dorthin verschoben</span>}
                      </span>
                      <span className="text-[22px] leading-none text-accent" aria-hidden>
                        +
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Field>
        )}

        {routine && (
          <button
            type="button"
            onClick={remove}
            className="mt-8 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-surface text-[17px] font-medium text-danger"
          >
            <IconTrash width={20} height={20} />
            Routine auflösen
          </button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 px-safe pt-3 pb-safe backdrop-blur-md">
        <button
          type="button"
          onClick={save}
          disabled={!valid || saving}
          className="mb-3 h-13 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink transition-opacity disabled:opacity-40"
        >
          {routine ? 'Speichern' : 'Routine anlegen'}
        </button>
      </div>
    </motion.div>
  )
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[17px] text-muted disabled:opacity-25"
    >
      {children}
    </button>
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

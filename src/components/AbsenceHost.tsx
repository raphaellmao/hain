import { useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { useHabits, useToday } from '../db/hooks'
import { deleteAbsence, saveAbsence } from '../db/repo'
import { absenceProblem, lengthOf } from '../domain/absence'
import { addDays, type DateStr } from '../domain/dates'
import { ABSENCE_REASONS, type ExcuseReason } from '../domain/excuse'
import { tick } from '../lib/haptics'
import { showToast } from '../lib/toast'
import { closeAbsenceSheet, useAbsenceRequest, type AbsenceRequest } from '../lib/absenceSheet'
import { BottomSheet } from './BottomSheet'

const LENGTHS = [
  { days: 1, label: '1 Tag' },
  { days: 7, label: '1 Woche' },
  { days: 14, label: '2 Wochen' },
  { days: 21, label: '3 Wochen' },
]

/** Blatt: Abwesenheit von–bis mit Grund, für alle oder einzelne Gewohnheiten */
export function AbsenceHost() {
  const req = useAbsenceRequest()
  return <AnimatePresence>{req && <Sheet key="absence" req={req} />}</AnimatePresence>
}

function Sheet({ req }: { req: AbsenceRequest }) {
  const today = useToday()
  const habits = useHabits()
  const existing = req.absence
  const [from, setFrom] = useState<DateStr>(existing?.from ?? req.from ?? today)
  const [to, setTo] = useState<DateStr>(existing?.to ?? addDays(req.from ?? today, 6))
  const [reason, setReason] = useState<ExcuseReason>(existing?.reason ?? 'urlaub')
  const [note, setNote] = useState(existing?.note ?? '')
  // undefined = alle Gewohnheiten, auch später angelegte
  const [habitIds, setHabitIds] = useState<string[] | undefined>(existing?.habitIds)

  const problem = absenceProblem(from, to) ?? (habitIds?.length === 0 ? 'Mindestens eine Gewohnheit wählen.' : null)
  const days = problem ? 0 : lengthOf({ from, to })

  function save(e: FormEvent) {
    e.preventDefault()
    if (problem) return
    tick()
    void saveAbsence(existing?.id, { from, to, reason, note, habitIds })
    closeAbsenceSheet()
    showToast(existing ? 'Abwesenheit gespeichert' : `${days} ${days === 1 ? 'Tag' : 'Tage'} eingetragen – nichts welkt`, '🏖️')
  }

  // Bei „Alle“ sehen die einzelnen Knöpfe nicht gewählt aus: Antippen wählt dann genau diese eine
  const toggleHabit = (id: string) => {
    const all = habits?.map((h) => h.id) ?? []
    setHabitIds((list) => {
      if (!list) return [id]
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      return all.length > 0 && all.every((x) => next.includes(x)) ? undefined : next
    })
  }

  return (
    <BottomSheet
      labelledBy="absence-title"
      onClose={closeAbsenceSheet}
      onSubmit={save}
      footer={
        <button
          type="submit"
          disabled={!!problem}
          className="h-13 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink transition-opacity disabled:opacity-40"
        >
          {existing ? 'Speichern' : days > 0 ? `${days} ${days === 1 ? 'Tag' : 'Tage'} eintragen` : 'Eintragen'}
        </button>
      }
    >
      <h2 id="absence-title" className="text-[22px] font-bold leading-tight">
        {existing ? 'Abwesenheit bearbeiten' : 'Abwesenheit planen'}
      </h2>
      <p className="mt-1 text-[14px] leading-snug text-muted">
        Jeder Tag zählt wie „heute nicht möglich“: nichts welkt, die Serie läuft weiter, der Schatten wird nicht stärker.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <DateField label="Von" value={from} onChange={(v) => {
          // Die Länge bleibt, wenn man den Anfang verschiebt
          const length = to >= from ? lengthOf({ from, to }) : 1
          setFrom(v)
          setTo(addDays(v, length - 1))
        }} />
        <DateField label="Bis einschließlich" value={to} min={from} onChange={setTo} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {LENGTHS.map((l) => (
          <Chip key={l.days} active={!problem && days === l.days} onClick={() => setTo(addDays(from, l.days - 1))}>
            {l.label}
          </Chip>
        ))}
      </div>

      <Label>Grund</Label>
      <div className="flex flex-wrap gap-1.5">
        {ABSENCE_REASONS.map((r) => (
          <Chip key={r.key} active={reason === r.key} onClick={() => setReason(r.key)}>
            <span aria-hidden>{r.emoji}</span> {r.label}
          </Chip>
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={140}
        placeholder="Notiz (optional), z. B. Ostsee"
        aria-label="Notiz zur Abwesenheit"
        className="mt-2 h-12 w-full rounded-2xl bg-surface-2 px-4 text-[16px] outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
      />

      <Label>Gewohnheiten</Label>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={habitIds === undefined} onClick={() => setHabitIds(undefined)}>
          Alle
        </Chip>
        {habits?.map((h) => (
          <Chip key={h.id} active={habitIds !== undefined && habitIds.includes(h.id)} onClick={() => toggleHabit(h.id)}>
            <span aria-hidden>{h.emoji}</span> {h.name}
          </Chip>
        ))}
      </div>
      {habitIds === undefined && <p className="mt-1.5 text-[13px] text-muted">Gilt auch für Gewohnheiten, die du später anlegst.</p>}

      {problem && <p className="mt-3 text-[13px] text-danger">{problem}</p>}

      {existing && (
        <button
          type="button"
          onClick={() => {
            void deleteAbsence(existing.id)
            closeAbsenceSheet()
          }}
          className="mt-4 h-12 w-full rounded-2xl text-[16px] font-medium text-danger"
        >
          Abwesenheit löschen
        </button>
      )}
    </BottomSheet>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mt-5 mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</p>
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-10 max-w-full items-center gap-1 rounded-xl px-3 text-[14px] font-medium transition-colors ${active ? 'bg-ink text-bg' : 'bg-surface-2'}`}
    >
      <span className="truncate">{children}</span>
    </button>
  )
}

function DateField({ label, value, min, onChange }: { label: string; value: DateStr; min?: DateStr; onChange: (v: DateStr) => void }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[12px] text-muted">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-12 w-full min-w-0 rounded-xl bg-surface-2 px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent"
      />
    </label>
  )
}

import { useAbsences } from '../db/hooks'
import { endAbsence } from '../db/repo'
import { covers } from '../domain/absence'
import { formatDayMonth, formatWeekdayShort, type DateStr } from '../domain/dates'
import { reasonInfo } from '../domain/excuse'
import { tick } from '../lib/haptics'
import { openAbsenceSheet } from '../lib/absenceSheet'
import { showToast } from '../lib/toast'

/** Auf „Heute“, solange eine Abwesenheit läuft: was pausiert und bis wann – und der Weg zurück. */
export function AbsenceBanner({ today }: { today: DateStr }) {
  const absences = useAbsences()
  const active = absences?.filter((a) => covers(a, today)).sort((a, b) => b.to.localeCompare(a.to))[0]
  if (!active) return null
  const r = reasonInfo(active.reason)
  const scope = active.habitIds ? `${active.habitIds.length} ${active.habitIds.length === 1 ? 'Gewohnheit pausiert' : 'Gewohnheiten pausieren'}` : 'Alle Gewohnheiten pausieren'

  return (
    <section className="mb-3 flex items-center gap-3 rounded-3xl bg-surface py-2 pr-2 pl-4">
      <button type="button" onClick={() => openAbsenceSheet({ absence: active })} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
        <span className="text-[26px] leading-none" aria-hidden>
          {r.emoji}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[16px] leading-tight font-semibold">
            {r.label}
            {active.note && ` · ${active.note}`}
          </span>
          <span className="block text-[13px] text-muted">
            bis {active.to === today ? 'heute' : `${formatWeekdayShort(active.to)}, ${formatDayMonth(active.to)}`} · {scope}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          tick()
          void endAbsence(active, today).then(() => showToast('Willkommen zurück – ab heute zählt es wieder', '👋'))
        }}
        className="h-11 shrink-0 rounded-2xl bg-surface-2 px-3 text-[14px] font-semibold text-accent"
      >
        Früher zurück
      </button>
    </section>
  )
}

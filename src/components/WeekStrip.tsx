import type { ReactNode } from 'react'
import { addDays, dayOfMonth, formatWeekdayShort, type DateStr } from '../domain/dates'

/**
 * Die letzten 7 Tage zum schnellen Nachtragen. Ring um die Zahl =
 * wie viel an dem Tag erledigt wurde.
 */
export function WeekStrip({
  today,
  selected,
  progress,
  onSelect,
}: {
  today: DateStr
  selected: DateStr
  /** Anteil erledigter fälliger Habits 0 … 1, null = nichts fällig */
  progress: (date: DateStr) => number | null
  onSelect: (date: DateStr) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))

  return (
    <div className="flex justify-between gap-1">
      {days.map((d) => {
        const isSel = d === selected
        const ratio = progress(d)
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            aria-pressed={isSel}
            aria-label={d === today ? 'Heute' : d}
            className={`flex min-h-16 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${
              isSel ? 'bg-ink text-bg' : 'text-ink'
            }`}
          >
            <span className={`text-[11px] font-medium ${isSel ? 'opacity-80' : 'text-muted'}`}>
              {d === today ? 'Heute' : formatWeekdayShort(d)}
            </span>
            <Ring ratio={ratio} selected={isSel}>
              {dayOfMonth(d)}
            </Ring>
          </button>
        )
      })}
    </div>
  )
}

function Ring({ ratio, selected, children }: { ratio: number | null; selected: boolean; children: ReactNode }) {
  const r = 14
  const c = 2 * Math.PI * r
  return (
    <span className="relative flex size-8 items-center justify-center text-sm font-semibold tabular-nums">
      <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="16" cy="16" r={r} fill="none" strokeWidth="2.5" stroke="currentColor" opacity={ratio === null ? 0 : 0.15} />
        {ratio !== null && ratio > 0 && (
          <circle
            cx="16"
            cy="16"
            r={r}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            stroke={selected ? 'currentColor' : 'var(--accent)'}
            strokeDasharray={`${c * ratio} ${c}`}
            style={{ transition: 'stroke-dasharray .4s ease' }}
          />
        )}
      </svg>
      {children}
    </span>
  )
}

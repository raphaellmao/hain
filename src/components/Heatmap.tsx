import type { CSSProperties } from 'react'
import { addDays, formatMonthShort, startOfWeek, type DateStr } from '../domain/dates'
import { dayState, type DayState } from '../domain/stats'
import type { DoneSet, Habit } from '../domain/types'

/**
 * Kalender-Heatmap wie bei GitHub: eine Spalte pro Woche (Mo oben, So unten),
 * die letzte Spalte ist die aktuelle Woche. Nur zum Ansehen – die Kästchen
 * sind für Finger zu klein. Korrigiert wird im Monatskalender darunter.
 */
export function Heatmap({
  habit,
  done,
  excused,
  today,
  color,
  weeks = 22,
}: {
  habit: Habit
  done: DoneSet
  /** ausgesetzte Tage („nicht möglich“) */
  excused?: DoneSet
  today: DateStr
  color: string
  weeks?: number
}) {
  const firstMonday = addDays(startOfWeek(today), -(weeks - 1) * 7)
  const columns = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(firstMonday, w * 7 + d)),
  )

  // Monatsname über der Spalte, in der ein neuer Monat beginnt – mit
  // mindestens 3 Spalten Abstand, damit sich die Namen nicht überlappen
  let lastLabel = -3
  const labels = columns.map((col, w) => {
    const month = col[6].slice(0, 7)
    const prev = w > 0 ? columns[w - 1][6].slice(0, 7) : null
    if (month === prev || w > weeks - 2 || w - lastLabel < 3) return ''
    // ganz links nur beschriften, wenn der nächste Monat nicht gleich folgt
    if (w === 0 && columns.slice(1, 3).some((c) => c[6].slice(0, 7) !== month)) return ''
    lastLabel = w
    return formatMonthShort(col[6])
  })

  let hit = 0
  let due = 0
  for (const col of columns) {
    for (const d of col) {
      const s = dayState(habit, done, d, today, excused)
      if (s === 'done') hit++
      if (s === 'done' || s === 'missed') due++
    }
  }

  const style = (s: DayState): CSSProperties => {
    switch (s) {
      case 'done':
        return { background: color }
      case 'missed':
        return { background: 'color-mix(in srgb, var(--warn) 28%, var(--surface-2))' }
      case 'excused':
        return { boxShadow: 'inset 0 0 0 1.5px var(--muted)', opacity: 0.6 }
      case 'rest':
        return { background: 'var(--surface-2)', opacity: 0.5 }
      case 'open':
        return { boxShadow: `inset 0 0 0 1.5px ${color}` }
      default:
        return {}
    }
  }

  return (
    <div role="img" aria-label={`In den letzten ${weeks} Wochen ${hit} Tage erledigt`}>
      <div className="mb-1 flex gap-[3px] text-[10px] text-muted" aria-hidden>
        {labels.map((l, i) => (
          <span key={i} className="flex-1 overflow-visible whitespace-nowrap">
            {l}
          </span>
        ))}
      </div>
      <div className="flex gap-[3px]" aria-hidden>
        {columns.map((col, w) => (
          <div key={w} className="flex flex-1 flex-col gap-[3px]">
            {col.map((d) => (
              <span key={d} className="aspect-square rounded-[3px]" style={style(dayState(habit, done, d, today, excused))} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
        <Legend style={{ background: color }} label="erledigt" />
        <Legend style={style('missed')} label="verpasst" />
        <Legend style={style('rest')} label="nicht fällig" />
        {excused && excused.size > 0 && <Legend style={style('excused')} label="ausgesetzt" />}
        <span className="ml-auto tabular-nums">
          {hit} / {due} fällig
        </span>
      </div>
    </div>
  )
}

function Legend({ style, label }: { style: CSSProperties; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-[3px]" style={style} />
      {label}
    </span>
  )
}

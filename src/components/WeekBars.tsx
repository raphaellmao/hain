import { useState } from 'react'
import { formatLong, formatWeekdayShort } from '../domain/dates'
import type { ReviewDay } from '../domain/review'

const pct = (r: number) => `${Math.round(r * 100)} %`

const describe = (d: ReviewDay) => (d.rate === null ? 'nichts fällig' : `${pct(d.rate)} · ${d.done} von ${d.due} erledigt`)

/**
 * Quote je Wochentag als schmale Balken (eine Reihe → keine Legende). Ein Tipp
 * auf einen Tag zeigt dessen Werte in der Zeile darüber.
 */
export function WeekBars({ days }: { days: ReviewDay[] }) {
  // Zu Beginn der letzte Tag mit Werten
  const lastRated = days.reduce((found, d, i) => (d.rate !== null ? i : found), days.length - 1)
  const [selected, setSelected] = useState(lastRated)
  const sel = days[selected]

  return (
    <div>
      <p className="min-h-[38px] text-[14px] leading-tight" aria-live="polite">
        <span className="font-semibold">{formatLong(sel.date)}</span>
        <br />
        <span className="text-muted tabular-nums">{describe(sel)}</span>
      </p>

      <div
        className="relative mt-3 h-28"
        role="img"
        aria-label={`Quote je Wochentag: ${days.map((d) => `${formatWeekdayShort(d.date)} ${d.rate === null ? 'keine' : pct(d.rate)}`).join(', ')}`}
      >
        {/* zurückhaltende Hilfslinien bei 50 % und 100 % */}
        {[1, 0.5].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${g * 100}%` }}>
            <span className="absolute -top-2 right-0 bg-surface pl-1 text-[10px] text-muted tabular-nums">{g * 100} %</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pr-8" aria-hidden>
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              tabIndex={-1}
              onClick={() => setSelected(i)}
              className="relative flex h-full flex-1 items-end justify-center"
            >
              {d.rate === null ? (
                <span className="mb-0.5 text-[12px] text-muted">–</span>
              ) : (
                <span
                  className="w-full max-w-7 rounded-t-[4px] bg-accent transition-[height] duration-500"
                  style={{
                    height: `${Math.max(2, d.rate * 100)}%`,
                    opacity: selected === i ? 1 : 0.7,
                    boxShadow: selected === i ? '0 0 0 2px var(--surface), 0 0 0 3.5px var(--accent)' : undefined,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] pr-8 text-center text-[11px] text-muted" aria-hidden>
        {days.map((d, i) => (
          <span key={d.date} className={`flex-1 ${selected === i ? 'font-semibold text-ink' : ''}`}>
            {formatWeekdayShort(d.date)}
          </span>
        ))}
      </div>

      {/* Tabelle für Screenreader */}
      <table className="sr-only">
        <caption>Quote je Wochentag</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{formatLong(d.date)}</th>
              <td>{describe(d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

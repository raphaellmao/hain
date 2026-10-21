import { useState } from 'react'
import { formatMonthYear } from '../domain/dates'
import type { MonthRate } from '../domain/stats'
import { withContrast } from '../domain/colors'
import { useDarkMode } from '../lib/useDarkMode'

const fmtShort = new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' })
const monthShort = (m: string) => fmtShort.format(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1)).replace('.', '')
const pct = (r: number) => `${Math.round(r * 100)} %`

/**
 * Erfolgsquote je Monat als schmale Balken (eine Reihe → keine Legende).
 * Beschriftet sind nur der laufende und der beste Monat; ein Tipp auf einen
 * Balken zeigt dessen Werte in der Zeile darüber. Im Hellmodus wird die
 * Habit-Farbe abgedunkelt, damit die Balken genug Kontrast zum Grund haben.
 */
export function MonthBars({ data, color }: { data: MonthRate[]; color: string }) {
  const dark = useDarkMode()
  const [selected, setSelected] = useState(data.length - 1)
  const bar = color.startsWith('#') && !dark ? withContrast(color) : color

  const rated = data.filter((m) => m.rate !== null)
  const best = rated.length ? rated.reduce((a, b) => ((b.rate ?? 0) > (a.rate ?? 0) ? b : a)) : null
  const sel = data[selected]

  return (
    <div>
      {/* Wert des gewählten Monats */}
      <p className="min-h-[38px] text-[14px] leading-tight" aria-live="polite">
        <span className="font-semibold">{formatMonthYear(`${sel.month}-01`)}</span>
        {sel.partial && <span className="text-muted"> (bisher)</span>}
        <br />
        <span className="text-muted tabular-nums">
          {sel.rate === null ? 'nichts fällig' : `${pct(sel.rate)} · ${sel.done} von ${sel.due} fälligen Tagen`}
        </span>
      </p>

      <div className="relative mt-7 h-32" role="img" aria-label={`Erfolgsquote je Monat: ${data.map((m) => `${monthShort(m.month)} ${m.rate === null ? 'keine' : pct(m.rate)}`).join(', ')}`}>
        {/* zurückhaltende Hilfslinien bei 50 % und 100 % */}
        {[1, 0.5].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${g * 100}%` }}>
            <span className="absolute -top-2 right-0 bg-surface pl-1 text-[10px] text-muted tabular-nums">{g * 100} %</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pr-8" aria-hidden>
          {data.map((m, i) => {
            const labelled = m.rate !== null && (m.partial || m === best)
            return (
              <button
                key={m.month}
                type="button"
                onClick={() => setSelected(i)}
                className="relative flex h-full flex-1 items-end justify-center"
              >
                {m.rate === null ? (
                  <span className="mb-0.5 text-[12px] text-muted">–</span>
                ) : (
                  <span
                    className="relative w-full max-w-7 rounded-t-[4px] transition-[height] duration-700"
                    style={{
                      height: `${Math.max(2, m.rate * 100)}%`,
                      background: bar,
                      opacity: selected === i ? 1 : 0.75,
                      boxShadow: selected === i ? `0 0 0 2px var(--surface), 0 0 0 3.5px ${bar}` : undefined,
                    }}
                  >
                    {labelled && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap tabular-nums">
                        {pct(m.rate)}
                      </span>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-[2px] pr-8 text-center text-[11px] text-muted" aria-hidden>
        {data.map((m, i) => (
          <span key={m.month} className={`flex-1 ${selected === i ? 'font-semibold text-ink' : ''}`}>
            {monthShort(m.month)}
          </span>
        ))}
      </div>

      {/* Tabelle für Screenreader */}
      <table className="sr-only">
        <caption>Erfolgsquote je Monat</caption>
        <tbody>
          {data.map((m) => (
            <tr key={m.month}>
              <th scope="row">{formatMonthYear(`${m.month}-01`)}</th>
              <td>{m.rate === null ? 'nichts fällig' : `${pct(m.rate)} (${m.done} von ${m.due})`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

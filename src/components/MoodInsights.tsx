import { useMemo } from 'react'
import { doneFor, excusedSet, excusesFor, useDoneMap, useExcuseMap, useHabits, useMoodMap, useToday } from '../db/hooks'
import { formatMood, last30, MOODS, moodEmoji, moodLinks, moodSummary } from '../domain/mood'

/** Unter „Erfolge“: Stimmung der letzten 30 Tage und was den guten Tagen gemeinsam ist */
export function MoodInsights() {
  const moods = useMoodMap()
  const habits = useHabits()
  const doneMap = useDoneMap()
  const excuseMap = useExcuseMap()
  const today = useToday()

  const data = useMemo(() => {
    if (!moods || !habits || !doneMap || !excuseMap) return null
    const { from, to } = last30(today)
    const items = habits.map((habit) => ({ habit, done: doneFor(doneMap, habit.id), excused: excusedSet(excusesFor(excuseMap, habit.id)) }))
    return { summary: moodSummary(moods, from, to), links: moodLinks(items, moods, today).filter((l) => l.diff >= 0.3).slice(0, 3), total: moods.size }
  }, [moods, habits, doneMap, excuseMap, today])

  if (!data) return null
  const { summary, links, total } = data
  const max = Math.max(1, ...summary.counts)

  return (
    <section className="rounded-3xl bg-surface p-4">
      <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Stimmung · letzte 30 Tage</h2>
      {summary.average === null ? (
        <p className="mt-2 text-[14px] leading-snug text-muted">
          Noch keine Tage bewertet. Unter „Heute“ tippst du ein Gesicht an – nach ein, zwei Wochen zeigt sich hier, was dir guttut.
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[34px] leading-none" aria-hidden>
              {moodEmoji(summary.average)}
            </span>
            <span className="text-[28px] leading-none font-bold tabular-nums">Ø {formatMood(summary.average)}</span>
            <span className="text-[13px] text-muted">
              {summary.count} {summary.count === 1 ? 'Tag' : 'Tage'} bewertet
            </span>
          </div>
          {/* Verteilung: ein Balken je Gesicht, beschriftet mit der Anzahl */}
          <div className="mt-3 grid grid-cols-5 gap-1.5" role="img" aria-label={MOODS.map((m, i) => `${m.label}: ${summary.counts[i]}`).join(', ')}>
            {MOODS.map((m, i) => (
              <div key={m.value} className="flex flex-col items-center gap-1" aria-hidden>
                <div className="flex h-14 w-full items-end justify-center">
                  <div className="w-full max-w-7 rounded-t-[4px] bg-accent" style={{ height: `${summary.counts[i] ? Math.max(8, (summary.counts[i] / max) * 100) : 0}%`, opacity: 0.5 + (i / 4) * 0.5 }} />
                </div>
                <span className="text-[18px] leading-none">{m.emoji}</span>
                <span className="text-[11px] text-muted tabular-nums">{summary.counts[i]}</span>
              </div>
            ))}
          </div>

          <h3 className="mt-4 text-[15px] font-semibold">Was deinen Tagen guttut</h3>
          {links.length === 0 ? (
            <p className="mt-1 text-[13px] leading-snug text-muted">
              {total < 14
                ? 'Bewerte noch ein paar Tage mehr – dann zeigt sich, an welchen Gewohnheiten deine guten Tage hängen.'
                : 'Bisher hängt keine Gewohnheit deutlich mit besseren Tagen zusammen.'}
            </p>
          ) : (
            <>
              <ul className="mt-1.5 flex flex-col gap-2">
                {links.map((l) => (
                  <li key={l.habit.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px]">
                        <span aria-hidden>{l.habit.emoji}</span> {l.habit.name}
                      </span>
                      <span className="block text-[12px] text-muted tabular-nums">
                        erledigt Ø {formatMood(l.withAvg)} · sonst Ø {formatMood(l.withoutAvg)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[13px] font-semibold text-accent tabular-nums">
                      +{formatMood(l.diff)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] leading-snug text-muted">
                Gerechnet über alle {total} bewerteten Tage. Ein Zusammenhang, kein Beweis – aber ein Hinweis, worauf es sich lohnt zu achten.
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}

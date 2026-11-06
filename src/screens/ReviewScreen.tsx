import { useEffect, type ReactNode } from 'react'
import { markReviewSeen, useWeekReview } from '../app/review'
import { goBack, navigate, paths } from '../app/router'
import { useMoodMap, useToday } from '../db/hooks'
import { formatMood, moodEmoji, moodSummary } from '../domain/mood'
import { moveTodosToWeek } from '../db/repo'
import { addDays, formatDayMonth, startOfWeek, WEEKDAYS_MON0, type DateStr } from '../domain/dates'
import { nextReviewWeek, reviewVerdict, weekToReview, type ReviewHabit, type WeekReview } from '../domain/review'
import type { DayState } from '../domain/stats'
import { whenLabel } from '../domain/todos'
import { IconChevronLeft, IconChevronRight } from '../components/icons'
import { WeekBars } from '../components/WeekBars'
import { showToast } from '../lib/toast'
import { openTodoSheet } from '../lib/todoSheet'

const VALID_WEEK = /^\d{4}-\d{2}-\d{2}$/

/** Rückblick auf eine Woche. Ohne Angabe die, die gerade dran ist. */
export function ReviewScreen({ week }: { week?: string }) {
  const today = useToday()
  const current = startOfWeek(today)
  const asked = week && VALID_WEEK.test(week) ? startOfWeek(week) : weekToReview(today)
  const monday = asked > current ? current : asked
  const review = useWeekReview(monday)

  // Wer ihn geöffnet hat, braucht die Karte auf „Heute“ nicht mehr
  useEffect(() => {
    if (monday === weekToReview(today)) markReviewSeen(monday)
  }, [monday, today])

  return (
    <div className="pb-nav">
      <header className="px-safe pt-safe">
        <button
          type="button"
          onClick={() => goBack(paths.erfolge)}
          className="-ml-2 flex h-11 items-center gap-0.5 pr-3 text-[17px] font-medium text-accent"
        >
          <IconChevronLeft width={22} height={22} />
          Zurück
        </button>
        <h1 className="text-[32px] font-bold leading-tight">Wochenrückblick</h1>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold text-muted tabular-nums">
            {formatDayMonth(monday)} – {formatDayMonth(addDays(monday, 6))}
            {monday === current && today < addDays(monday, 6) && ' (läuft noch)'}
          </p>
          <div className="flex gap-1">
            <WeekButton label="Woche davor" onClick={() => navigate(paths.review(addDays(monday, -7)), { replace: true })}>
              <IconChevronLeft width={20} height={20} />
            </WeekButton>
            <WeekButton label="Woche danach" disabled={monday >= current} onClick={() => navigate(paths.review(addDays(monday, 7)), { replace: true })}>
              <IconChevronRight width={20} height={20} />
            </WeekButton>
          </div>
        </div>
      </header>

      {review && <Content review={review} today={today} />}
    </div>
  )
}

function WeekButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-xl bg-surface transition-opacity disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function Content({ review, today }: { review: WeekReview; today: DateStr }) {
  const verdict = reviewVerdict(review)

  return (
    <main className="px-safe mt-4 flex flex-col gap-4">
      <section className="rounded-3xl bg-surface p-4">
        <div className="flex items-baseline gap-3">
          <span className="text-[44px] leading-none font-bold tabular-nums">{review.rate === null ? '–' : `${Math.round(review.rate * 100)} %`}</span>
          <span className="min-w-0 text-[15px] leading-snug font-semibold">{verdict.title}</span>
        </div>
        <p className="mt-1.5 text-[14px] leading-snug text-muted tabular-nums">
          {review.done} von {review.due} fälligen Tagen erledigt
          <WeekMood monday={review.monday} />
          {verdict.detail && (
            <>
              <br />
              {verdict.detail}
            </>
          )}
        </p>
        <div className="mt-4">
          <WeekBars key={review.monday} days={review.days} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Tile
          emoji="🔥"
          value={review.streak ? `${review.streak.days} ${review.streak.days === 1 ? 'Tag' : 'Tage'}` : '–'}
          label={review.streak ? `Längste Serie: ${review.streak.habit.name}` : 'Keine laufende Serie'}
        />
        <Tile emoji="✅" value={String(review.todosDone)} label={review.todosDone === 1 ? 'To-do erledigt' : 'To-dos erledigt'} />
      </div>

      {review.advanced.length > 0 && (
        <section className="rounded-3xl bg-surface p-4">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">🌱 Aufgestiegen</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {review.advanced.map(({ habit, label }) => (
              <li key={habit.id} className="flex items-baseline justify-between gap-3 text-[15px]">
                <span className="truncate">
                  <span aria-hidden>{habit.emoji}</span> {habit.name}
                </span>
                <span className="shrink-0 text-[14px] text-muted">{label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.habits.length > 0 && <HabitList habits={review.habits} />}

      <LeftOver review={review} today={today} />
    </main>
  )
}

/** Stimmung der Woche, falls bewertet */
function WeekMood({ monday }: { monday: DateStr }) {
  const moods = useMoodMap()
  if (!moods) return null
  const s = moodSummary(moods, monday, addDays(monday, 6))
  if (s.average === null) return null
  return (
    <>
      <br />
      Stimmung Ø {formatMood(s.average)} {moodEmoji(s.average)} ({s.count} {s.count === 1 ? 'Tag' : 'Tage'} bewertet)
    </>
  )
}

function Tile({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4">
      <span className="text-[22px] leading-none" aria-hidden>
        {emoji}
      </span>
      <p className="mt-1 text-[22px] leading-tight font-bold tabular-nums">{value}</p>
      <p className="text-[13px] leading-snug break-words text-muted">{label}</p>
    </div>
  )
}

function HabitList({ habits }: { habits: ReviewHabit[] }) {
  return (
    <section className="rounded-3xl bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Gewohnheiten</h2>
        <div className="flex gap-[3px] text-[11px] text-muted" aria-hidden>
          {WEEKDAYS_MON0.map((d) => (
            <span key={d} className="w-4 text-center">
              {d[0]}
            </span>
          ))}
        </div>
      </div>
      <ul className="mt-2 flex flex-col gap-2.5">
        {habits.map((h) => (
          <li key={h.habit.id}>
            <button type="button" onClick={() => navigate(paths.habit(h.habit.id))} className="flex w-full items-center justify-between gap-2 text-left">
              <span className="min-w-0">
                <span className="block truncate text-[15px] leading-tight">
                  <span aria-hidden>{h.habit.emoji}</span> {h.habit.name}
                </span>
                <span className="text-[12px] text-muted tabular-nums">{h.due === 0 ? 'nichts fällig' : `${h.done} von ${h.due}`}</span>
              </span>
              <span className="flex shrink-0 gap-[3px]" role="img" aria-label={h.days.map((d, i) => `${WEEKDAYS_MON0[i]} ${STATE_NAMES[d]}`).join(', ')}>
                {h.days.map((d, i) => (
                  <DayDot key={i} state={d} />
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted" aria-hidden>
        <Legend state="done" text="erledigt" />
        <Legend state="missed" text="verpasst" />
        <Legend state="excused" text="ausgesetzt" />
        <Legend state="rest" text="nicht fällig" />
      </p>
    </section>
  )
}

const STATE_NAMES: Record<DayState, string> = {
  done: 'erledigt',
  missed: 'verpasst',
  open: 'noch offen',
  rest: 'nicht fällig',
  excused: 'ausgesetzt',
  before: 'noch nicht begonnen',
  future: 'kommt noch',
}

function Legend({ state, text }: { state: DayState; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <DayDot state={state} />
      {text}
    </span>
  )
}

/** Jeder Zustand hat seine eigene Form, Farbe allein reicht nicht. */
function DayDot({ state }: { state: DayState }) {
  const base = 'flex size-4 shrink-0 items-center justify-center'
  if (state === 'done') {
    return (
      <span className={base}>
        <span className="flex size-3.5 items-center justify-center rounded-full bg-accent text-[9px] leading-none font-bold text-accent-ink">✓</span>
      </span>
    )
  }
  if (state === 'missed') {
    return (
      <span className={base}>
        <span className="size-3.5 rounded-full border-2 border-warn" />
      </span>
    )
  }
  if (state === 'open') {
    return (
      <span className={base}>
        <span className="size-3.5 rounded-full border-2 border-dashed border-muted" />
      </span>
    )
  }
  if (state === 'excused') {
    return (
      <span className={base}>
        <span className="h-0.5 w-2.5 rounded-full bg-muted" />
      </span>
    )
  }
  return (
    <span className={base}>
      <span className={`size-1 rounded-full ${state === 'rest' ? 'bg-muted' : 'bg-line'}`} />
    </span>
  )
}

function LeftOver({ review, today }: { review: WeekReview; today: DateStr }) {
  if (review.leftOver.length === 0) return null
  const target = nextReviewWeek(review.monday, today)
  const label = target === startOfWeek(today) ? 'Alle in diese Woche legen' : 'Alle in die neue Woche legen'

  return (
    <section className="rounded-3xl bg-surface p-4">
      <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">Noch offen ({review.leftOver.length})</h2>
      <ul className="mt-1">
        {review.leftOver.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => openTodoSheet({ todo: t })} className="flex min-h-11 w-full items-baseline justify-between gap-3 py-1.5 text-left text-[15px]">
              <span className="min-w-0 break-words">{t.title}</span>
              <span className="shrink-0 text-[13px] text-muted">{whenLabel(t, today)}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          const n = review.leftOver.length
          void moveTodosToWeek(review.leftOver, target).then(() =>
            showToast(`${n} ${n === 1 ? 'To-do' : 'To-dos'} ${target === startOfWeek(today) ? 'in diese Woche' : 'in die neue Woche'} gelegt`, '📅'),
          )
        }}
        className="mt-2 h-12 w-full rounded-2xl bg-accent text-[16px] font-semibold text-accent-ink"
      >
        {label}
      </button>
    </section>
  )
}

import { seenReviewWeek, useWeekReview } from '../app/review'
import { navigate, paths } from '../app/router'
import { addDays, formatDayMonth, type DateStr } from '../domain/dates'
import { reviewCardWeek } from '../domain/review'
import { IconChevronRight } from './icons'

/** Auf „Heute“: Am Sonntag und Montag wartet der Rückblick, bis er einmal geöffnet wurde. */
export function ReviewCard({ today }: { today: DateStr }) {
  const week = reviewCardWeek(today, seenReviewWeek())
  return week ? <Card week={week} /> : null
}

function Card({ week }: { week: DateStr }) {
  const review = useWeekReview(week)
  if (!review || (review.due === 0 && review.todosDone === 0 && review.leftOver.length === 0)) return null

  return (
    <button
      type="button"
      onClick={() => navigate(paths.review(week))}
      className="mb-3 flex w-full items-center gap-3 rounded-3xl bg-surface px-4 py-3 text-left"
    >
      <span className="text-[26px] leading-none" aria-hidden>
        📊
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] leading-tight font-semibold">Dein Wochenrückblick</span>
        <span className="block text-[13px] text-muted tabular-nums">
          {formatDayMonth(week)} – {formatDayMonth(addDays(week, 6))}
          {review.rate !== null && ` · ${Math.round(review.rate * 100)} %`}
        </span>
      </span>
      <IconChevronRight width={20} height={20} className="shrink-0 text-muted" />
    </button>
  )
}

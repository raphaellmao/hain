import { doneFor, useDoneMap, useHabit, useToday } from '../db/hooks'
import { colorHex } from '../domain/colors'
import { type DateStr } from '../domain/dates'
import { H_MAX, MAX_STAGE, nextStage } from '../domain/health'
import { SPECIES_INFO, speciesOf, stageName } from '../domain/species'
import { groveSize } from '../tree/grove'
import { describeDays, daysAt, isDue } from '../domain/schedule'
import { successRate, totalDone } from '../domain/stats'
import { stageLabel, summarize } from '../domain/summary'
import type { DoneSet, Habit } from '../domain/types'
import { toggleDay } from '../app/actions'
import { goBack, navigate, paths } from '../app/router'
import { HabitVisual } from '../components/HabitVisual'
import { ShadowCard } from '../components/ShadowCard'
import { CheckCircle } from '../components/CheckCircle'
import { IconChevronLeft } from '../components/icons'
import { Heatmap } from '../components/Heatmap'
import { MonthCalendar } from '../components/MonthCalendar'

export function HabitDetailScreen({ id }: { id: string }) {
  const habit = useHabit(id)
  const doneMap = useDoneMap()
  const today = useToday()

  if (habit === undefined || !doneMap) return null
  if (habit === null) {
    return (
      <div className="px-safe pt-safe pb-nav">
        <TopBar />
        <p className="py-10 text-center text-muted">Diese Gewohnheit gibt es nicht mehr.</p>
      </div>
    )
  }
  return <Detail habit={habit} done={doneFor(doneMap, id)} today={today} />
}

function TopBar({ onEdit }: { onEdit?: () => void }) {
  return (
    <div className="flex h-12 items-center justify-between">
      <button
        type="button"
        onClick={() => goBack(paths.garden)}
        className="-ml-2 flex h-11 items-center gap-0.5 pr-3 text-[17px] font-medium text-accent"
      >
        <IconChevronLeft width={22} height={22} />
        Zurück
      </button>
      {onEdit && (
        <button type="button" onClick={onEdit} className="h-11 pl-3 text-[17px] font-medium text-accent">
          Bearbeiten
        </button>
      )}
    </div>
  )
}

const fmt1 = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 1 })
const days = (n: number) => `${n} ${n === 1 ? 'Tag' : 'Tage'}`

function Detail({ habit, done, today }: { habit: Habit; done: DoneSet; today: DateStr }) {
  const s = summarize(habit, done, today)
  const color = colorHex(habit.color)
  const { h, wilted, missRun } = s.health
  const next = nextStage(h)
  const rate = successRate(habit, done, today)
  const dueToday = isDue(habit, today)
  const doneToday = done.has(today)

  // Fortschritt innerhalb der aktuellen Stufe (0 … 1)
  const stageProgress = s.g >= MAX_STAGE ? 1 : s.g - Math.floor(s.g)
  const species = speciesOf(habit)
  const plants = groveSize(s.g)

  const progressText = next
    ? `Noch ${days(next.daysNeeded)} erledigt bis „${stageName(species, next.stage)}“`
    : 'Voll ausgewachsen – dein Hain ist komplett'

  return (
    <div className="pb-nav">
      <div className="px-safe pt-safe">
        <TopBar onEdit={() => navigate(paths.edit(habit.id))} />

        <h1 className="mt-1 flex items-center gap-2 text-[28px] font-bold leading-tight">
          <span aria-hidden>{habit.emoji}</span>
          <span className="min-w-0 break-words">{habit.name}</span>
        </h1>
        <p className="text-[15px] text-muted">{describeDays(daysAt(habit.schedule, today))}</p>

        {/* Pflanze bzw. Schatten-Ich */}
        <div className="mx-auto mt-2 aspect-square w-full max-w-[340px]">
          <HabitVisual habit={habit} summary={s} animated density="rich" className="size-full" />
        </div>

        {habit.metaphor === 'schatten' ? (
          <ShadowCard summary={s} color={color} />
        ) : (
        <section className="rounded-3xl bg-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">
              {stageLabel(s, species)}
              {wilted && <span className="text-warn"> · welk</span>}
            </h2>
            <span className="text-[13px] text-muted tabular-nums">
              Stufe {s.stage}/{MAX_STAGE}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${stageProgress * 100}%`, background: wilted ? 'var(--warn)' : color }}
            />
          </div>
          <p className="mt-2 text-[15px]">{progressText}</p>
          <p className="mt-0.5 text-[13px] text-muted tabular-nums">
            {SPECIES_INFO[species].label} · Gesundheit {fmt1(h)} von {H_MAX}
            {plants > 1 && ` · ${plants} Pflanzen im Hain`}
          </p>

          {wilted && (
            <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-[14px] leading-snug">
              {missRun === 1
                ? 'Ein fälliger Tag wurde verpasst – der Baum lässt die Blätter hängen. Heute erledigt, erholt er sich sofort.'
                : `${missRun} fällige Tage in Folge verpasst – mit jedem Tag verliert er etwa eine Stufe. Heute erledigt, wächst er von hier aus weiter.`}
            </p>
          )}
        </section>
        )}

        {/* Heute abhaken – auch aus der Detailansicht */}
        {(dueToday || doneToday) && (
          <button
            type="button"
            onClick={() => toggleDay(habit, done, today, today)}
            aria-pressed={doneToday}
            className="mt-3 flex h-14 w-full items-center justify-between rounded-3xl bg-surface px-4 text-[17px] font-semibold"
          >
            {doneToday ? 'Heute erledigt' : 'Heute abhaken'}
            <CheckCircle done={doneToday} color={color} />
          </button>
        )}

        {/* Kennzahlen */}
        <section className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Aktuelle Serie" value={days(s.streaks.current)} />
          <Stat label="Längste Serie" value={days(s.streaks.longest)} />
          <Stat
            label="Quote 30 Tage"
            value={rate ? `${Math.round(rate.rate * 100)} %` : '–'}
            hint={rate ? `${rate.done} von ${rate.due} fälligen` : undefined}
          />
          <Stat label="Erledigt gesamt" value={days(totalDone(habit, done, today))} />
        </section>

        {/* Verlauf */}
        <section className="mt-3 rounded-3xl bg-surface p-4">
          <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Verlauf · 22 Wochen</h2>
          <Heatmap habit={habit} done={done} today={today} color={color} />
        </section>

        {/* Nachtragen & korrigieren */}
        <section className="mt-3 rounded-3xl bg-surface px-2 pt-2 pb-4">
          <h2 className="px-2 pt-2 text-[13px] font-semibold tracking-wide text-muted uppercase">Nachtragen & korrigieren</h2>
          <MonthCalendar habit={habit} done={done} today={today} color={color} />
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-0.5 text-[22px] font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  )
}

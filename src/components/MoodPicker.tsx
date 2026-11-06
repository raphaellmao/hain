import { useDayMood } from '../db/hooks'
import { setDayMood } from '../db/repo'
import type { DateStr } from '../domain/dates'
import { MOODS } from '../domain/mood'
import { tick } from '../lib/haptics'

/** Stimmung des Tages: ein Tipp genügt, nochmal tippen nimmt sie zurück. */
export function MoodPicker({ date, isToday }: { date: DateStr; isToday: boolean }) {
  const mood = useDayMood(date)
  if (mood === undefined) return null

  return (
    <section className="mt-6">
      <h2 className="pb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">{isToday ? 'Wie geht es dir heute?' : 'Wie ging es dir?'}</h2>
      <div className="grid grid-cols-5 gap-1.5 rounded-3xl bg-surface p-1.5" role="radiogroup" aria-label="Stimmung">
        {MOODS.map((m) => {
          const active = mood === m.value
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={m.label}
              onClick={() => {
                tick()
                void setDayMood(date, active ? null : m.value)
              }}
              className={`flex h-14 items-center justify-center rounded-2xl text-[28px] leading-none transition-all ${
                active ? 'scale-105 bg-surface-2 ring-2 ring-accent' : mood ? 'opacity-45 grayscale-[0.4]' : ''
              }`}
            >
              {m.emoji}
            </button>
          )
        })}
      </div>
    </section>
  )
}

import { SHADOW_LEVELS, TERRITORY_STATUS, daysToNextStatus } from '../domain/shadow'
import type { HabitSummary } from '../domain/summary'

const days = (n: number) => `${n} ${n === 1 ? 'Tag' : 'Tage'}`

/** Detailansicht beim Schatten-Ich: Lage im Kampf um das Territorium. */
export function ShadowCard({ summary, color }: { summary: HabitSummary; color: string }) {
  const sh = summary.shadow
  const yours = Math.round(sh.territory * 100)
  const next = daysToNextStatus(summary.health.h, sh.s)
  const losing = sh.status <= 1
  const { missRun } = summary.health

  return (
    <section className="rounded-3xl bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={`text-xl font-bold ${losing ? 'text-warn' : ''}`}>{TERRITORY_STATUS[sh.status].label}</h2>
        <span className="text-[13px] text-muted tabular-nums">Territorium</span>
      </div>

      {/* geteilter Balken: links dein Land, rechts seins */}
      <div className="mt-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label={`Dir gehören ${yours} %`}>
        <div className="h-full transition-[width] duration-700" style={{ width: `${yours}%`, background: color }} />
        <div className="h-full flex-1" style={{ background: 'linear-gradient(90deg, #3b1259, #120818)' }} />
      </div>
      <div className="mt-1 flex justify-between text-[13px] tabular-nums">
        <span>Du · {yours} %</span>
        <span className="text-muted">Schatten · {100 - yours} %</span>
      </div>

      <p className="mt-3 text-[15px]">
        {next ? `Noch ${days(next.days)} dranbleiben bis „${next.label}“` : 'Das Land gehört dir – halte es.'}
      </p>
      <p className="mt-0.5 text-[13px] text-muted tabular-nums">
        Dein Schatten: {SHADOW_LEVELS[sh.level].label} · Stärke {Math.round(sh.s)} von 100 · dein Licht {Math.round(sh.light)}
      </p>

      <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-[14px] leading-snug">
        {missRun > 0
          ? `${missRun === 1 ? 'Ein fälliger Tag' : `${missRun} fällige Tage in Folge`} verpasst – an jedem davon ist er stärker geworden. Heute erledigt, weicht er zurück.`
          : 'Er wird an jedem Tag stärker, an dem du schwach bist. Jeder erledigte Tag schwächt ihn und holt dir Land zurück.'}
      </p>
    </section>
  )
}

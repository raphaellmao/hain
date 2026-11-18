import { useMemo } from 'react'
import { goBack, navigate, paths } from '../app/router'
import { doneFor, excusedSet, excusesFor, useAllHabits, useDoneMap, useExcuseMap, useToday } from '../db/hooks'
import { herbariumOf } from '../domain/herbarium'
import { MUTATION_KEYS, MUTATIONS, seedWith } from '../domain/mutation'
import { SPECIES_INFO, SPECIES_KEYS, isFutureSpecies, type SpeciesKey } from '../domain/species'
import { summarize } from '../domain/summary'
import type { Habit } from '../domain/types'
import { IconChevronLeft } from '../components/icons'
import { Tree } from '../tree/Tree'

/** Feste Seeds für die Musterpflanzen, damit jede Karte immer gleich aussieht */
const SAMPLE_SEED = 1097
/** Unentdeckt: dunkler Umriss */
const SILHOUETTE = { filter: 'grayscale(1) brightness(0.35)', opacity: 0.45 }

/** Sammelalbum aller Arten und Mutationen */
export function HerbariumScreen() {
  const habits = useAllHabits()
  const doneMap = useDoneMap()
  const excuseMap = useExcuseMap()
  const today = useToday()

  const herb = useMemo(() => {
    if (!habits || !doneMap) return null
    return herbariumOf(
      habits.map((habit) => ({ habit, summary: summarize(habit, doneFor(doneMap, habit.id), today, excusedSet(excusesFor(excuseMap, habit.id))) })),
    )
  }, [habits, doneMap, excuseMap, today])

  if (!herb) return null
  const total = SPECIES_KEYS.length

  return (
    <div className="pb-nav">
      <header className="px-safe pt-safe">
        <button type="button" onClick={() => goBack(paths.erfolge)} className="-ml-2 flex h-11 items-center gap-0.5 pr-3 text-[17px] font-medium text-accent">
          <IconChevronLeft width={22} height={22} />
          Zurück
        </button>
        <h1 className="text-[32px] font-bold leading-tight">Herbarium</h1>
        <p className="mt-1 text-[15px] text-muted">
          {herb.bloomed.size} von {total} Arten zur Blüte gebracht · {herb.mutations.size} von {MUTATION_KEYS.length} Mutationen entdeckt
        </p>
      </header>

      <main className="px-safe mt-4 flex flex-col gap-6">
        {([false, true] as const).map((future) => (
          <Section key={String(future)} title={future ? 'Futuristisch · erfunden' : 'Natürlich'}>
            {SPECIES_KEYS.filter((k) => isFutureSpecies(k) === future).map((k) => (
              <SpeciesCard key={k} species={k} habit={herb.bloomed.get(k)} />
            ))}
          </Section>
        ))}

        <Section title="Seltene Mutationen" hint="Etwa jede 16. Pflanze trägt eine – welche, steht in ihrem Samen. Entdeckt, sobald sie ein Busch ist.">
          {MUTATION_KEYS.map((m) => {
            const habit = herb.mutations.get(m)
            return (
              <Card
                key={m}
                found={!!habit}
                title={habit ? `${MUTATIONS[m].emoji} ${MUTATIONS[m].label}` : '???'}
                caption={habit ? `bei „${habit.name}“` : 'noch nicht entdeckt'}
                onClick={habit ? () => navigate(paths.habit(habit.id)) : undefined}
              >
                <Tree seed={seedWith(m, 1000)} color="koralle" species="laubbaum" g={6.7} ground={false} className="size-full" />
              </Card>
            )
          })}
        </Section>
      </main>
    </div>
  )
}

function SpeciesCard({ species, habit }: { species: SpeciesKey; habit?: Habit }) {
  return (
    <Card
      found={!!habit}
      title={SPECIES_INFO[species].label}
      caption={habit ? `durch „${habit.name}“` : 'noch nicht erblüht'}
      onClick={habit ? () => navigate(paths.habit(habit.id)) : undefined}
    >
      <Tree seed={habit?.seed ?? SAMPLE_SEED} color={habit?.color ?? 'koralle'} species={species} g={6.7} ground={false} className="size-full" />
    </Card>
  )
}

function Card({ found, title, caption, onClick, children }: { found: boolean; title: string; caption: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="flex w-full flex-col items-center rounded-3xl bg-surface px-1.5 pt-1.5 pb-2 text-center"
        aria-label={`${title}: ${caption}`}
        data-found={found}
      >
        <span className="block aspect-square w-full" style={found ? undefined : SILHOUETTE}>
          {children}
        </span>
        <span className={`mt-1 block w-full truncate text-[13px] font-semibold ${found ? '' : 'text-muted'}`}>{title}</span>
        <span className="block w-full truncate text-[11px] text-muted">{caption}</span>
      </button>
    </li>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {hint && <p className="mb-2 px-1 text-[13px] leading-snug text-muted">{hint}</p>}
      <ul className="grid grid-cols-3 gap-2">{children}</ul>
    </section>
  )
}

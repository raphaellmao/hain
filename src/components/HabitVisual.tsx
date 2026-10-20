/**
 * Das Bild eines Habits: wachsende Pflanze oder Schatten-Ich – je nachdem,
 * was im Formular gewählt wurde. Animierte Ansichten (Heute, Detail) merken
 * sich den zuletzt gesehenen Stand, damit Veränderungen beim Öffnen sichtbar
 * werden (fallende Blätter, vorrückender Schatten).
 */
import type { HabitSummary } from '../domain/summary'
import type { Habit } from '../domain/types'
import { useLastSeen } from '../lib/lastSeen'
import { ShadowDuel } from '../shadow/ShadowDuel'
import { Tree } from '../tree/Tree'

interface Props {
  habit: Habit
  summary: HabitSummary
  animated?: boolean
  /** Detailfülle des Schatten-Ichs */
  density?: 'small' | 'normal' | 'rich'
  className?: string
}

export function HabitVisual(props: Props) {
  if (props.habit.metaphor === 'schatten') return props.animated ? <AnimatedShadow {...props} /> : <StaticShadow {...props} />
  return props.animated ? <AnimatedPlant {...props} /> : <StaticPlant {...props} />
}

function plantProps({ habit, summary, className }: Props) {
  return {
    seed: habit.seed,
    color: habit.color,
    species: habit.species,
    g: summary.g,
    wilted: summary.health.wilted,
    dormant: summary.health.dormant,
    className,
  }
}

const StaticPlant = (p: Props) => <Tree {...plantProps(p)} />

function AnimatedPlant(p: Props) {
  const fromG = useLastSeen(p.habit.id, p.summary.g)
  return <Tree {...plantProps(p)} animated fromG={fromG} />
}

function shadowProps({ habit, summary, density, className }: Props) {
  return {
    color: habit.color,
    territory: summary.shadow.territory,
    s: summary.shadow.s,
    light: summary.shadow.light,
    density,
    className,
  }
}

const StaticShadow = (p: Props) => <ShadowDuel {...shadowProps(p)} />

function AnimatedShadow(p: Props) {
  const fromTerritory = useLastSeen(`${p.habit.id}:schatten`, p.summary.shadow.territory)
  return <ShadowDuel {...shadowProps(p)} animated fromTerritory={fromTerritory} />
}

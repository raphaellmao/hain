/**
 * Routinen = Gewohnheiten stapeln („Nach dem Aufstehen: Wasser → Dehnen →
 * Liegestütze“) und der Plan je Gewohnheit („Nach dem Dienst“, „Um 6:30 Uhr im
 * Flur“). Beides macht den Auslöser konkret; die Gewohnheiten selbst bleiben
 * ganz normal – eine Routine ordnet sie nur und zeigt, was als Nächstes dran ist.
 */
import type { DateStr } from './dates'
import type { DoneSet, Habit, Routine } from './types'

export const PLAN_MAX = 80
export const ROUTINE_NAME_MAX = 30

/** Schnellauswahl für Plan und Anker – passend für Dienst und Alltag */
export const PLAN_SUGGESTIONS = ['Nach dem Aufstehen', 'Nach dem Dienst', 'Nach dem Mittagessen', 'Vor dem Schlafengehen']

export const ROUTINE_EMOJIS = ['🌅', '☀️', '🌙', '💪', '🧘', '📚', '🏠', '⚡']

/** Leerzeichen bereinigen, kürzen; leer = kein Plan */
export function cleanPlan(text: string | undefined): string | undefined {
  const t = (text ?? '').trim().replace(/\s+/g, ' ').slice(0, PLAN_MAX)
  return t || undefined
}

export type TodayEntry<T> = { kind: 'habit'; item: T } | { kind: 'routine'; routine: Routine; items: T[] }

/**
 * Die fälligen Gewohnheiten eines Tages, Routinen zusammengefasst. Eine Routine
 * steht dort, wo ihre erste fällige Gewohnheit in der eigenen Reihenfolge stünde;
 * darin gilt die Reihenfolge der Routine.
 */
export function groupByRoutine<T extends { habit: Habit }>(due: T[], routines: Routine[]): TodayEntry<T>[] {
  const routineOf = new Map<string, Routine>()
  for (const r of routines) for (const id of r.habitIds) if (!routineOf.has(id)) routineOf.set(id, r)
  const byId = new Map(due.map((i) => [i.habit.id, i]))
  const emitted = new Set<string>()
  const out: TodayEntry<T>[] = []
  for (const item of due) {
    const r = routineOf.get(item.habit.id)
    if (!r) {
      out.push({ kind: 'habit', item })
      continue
    }
    if (emitted.has(r.id)) continue
    emitted.add(r.id)
    const items = r.habitIds.map((id) => byId.get(id)).filter((i): i is T => !!i && routineOf.get(i.habit.id) === r)
    out.push({ kind: 'routine', routine: r, items })
  }
  return out
}

export type StepState = 'done' | 'off' | 'open'

export interface RoutineProgress {
  states: StepState[]
  /** Index der nächsten offenen Gewohnheit, -1 wenn keine */
  next: number
  done: number
  /** zählt: alles außer ausgesetzt */
  total: number
  complete: boolean
}

export function routineProgress(items: { habit: Habit; done: DoneSet; excused: DoneSet }[], date: DateStr): RoutineProgress {
  const states = items.map<StepState>((i) => (i.done.has(date) ? 'done' : i.excused.has(date) ? 'off' : 'open'))
  const done = states.filter((s) => s === 'done').length
  const total = states.filter((s) => s !== 'off').length
  return { states, next: states.indexOf('open'), done, total, complete: total > 0 && done === total }
}

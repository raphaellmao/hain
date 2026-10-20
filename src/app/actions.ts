/**
 * Aktionen, die mehr tun als nur speichern (Feedback, Hinweise).
 */
import type { DateStr } from '../domain/dates'
import { computeHealth, stageOf } from '../domain/health'
import { stageName } from '../domain/species'
import { TERRITORY_STATUS, computeShadowPower, shadowState } from '../domain/shadow'
import type { DoneSet, Habit } from '../domain/types'
import { setCheckin } from '../db/repo'
import { celebrate, tick } from '../lib/haptics'
import { showToast } from '../lib/toast'

/**
 * Tag abhaken bzw. Haken entfernen. Steigt der Baum dadurch eine Stufe auf,
 * gibt es ein kräftigeres Feedback und einen Hinweis.
 * Die Vibration muss *vor* dem ersten await kommen – iOS erlaubt das
 * Haptik-Signal nur direkt in der Tap-Verarbeitung.
 */
export async function toggleDay(habit: Habit, done: DoneSet, date: DateStr, today: DateStr): Promise<void> {
  const wasDone = done.has(date)
  const next = new Set(done)
  if (wasDone) next.delete(date)
  else next.add(date)

  // Fortschritt messen: Pflanze → Stufe, Schatten-Ich → Lage im Kampf ums Territorium
  const level = (d: DoneSet) => {
    const h = computeHealth(habit, d, today).h
    return habit.metaphor === 'schatten' ? shadowState(h, computeShadowPower(habit, d, today)).status : stageOf(h)
  }
  const before = level(done)
  const after = level(next)

  if (!wasDone) {
    if (after > before) celebrate()
    else tick()
  }

  await setCheckin(habit.id, date, !wasDone)

  if (after > before) {
    showToast(
      habit.metaphor === 'schatten'
        ? `${habit.name}: ${TERRITORY_STATUS[after].label}`
        : `${habit.name}: jetzt ${stageName(habit.species, after)}`,
      habit.emoji,
    )
  }
}

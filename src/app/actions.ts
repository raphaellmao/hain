/**
 * Aktionen, die mehr tun als nur speichern (Feedback, Hinweise).
 */
import type { DateStr } from '../domain/dates'
import { computeHealth, stageOf, STAGE_NAMES } from '../domain/health'
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

  const before = stageOf(computeHealth(habit, done, today).h)
  const after = stageOf(computeHealth(habit, next, today).h)

  if (!wasDone) {
    if (after > before) celebrate()
    else tick()
  }

  await setCheckin(habit.id, date, !wasDone)

  if (after > before) {
    showToast(`${habit.name}: jetzt ${STAGE_NAMES[after]}`, habit.emoji)
  }
}

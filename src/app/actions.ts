/**
 * Aktionen, die mehr tun als nur speichern (Feedback, Hinweise).
 */
import { formatDayMonth, type DateStr } from '../domain/dates'
import { computeHealth, stageOf } from '../domain/health'
import { stageName } from '../domain/species'
import { TERRITORY_STATUS, computeShadowPower, shadowState } from '../domain/shadow'
import { type ExcuseReason, reasonInfo } from '../domain/excuse'
import { type DoneSet, type Habit, NO_DAYS } from '../domain/types'
import { setCheckin, setExcused } from '../db/repo'
import { celebrate, tick } from '../lib/haptics'
import { showToast } from '../lib/toast'

/**
 * Tag abhaken bzw. Haken entfernen. Steigt der Baum dadurch eine Stufe auf,
 * gibt es ein kräftigeres Feedback und einen Hinweis. Abhaken an einem
 * ausgesetzten Tag hebt die Ausnahme auf („erledigt“ schlägt „ausgesetzt“).
 * Die Vibration muss *vor* dem ersten await kommen – iOS erlaubt das
 * Haptik-Signal nur direkt in der Tap-Verarbeitung.
 */
export async function toggleDay(
  habit: Habit,
  done: DoneSet,
  date: DateStr,
  today: DateStr,
  excused: DoneSet = NO_DAYS,
): Promise<void> {
  const wasDone = done.has(date)
  const next = new Set(done)
  if (wasDone) next.delete(date)
  else next.add(date)
  const nextExcused = new Set(excused)
  nextExcused.delete(date)

  // Fortschritt messen: Pflanze → Stufe, Schatten-Ich → Lage im Kampf ums Territorium
  const level = (d: DoneSet, ex: DoneSet) => {
    const h = computeHealth(habit, d, today, ex).h
    return habit.metaphor === 'schatten' ? shadowState(h, computeShadowPower(habit, d, today, ex)).status : stageOf(h)
  }
  const before = level(done, excused)
  const after = level(next, nextExcused)

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

/** „Heute nicht möglich“: Tag mit Grund aussetzen. */
export async function excuseDay(habit: Habit, date: DateStr, today: DateStr, reason: ExcuseReason, note?: string) {
  tick()
  await setExcused(habit.id, date, reason, note)
  const r = reasonInfo(reason)
  showToast(`${habit.name}: ${date === today ? 'heute' : formatDayMonth(date)} ausgesetzt – ${r.label}`, r.emoji)
}

/** Ausnahme wieder aufheben – der Tag ist dann wieder offen bzw. verpasst. */
export async function clearExcuse(habit: Habit, date: DateStr) {
  await setCheckin(habit.id, date, false)
}

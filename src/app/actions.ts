/**
 * Aktionen, die mehr tun als nur speichern (Feedback, Hinweise).
 */
import { formatDayMonth, logicalToday, type DateStr } from '../domain/dates'
import { effectiveAmount, formatAmount, reached, roundAmount, timerMinutes } from '../domain/goal'
import { computeHealth, stageOf } from '../domain/health'
import { stageName } from '../domain/species'
import { TERRITORY_STATUS, computeShadowPower, shadowState } from '../domain/shadow'
import { type ExcuseReason, reasonInfo } from '../domain/excuse'
import { whenLabel } from '../domain/todos'
import { type DoneSet, type Habit, NO_DAYS } from '../domain/types'
import { db } from '../db/schema'
import { clearExcused, setAmount, setCheckin, setExcused, setTodoDone, startTimer, stopTimer } from '../db/repo'
import { celebrate, tick } from '../lib/haptics'
import { showToast } from '../lib/toast'

/** Fortschritt messen: Pflanze → Stufe, Schatten-Ich → Lage im Kampf ums Territorium */
function levelOf(habit: Habit, done: DoneSet, today: DateStr, excused: DoneSet): number {
  const h = computeHealth(habit, done, today, excused).h
  return habit.metaphor === 'schatten' ? shadowState(h, computeShadowPower(habit, done, today, excused)).status : stageOf(h)
}

function announceLevel(habit: Habit, level: number) {
  showToast(
    habit.metaphor === 'schatten' ? `${habit.name}: ${TERRITORY_STATUS[level].label}` : `${habit.name}: jetzt ${stageName(habit.species, level)}`,
    habit.emoji,
  )
}

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
  // Mit Ziel: abhaken heißt Ziel ganz erreicht, zurücknehmen heißt null
  if (habit.goal) {
    const full = habit.goal.target
    return changeAmount(habit, date, today, wasDone ? full : 0, wasDone ? 0 : full)
  }
  const next = new Set(done)
  if (wasDone) next.delete(date)
  else next.add(date)
  const nextExcused = new Set(excused)
  nextExcused.delete(date)

  const before = levelOf(habit, done, today, excused)
  const after = levelOf(habit, next, today, nextExcused)

  if (!wasDone) {
    if (after > before) celebrate()
    else tick()
  }

  await setCheckin(habit.id, date, !wasDone)

  if (after > before) announceLevel(habit, after)
}

/** Erledigte und ausgesetzte Tage eines Habits, frisch aus der Datenbank */
async function daySets(habitId: string): Promise<{ done: Set<DateStr>; excused: Set<DateStr> }> {
  const done = new Set<DateStr>()
  const excused = new Set<DateStr>()
  for (const c of await db.checkins.where('habitId').equals(habitId).toArray()) {
    if (c.done) done.add(c.date)
    else if (c.excused) excused.add(c.date)
  }
  return { done, excused }
}

/**
 * Menge bzw. Minuten eines Tages ändern, mit derselben Rückmeldung wie beim
 * Abhaken. `current` kennt der Aufrufer schon: Die Vibration muss vor dem ersten
 * await kommen, und ob das Ziel jetzt erreicht wird, entscheidet über ihre Stärke.
 */
export async function changeAmount(habit: Habit, date: DateStr, today: DateStr, current: number, next: number): Promise<void> {
  const goal = habit.goal
  if (!goal) return
  const value = roundAmount(Math.max(0, next))
  const was = reached(current, goal)
  const now = reached(value, goal)
  if (!was && now) celebrate()
  else tick()

  const { done, excused } = await daySets(habit.id)
  await setAmount(habit.id, date, value, goal)
  if (was === now || !now) return

  const after = new Set(done).add(date)
  const exAfter = new Set(excused)
  exAfter.delete(date)
  const before = levelOf(habit, done, today, excused)
  const level = levelOf(habit, after, today, exAfter)
  if (level > before) announceLevel(habit, level)
  else showToast(`${habit.name}: Ziel erreicht`, '🎯')
}

/** Timer starten oder stoppen; die Minuten zählen für den Tag, an dem er gestartet wurde. */
export async function toggleTimer(habit: Habit, running: number | undefined, today: DateStr, dayStartHour: number): Promise<void> {
  if (!habit.goal) return
  tick()
  if (running === undefined) {
    await startTimer(habit.id)
    return
  }
  const started = await stopTimer(habit.id)
  if (started === null) return
  const { minutes, capped } = timerMinutes(started, Date.now())
  if (minutes === 0) {
    showToast('Unter einer Minute – nichts eingetragen', '⏱️')
    return
  }
  const day = logicalToday(new Date(started), dayStartHour)
  const c = await db.checkins.get(`${habit.id}_${day}`)
  const current = effectiveAmount(c?.amount, !!c?.done, habit.goal)
  await changeAmount(habit, day, today, current, current + minutes)
  if (capped) showToast('Der Timer lief über 12 Stunden – als 12 h gezählt, bitte prüfen', '⏱️', 5000)
  else if (!reached(current + minutes, habit.goal)) showToast(`${habit.name}: +${formatAmount(minutes, habit.goal)}`, '⏱️')
}

/** To-do abhaken. Kommt es wieder, sagt ein Hinweis, wann. */
export async function finishTodo(id: string, today: DateStr) {
  const next = await setTodoDone(id, true, today)
  if (next) showToast(`Kommt wieder: ${whenLabel(next, today)}`, '🔁', 3200)
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
  await clearExcused(habit.id, date)
}

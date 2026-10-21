/**
 * Blatt „Heute nicht möglich?“ – kann von überall geöffnet werden
 * (Zeile in „Heute“, Detailansicht, Kalender). Angezeigt von ExcuseHost.
 */
import { useSyncExternalStore } from 'react'
import type { DateStr } from '../domain/dates'
import type { Habit } from '../domain/types'
import type { ExcuseInfo } from '../db/hooks'

export interface ExcuseRequest {
  habit: Habit
  date: DateStr
  today: DateStr
  /** bestehende Ausnahme an diesem Tag */
  current?: ExcuseInfo
  done: boolean
  /** Ausnahmen in den letzten 30 Tagen (zur Selbstkontrolle) */
  recent: number
  /** Link zur Detailansicht anbieten (aus der Heute-Liste) */
  showDetails?: boolean
}

let pending: ExcuseRequest | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function openExcuseSheet(req: ExcuseRequest) {
  pending = req
  emit()
}

export function closeExcuseSheet() {
  pending = null
  emit()
}

export function useExcuseRequest(): ExcuseRequest | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => pending,
  )
}

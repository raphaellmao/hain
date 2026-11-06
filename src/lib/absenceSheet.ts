/**
 * Blatt „Abwesenheit planen“ – aus den Einstellungen, von „Heute“ und aus dem
 * Ausnahme-Blatt erreichbar. Angezeigt von AbsenceHost.
 */
import { useSyncExternalStore } from 'react'
import type { DateStr } from '../domain/dates'
import type { Absence } from '../domain/types'
import { sheetHistorySettled } from './sheetEffects'

export interface AbsenceRequest {
  /** vorhandene bearbeiten; fehlt sie, wird eine neue geplant */
  absence?: Absence
  /** Vorschlag für den ersten Tag einer neuen */
  from?: DateStr
}

let pending: AbsenceRequest | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function openAbsenceSheet(req: AbsenceRequest = {}) {
  pending = req
  emit()
}

/**
 * Aus einem anderen Blatt heraus öffnen: erst, wenn das andere seinen
 * Verlaufseintrag entfernt hat – sonst schlösse dessen Zurückblättern das neue gleich wieder.
 */
export function openAbsenceSheetAfterClose(req: AbsenceRequest = {}) {
  void sheetHistorySettled().then(() => openAbsenceSheet(req))
}

export function closeAbsenceSheet() {
  pending = null
  emit()
}

export function useAbsenceRequest(): AbsenceRequest | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => pending,
  )
}

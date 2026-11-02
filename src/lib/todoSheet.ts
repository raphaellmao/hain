/**
 * Blatt zum Anlegen und Bearbeiten eines To-dos – kann von überall geöffnet
 * werden (To-do-Seite, „Heute“). Angezeigt von TodoSheetHost.
 */
import { useSyncExternalStore } from 'react'
import type { Todo, TodoScope } from '../domain/types'

export interface TodoSheetRequest {
  /** vorhandenes To-do bearbeiten; fehlt es, wird ein neues angelegt */
  todo?: Todo
  /** Voreinstellung für ein neues To-do */
  scope?: TodoScope
}

let pending: TodoSheetRequest | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function openTodoSheet(req: TodoSheetRequest = {}) {
  pending = req
  emit()
}

export function closeTodoSheet() {
  pending = null
  emit()
}

export function useTodoSheetRequest(): TodoSheetRequest | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => pending,
  )
}

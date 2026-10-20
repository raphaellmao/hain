import { useEffect, useRef, useState } from 'react'
import { useDayNote } from '../db/hooks'
import { NOTE_MAX_LENGTH, setDayNote } from '../db/repo'
import type { DateStr } from '../domain/dates'

/**
 * Notiz zum ausgewählten Tag. Gespeichert wird automatisch – kurz nach dem
 * Tippen, beim Verlassen des Felds und wenn die App in den Hintergrund geht.
 */
export function DayNote({ date, isToday }: { date: DateStr; isToday: boolean }) {
  const saved = useDayNote(date)
  if (saved === undefined) return null
  // key: Beim Tageswechsel startet der Editor neu mit dem gespeicherten Text
  return <NoteEditor key={date} date={date} initial={saved} isToday={isToday} />
}

const SAVE_DELAY_MS = 600

function NoteEditor({ date, initial, isToday }: { date: DateStr; initial: string; isToday: boolean }) {
  // Eigener Zustand statt Live-Wert: sonst würde das Speichern beim Tippen
  // den Text unter dem Cursor zurücksetzen.
  const [text, setText] = useState(initial)
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const flush = useRef(() => {
    window.clearTimeout(timer.current)
    if (pending.current === null) return
    void setDayNote(date, pending.current)
    pending.current = null
  }).current

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush() // anderer Tag gewählt oder Bildschirm verlassen
    }
  }, [flush])

  function onChange(value: string) {
    setText(value)
    pending.current = value
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS)
  }

  return (
    <section className="mt-6">
      <label htmlFor="day-note" className="block pb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
        {isToday ? 'Notiz für heute' : 'Notiz zu diesem Tag'}
      </label>
      <textarea
        id="day-note"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        maxLength={NOTE_MAX_LENGTH}
        rows={3}
        placeholder={isToday ? 'Wie war dein Tag? Was ist dir aufgefallen?' : 'Was war an diesem Tag?'}
        className="block min-h-24 w-full resize-none rounded-3xl bg-surface p-4 text-[16px] leading-snug placeholder:text-muted focus:outline-2 focus:outline-accent [field-sizing:content]"
      />
    </section>
  )
}

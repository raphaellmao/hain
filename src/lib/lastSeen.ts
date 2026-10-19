/**
 * Merkt sich pro Habit, wie groß der Baum beim letzten Ansehen war.
 * Ist er seitdem geschrumpft (verpasste Tage), fallen beim nächsten Öffnen
 * einmal sichtbar die Blätter. Reine Anzeige-Hilfe, keine Nutzerdaten –
 * darum im localStorage und nicht in der Datenbank/im Backup.
 */
import { useEffect, useState } from 'react'

const key = (id: string) => `hain.seen.${id}`

export function useLastSeen(id: string, g: number): number | undefined {
  // nur einmal beim ersten Anzeigen lesen
  const [from] = useState(() => {
    try {
      const v = localStorage.getItem(key(id))
      return v === null ? undefined : Number(v)
    } catch {
      return undefined
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key(id), String(g))
    } catch {
      /* privater Modus o. Ä. – dann eben ohne */
    }
  }, [id, g])

  return from
}

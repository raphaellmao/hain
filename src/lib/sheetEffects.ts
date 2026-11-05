/**
 * Was ein Blatt über der App braucht, damit es sich auf dem Handy richtig verhält:
 * Die Seite dahinter bleibt stehen, die Tastatur verdeckt nichts, und die
 * Zurück-Geste schließt das Blatt, statt die Seite zu verlassen.
 */
import { useEffect, useRef, useState } from 'react'

// ── Seite dahinter festhalten ────────────────────────────────────────────────

let locks = 0

export function useScrollLock() {
  useEffect(() => {
    const root = document.documentElement
    if (locks++ === 0) {
      // Fällt am PC die Scrollleiste weg, soll die Seite nicht zur Seite springen
      root.style.paddingRight = `${window.innerWidth - root.clientWidth}px`
      root.style.overflow = 'hidden'
    }
    return () => {
      if (--locks === 0) {
        root.style.overflow = ''
        root.style.paddingRight = ''
      }
    }
  }, [])
}

// ── Tastatur ─────────────────────────────────────────────────────────────────

const readViewport = () => {
  const vv = window.visualViewport
  return vv ? { top: vv.offsetTop, height: vv.height } : null
}

/**
 * Der gerade sichtbare Teil des Bildschirms. Auf dem iPhone legt sich die Tastatur
 * über die Seite, ohne dass sich deren Höhe ändert: Unten festgemachte Knöpfe lägen
 * sonst dahinter. Ein Blatt hält sich deshalb an diesen Ausschnitt.
 */
export function useVisibleViewport() {
  const [box, setBox] = useState(readViewport)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setBox(readViewport())
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return box
}

// ── Zurück-Geste ─────────────────────────────────────────────────────────────

let nextId = 1
const openSheets = new Set<number>()

// Führt „Zurück“ auf den Verlaufseintrag eines längst geschlossenen Blatts (es wurde
// geschlossen und gleichzeitig weitergeblättert), geht es gleich einen Schritt weiter.
window.addEventListener('popstate', () => {
  const id = history.state?.sheet
  if (id && !openSheets.has(id)) history.back()
})

/**
 * Solange das Blatt offen ist, liegt dafür ein eigener Eintrag im Verlauf. Zurück
 * entfernt nur diesen und schließt das Blatt, die Seite darunter bleibt. Wird es
 * anders geschlossen (`present` wird false), verschwindet der Eintrag wieder.
 */
export function useBackToClose(active: boolean, present: boolean, onClose: () => void) {
  const id = useRef(0)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    if (!active) return
    if (!id.current) id.current = nextId++
    const me = id.current
    openSheets.add(me)
    if (history.state?.sheet !== me) history.pushState({ ...history.state, sheet: me }, '')
    const onPop = () => {
      if (history.state?.sheet !== me) close.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      openSheets.delete(me)
    }
  }, [active])

  useEffect(() => {
    if (active && !present && history.state?.sheet === id.current) history.back()
  }, [active, present])
}

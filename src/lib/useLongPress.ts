/**
 * Langes Drücken (ca. ½ Sekunde) erkennen – zusätzlich zum normalen Tippen.
 * Nach einem langen Druck wird der darauf folgende Klick verschluckt, damit
 * z. B. eine Zeile nicht gleichzeitig abgehakt wird.
 */
import { useRef, type PointerEvent } from 'react'

export function useLongPress(onLongPress: () => void, ms = 480) {
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  const cancel = () => {
    window.clearTimeout(timer.current)
    start.current = null
  }

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = window.setTimeout(() => {
        fired.current = true
        onLongPress()
      }, ms)
    },
    // Wer scrollt, will nicht lange drücken
    onPointerMove: (e: PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // kein Kontextmenü/Textauswahl bei langem Druck
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  }

  /** Im onClick aufrufen: true = war ein langer Druck, Klick ignorieren */
  const consumeLongPress = () => {
    const was = fired.current
    fired.current = false
    return was
  }

  return { handlers, consumeLongPress }
}

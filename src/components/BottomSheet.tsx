import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { motion, useDragControls, useIsPresent, useReducedMotion } from 'motion/react'
import { useBackToClose, useScrollLock, useVisibleViewport } from '../lib/sheetEffects'

/** Ab hier gilt das Herunterziehen als Schließen */
const CLOSE_DISTANCE = 110
const CLOSE_SPEED = 500

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea, select, [href]'

/**
 * Blatt von unten, in AnimatePresence zu verwenden. Schließt über den dunklen
 * Hintergrund, Herunterziehen am Griff, Esc und die Zurück-Geste. `footer` bleibt
 * immer sichtbar, auch über der Tastatur; nur der Inhalt darüber scrollt.
 */
export function BottomSheet({
  onClose,
  labelledBy,
  role = 'dialog',
  backToClose = true,
  onSubmit,
  footer,
  children,
}: {
  onClose: () => void
  labelledBy: string
  role?: 'dialog' | 'alertdialog'
  /** aus, wenn nach dem Schließen sofort weitergeblättert wird (sonst käme sich beides in die Quere) */
  backToClose?: boolean
  /** macht aus dem Blatt ein Formular: Enter schickt ab */
  onSubmit?: (e: FormEvent) => void
  footer?: ReactNode
  children: ReactNode
}) {
  const dialog = useRef<HTMLDivElement>(null)
  // Schon beim ersten Zeichnen merken: autoFocus im Blatt greift, bevor Effekte laufen
  const focusedBefore = useRef(document.activeElement as HTMLElement | null)
  const drag = useDragControls()
  const reduced = useReducedMotion()
  const present = useIsPresent()
  const viewport = useVisibleViewport()

  useScrollLock()
  useBackToClose(backToClose, present, onClose)

  // Fokus ins Blatt und beim Schließen wieder zurück, wo er herkam
  useEffect(() => {
    if (!dialog.current?.contains(document.activeElement)) dialog.current?.focus({ preventScroll: true })
    const before = focusedBefore.current
    return () => before?.focus?.({ preventScroll: true })
  }, [])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !dialog.current) return
    // Mit Tab im Blatt bleiben, nicht in die Seite dahinter wandern
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === dialog.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const bottomPad = 'pb-[max(env(safe-area-inset-bottom),14px)]'
  const content = (
    <>
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${footer ? 'pb-3' : bottomPad}`}>{children}</div>
      {footer && <div className={`border-t border-line px-5 pt-3 ${bottomPad}`}>{footer}</div>}
    </>
  )

  return (
    <motion.div
      className="fixed inset-x-0 z-40 flex items-end justify-center"
      style={{ top: viewport?.top ?? 0, height: viewport?.height ?? '100dvh' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <button type="button" tabIndex={-1} aria-label="Schließen" className="absolute inset-0 touch-none bg-black/45" onClick={onClose} />
      <motion.div
        ref={dialog}
        // Beim Wegfahren nicht mehr bedienbar: Ein zweiter schneller Tipp auf „Hinzufügen“ legte sonst doppelt an
        inert={!present}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative flex max-h-[92%] w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-2xl outline-none"
        initial={{ y: reduced ? 0 : '100%' }}
        animate={{ y: 0 }}
        exit={{ y: reduced ? 0 : '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.8 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_SPEED) onClose()
        }}
      >
        {/* Griff: groß genug für den Daumen, auch wenn der Strich selbst schmal ist */}
        <div className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center" onPointerDown={(e) => drag.start(e)} aria-hidden>
          <div className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {content}
          </form>
        ) : (
          content
        )}
      </motion.div>
    </motion.div>
  )
}

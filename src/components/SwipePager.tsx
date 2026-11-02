import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { navigate, type Route } from '../app/router'
import { tick } from '../lib/haptics'
import { TABS } from './BottomNav'

/** Ab hier entscheidet sich, ob der Finger waagerecht wischt oder senkrecht scrollt */
const LOCK_PX = 10
/** Am Bildschirmrand gehört die Geste dem System (Zurück-Wischen, Android-Navigation) */
const EDGE_PX = 18
/** Wechsel, wenn so viel der Breite gewischt wurde … */
const DISTANCE_SHARE = 0.28
/** … oder der Finger schnell genug war (px/ms) */
const FLICK_SPEED = 0.45
const FLICK_MIN_PX = 30
/** Dämpfung, wenn es in diese Richtung nicht weitergeht */
const RUBBER = 0.22

const settle = { type: 'spring', stiffness: 420, damping: 40 } as const

interface Gesture {
  id: number
  startX: number
  startY: number
  locked: boolean
  dx: number
  /** für die Geschwindigkeit beim Loslassen */
  lastX: number
  lastT: number
  speed: number
}

/**
 * Wischen zwischen den Hauptansichten. Die Seite folgt dem Finger, beim
 * Loslassen fährt sie hinaus und die nächste kommt von der anderen Seite. Es
 * ist immer nur eine Ansicht gerendert – der Garten mit seinen vielen Bäumen
 * soll nicht mitlaufen, nur weil man auf „Heute“ steht.
 */
export function SwipePager({ route, children }: { route: Route; children: ReactNode }) {
  const index = TABS.findIndex((t) => t.key === route.name)
  const prev = index > 0 ? TABS[index - 1] : undefined
  const next = index >= 0 ? TABS[index + 1] : undefined

  const x = useMotionValue(0)
  const reduced = useReducedMotion()
  const [dragging, setDragging] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const swallowClick = useRef(false)

  const nextOpacity = useTransform(x, [-110, -24], [1, 0])
  const prevOpacity = useTransform(x, [24, 110], [0, 1])

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    swallowClick.current = false
    if (index < 0 || e.pointerType === 'mouse' || !e.isPrimary) return
    if (e.clientX < EDGE_PX || e.clientX > window.innerWidth - EDGE_PX) return
    // In Eingabefeldern verschiebt der Finger den Cursor
    if (e.target instanceof Element && e.target.closest('input, textarea, select')) return
    x.stop()
    gesture.current = {
      id: e.pointerId, startX: e.clientX, startY: e.clientY, locked: false,
      dx: 0, lastX: e.clientX, lastT: e.timeStamp, speed: 0,
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (!g.locked) {
      if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return
      if (Math.abs(dy) >= Math.abs(dx)) {
        gesture.current = null // senkrecht: das ist Scrollen
        return
      }
      g.locked = true
      swallowClick.current = true
      setDragging(true)
    }
    if (e.timeStamp - g.lastT > 16) {
      g.speed = (e.clientX - g.lastX) / (e.timeStamp - g.lastT)
      g.lastX = e.clientX
      g.lastT = e.timeStamp
    }
    g.dx = dx
    const target = dx < 0 ? next : prev
    x.set(target ? dx : dx * RUBBER)
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    gesture.current = null
    if (!g.locked) return
    setDragging(false)

    const width = e.currentTarget.offsetWidth
    const target = g.dx < 0 ? next : prev
    const far = Math.abs(g.dx) > width * DISTANCE_SHARE
    // Nur ein Schwung in Wischrichtung zählt, nicht das Zurückziehen kurz vor dem Loslassen
    const flick = Math.abs(g.dx) > FLICK_MIN_PX && Math.abs(g.speed) > FLICK_SPEED && g.speed * g.dx > 0
    if (e.type === 'pointercancel' || !target || !(far || flick)) {
      void animate(x, 0, settle)
      return
    }

    tick()
    const dir = g.dx < 0 ? -1 : 1
    if (reduced) {
      x.set(0)
      navigate(target.path, { replace: true })
      return
    }
    void animate(x, dir * width, {
      duration: 0.13,
      ease: 'easeIn',
      onComplete: () => {
        navigate(target.path, { replace: true })
        x.set(-dir * width * 0.35)
        void animate(x, 0, settle)
      },
    })
  }

  function onClickCapture(e: MouseEvent) {
    // Der Finger hat gewischt, nicht getippt
    if (!swallowClick.current) return
    swallowClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="overflow-x-clip">
      <motion.div
        style={{ x, touchAction: index >= 0 ? 'pan-y pinch-zoom' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        {children}
      </motion.div>
      {dragging && next && (
        <motion.div style={{ opacity: nextOpacity }} className="pointer-events-none fixed top-1/2 right-3 z-10 -translate-y-1/2" aria-hidden>
          <Peek label={next.label} Icon={next.Icon} />
        </motion.div>
      )}
      {dragging && prev && (
        <motion.div style={{ opacity: prevOpacity }} className="pointer-events-none fixed top-1/2 left-3 z-10 -translate-y-1/2" aria-hidden>
          <Peek label={prev.label} Icon={prev.Icon} />
        </motion.div>
      )}
    </div>
  )
}

/** Wohin es geht: wird beim Wischen am Rand sichtbar. */
function Peek({ label, Icon }: { label: string; Icon: (typeof TABS)[number]['Icon'] }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-[14px] font-semibold text-bg shadow-lg">
      <Icon width={18} height={18} />
      {label}
    </span>
  )
}

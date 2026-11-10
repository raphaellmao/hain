/**
 * Belohnung, sobald das Letzte für heute abgehakt ist: Blütenregen, Laub, Schnee
 * oder Glühwürmchen – je nach Tageszeit und Jahreszeit –, dazu eine Karte, auf der
 * ein Baum wächst, und die Serie perfekter Tage. Die große Feier gibt es einmal am
 * Tag; wer danach wieder ab- und anhakt, bekommt nur noch den kurzen Effekt.
 *
 * Unsichtbar in App eingebunden, damit es egal ist, wo abgehakt wird.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { doneFor, excusedSet, excusesFor, useDoneMap, useExcuseMap, useHabits, useToday } from '../db/hooks'
import { colorHex, type ColorKey } from '../domain/colors'
import type { DateStr } from '../domain/dates'
import { dayStatus, perfectStats, type PerfectStats } from '../domain/perfect'
import { SPECIES_KEYS } from '../domain/species'
import { navigate, paths } from '../app/router'
import { rnd } from '../garden/palette'
import { celebrate } from '../lib/haptics'
import { useSky, type Sky } from '../lib/sky'
import { Tree } from '../tree/Tree'

type Variant = 'bluete' | 'laub' | 'schnee' | 'gluehwuermchen'

interface Party {
  key: number
  big: boolean
  variant: Variant
  colors: string[]
  due: number
  stats: PerfectStats
  date: DateStr
  treeColor: ColorKey
}

const SEEN_KEY = 'hain.feier.v1'

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}
function writeSeen(date: string) {
  try {
    localStorage.setItem(SEEN_KEY, date)
  } catch {
    /* privater Modus – dann eben jedes Mal groß */
  }
}

export function variantFor(sky: Pick<Sky, 'phase' | 'season'>): Variant {
  if (sky.phase === 'nacht') return 'gluehwuermchen'
  if (sky.season === 'winter') return 'schnee'
  if (sky.season === 'herbst' || sky.phase === 'abend') return 'laub'
  return 'bluete'
}

export function CelebrationWatcher() {
  const habits = useHabits()
  const doneMap = useDoneMap()
  const excuseMap = useExcuseMap()
  const today = useToday()
  const sky = useSky()
  // Ein Wechsel der Tageszeit ist kein Anlass zu feiern – nur nachlesen, nicht beobachten
  const skyRef = useRef(sky)
  skyRef.current = sky
  const [party, setParty] = useState<Party | null>(null)
  const before = useRef<{ date: DateStr; complete: boolean } | null>(null)

  // Erst rechnen, wenn alles geladen ist – sonst sähe das Nachladen der Ausnahmen wie ein Abhaken aus
  const items = useMemo(() => {
    if (!habits || !doneMap || !excuseMap) return null
    return habits.map((habit) => ({ habit, done: doneFor(doneMap, habit.id), excused: excusedSet(excusesFor(excuseMap, habit.id)) }))
  }, [habits, doneMap, excuseMap])
  const status = useMemo(() => (items ? dayStatus(items, today) : null), [items, today])

  useEffect(() => {
    if (!status || !items || !habits) return
    const prev = before.current
    before.current = { date: today, complete: status.complete }
    // Beim Laden und nach Mitternacht nur merken, nicht feiern
    if (!prev || prev.date !== today || prev.complete || !status.complete) return
    const big = readSeen() !== today
    if (big) writeSeen(today)
    celebrate()
    const colors = [...new Set(habits.map((h) => colorHex(h.color)))]
    const daySeed = Number(today.replaceAll('-', ''))
    setParty({
      key: Date.now(),
      big,
      variant: variantFor(skyRef.current),
      colors,
      due: status.due,
      stats: perfectStats(items, today),
      date: today,
      treeColor: habits[daySeed % habits.length].color,
    })
  }, [status, items, habits, today])

  return createPortal(
    <AnimatePresence>{party && <Celebration key={party.key} party={party} onClose={() => setParty(null)} />}</AnimatePresence>,
    document.body,
  )
}

// ── Darstellung ─────────────────────────────────────────────────────────────

const PALETTES: Record<Variant, string[]> = {
  bluete: ['#ffd1e3', '#fff4f8', '#f7a8c9'],
  laub: ['#e8843a', '#c9542c', '#e9b53b', '#b5651d', '#f2c14e'],
  schnee: ['#ffffff', '#eaf4ff', '#d6e9ff'],
  gluehwuermchen: ['#f4ff9c', '#ffe9a3'],
}

type Vars = CSSProperties & Record<`--${string}`, string>

function particles(party: Party): { style: Vars; className: string }[] {
  const count = party.big ? 38 : 18
  const colors = party.variant === 'bluete' ? [...PALETTES.bluete, ...party.colors] : PALETTES[party.variant]
  const rising = party.variant === 'gluehwuermchen'
  return Array.from({ length: count }, (_, i) => {
    const size = rising ? 5 + rnd(i, 3) * 5 : party.variant === 'schnee' ? 5 + rnd(i, 3) * 7 : 9 + rnd(i, 3) * 9
    return {
      className: `cel cel-${party.variant}`,
      style: {
        left: `${rnd(i, 1) * 100}%`,
        width: `${size}px`,
        height: `${party.variant === 'bluete' || party.variant === 'laub' ? size * 0.8 : size}px`,
        background: colors[Math.floor(rnd(i, 4) * colors.length)],
        animationDuration: `${(rising ? 3 : 2.6) + rnd(i, 5) * 1.8}s`,
        animationDelay: `${rnd(i, 6) * (party.big ? 1.1 : 0.5)}s`,
        '--dx': `${(rnd(i, 7) - 0.5) * 140}px`,
        '--rot': `${Math.round(180 + rnd(i, 8) * 540) * (i % 2 ? 1 : -1)}deg`,
      },
    }
  })
}

const MILESTONES: Record<number, string> = {
  3: 'Drei Tage am Stück – der Anfang einer Serie.',
  7: 'Eine ganze Woche ohne Lücke!',
  14: 'Zwei Wochen perfekt – das wird zur Gewohnheit.',
  30: 'Ein ganzer Monat. Respekt.',
  50: 'Fünfzig perfekte Tage in Folge.',
  100: 'Hundert Tage. Legendär.',
}

function Celebration({ party, onClose }: { party: Party; onClose: () => void }) {
  const parts = useMemo(() => particles(party), [party])
  const card = useRef<HTMLDivElement>(null)

  // Ein Tipp daneben schließt die Karte, geht aber trotzdem durch – wer gleich
  // weitermachen will (z. B. das neunte Glas Wasser), verliert keinen Tipp
  useEffect(() => {
    if (!party.big) return
    const onDown = (e: PointerEvent) => {
      if (!card.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [party.big, onClose])

  useEffect(() => {
    const t = window.setTimeout(onClose, party.big ? 6500 : 3200)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [party, onClose])

  const { streak, total } = party.stats
  const line = streak >= 2 ? `🔥 ${streak} perfekte Tage in Folge` : total >= 2 ? `🌟 Dein ${total}. perfekter Tag` : '🌟 Dein erster perfekter Tag'

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[35] overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      data-celebration={party.big ? 'gross' : 'klein'}
      data-variant={party.variant}
    >
      <div className={`celebrate-glow celebrate-glow-${party.variant}`} aria-hidden />
      <div aria-hidden>
        {parts.map((p, i) => (
          <span key={i} className={p.className} style={p.style} />
        ))}
      </div>
      {party.big && (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <motion.div
            ref={card}
            onClick={onClose}
            initial={{ opacity: 0, scale: 0.8, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.15 }}
            className="pointer-events-auto w-full max-w-[320px] rounded-[32px] bg-surface px-5 pt-3 pb-4 text-center shadow-2xl"
            role="status"
            aria-live="polite"
          >
            <span className="mx-auto block size-36">
              <GrowingTree date={party.date} color={party.treeColor} />
            </span>
            <span className="block text-[26px] leading-tight font-bold">Tag geschafft!</span>
            <span className="mt-1 block text-[15px] text-muted">
              {party.due === 1 ? 'Alles Fällige für heute erledigt' : `Alle ${party.due} Gewohnheiten erledigt`}
            </span>
            <span className="mt-2 block text-[16px] font-semibold text-accent">{line}</span>
            {MILESTONES[streak] && <span className="mt-1 block text-[14px]">{MILESTONES[streak]}</span>}
            <span className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="h-11 rounded-2xl bg-surface-2 text-[15px] font-medium">
                Weiter
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                  navigate(paths.garden)
                }}
                className="h-11 rounded-2xl bg-accent text-[15px] font-semibold text-accent-ink"
              >
                Zum Garten ✨
              </button>
            </span>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

/** Der Baum des Tages wächst in wenigen Schritten vom Keimling zur Blüte */
function GrowingTree({ date, color }: { date: DateStr; color: ColorKey }) {
  const seed = Number(date.replaceAll('-', ''))
  const species = SPECIES_KEYS[seed % SPECIES_KEYS.length]
  const [g, setG] = useState(1.2)
  useEffect(() => {
    const steps = [2.2, 3.2, 4.4, 5.6, 6.7]
    let i = 0
    const t = window.setInterval(() => {
      setG(steps[i])
      i++
      if (i >= steps.length) window.clearInterval(t)
    }, 280)
    return () => window.clearInterval(t)
  }, [])
  return <Tree seed={seed} color={color} species={species} g={g} animated className="size-full" />
}

/**
 * Zeichnet den Baum eines Habits als SVG.
 *
 * Je nach Wachstum g (0 … 7, siehe health.ts → growthOf):
 *   g < 1   Erde (oder kahler Stummel, wenn der Baum eingegangen ist)
 *   g < 2   Samen
 *   g < 3   Keimling
 *   g ≥ 3   prozeduraler Baum aus generate.ts (Busch → blühender Baum)
 *
 * Animationen (nur mit `animated`):
 *   - neue Blätter/Blüten „ploppen“ auf (CSS-Keyframes, siehe index.css)
 *   - der ganze Baum „streckt sich“ kurz, wenn g steigt (motion)
 *   - Größenänderung federt weich nach (motion)
 *   - sinkt g, fallen die verlorenen Blätter herunter
 * Pro Blatt werden bewusst CSS-Animationen statt motion-Komponenten benutzt:
 * Ein großer Baum hat ~200 Blätter, CSS kostet dabei praktisch kein JavaScript
 * und bleibt auch auf älteren Handys bei 60 fps.
 */
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, useAnimate } from 'motion/react'
import type { ColorKey } from '../domain/colors'
import { STAGE_NAMES } from '../domain/health'
import { BASE_X, GROUND, leafPath, leafVisible, quadPoint, treeModel, treeScale, type TreeModel } from './generate'
import { clamp, lerp } from './rng'
import { DORMANT_BARK, treePalette, type TreePalette } from './palette'
import { useDarkMode } from '../lib/useDarkMode'

export interface TreeProps {
  seed: number
  color: ColorKey
  /** Wachstum 0 … 7 */
  g: number
  wilted?: boolean
  dormant?: boolean
  /** Animationen an (Heute, Detail) oder aus (Garten, Vorschauen) */
  animated?: boolean
  /** Wachstum beim letzten Ansehen: war es größer, fallen beim Öffnen Blätter */
  fromG?: number
  /** Erde unter dem Baum zeichnen */
  ground?: boolean
  className?: string
}

export const Tree = memo(function Tree({
  seed,
  color,
  g,
  wilted = false,
  dormant = false,
  animated = false,
  fromG,
  ground = true,
  className,
}: TreeProps) {
  const dark = useDarkMode()
  const model = treeModel(seed)
  const wilt = wilted ? 1 : 0
  const pal = useMemo(() => treePalette(color, wilt, dark), [color, wilt, dark])
  const pop = usePopTracker(animated, fromG)

  // ── Reaktion auf Wachstumsänderungen ──────────────────────────────────────
  const [scope, animate] = useAnimate<SVGGElement>()
  const prevG = useRef(fromG ?? g)
  const [fall, setFall] = useState<{ from: number; to: number; key: number } | null>(null)

  useEffect(() => {
    const prev = prevG.current
    prevG.current = g
    if (!animated) return
    if (g < prev - 1e-6) {
      setFall({ from: prev, to: g, key: Date.now() })
    } else if (g > prev + 1e-6 && scope.current) {
      // kurz strecken: erst in die Höhe, dann zurückfedern
      animate(scope.current, { scaleY: [1, 1.08, 0.98, 1], scaleX: [1, 0.97, 1.01, 1] }, { duration: 0.65 })
    }
  }, [g, animated, animate, scope])

  useEffect(() => {
    if (!fall) return
    const t = window.setTimeout(() => setFall(null), 1900)
    return () => window.clearTimeout(t)
  }, [fall])

  // ── Inhalt je nach Stufe ──────────────────────────────────────────────────
  // Die Teile werden als normale Funktionen aufgerufen (nicht als <Komponente/>),
  // damit sie *jetzt* laufen – der Pop-Tracker muss vor pop.end() alles sehen.
  const isTree = g >= 3
  let content: ReactNode
  if (g < 1) content = dormant ? Dormant({ model, pal, dark }) : PlantingHole({ pal })
  else if (g < 2) content = Seed({ t: g - 1, pal, pop: pop.is })
  else if (g < 3) content = Sprout({ t: g - 2, pal, wilt, pop: pop.is })
  else content = FullTree({ model, g, pal, wilt, pop: pop.is })
  pop.end()

  const scale = isTree ? treeScale(g) : 1
  const stage = Math.min(6, Math.floor(g))
  const label = dormant && g < 1 ? 'Kahler Stamm' : `${STAGE_NAMES[stage]}${wilted ? ', welk' : ''}`

  const viewBox = viewBoxFor(g)
  const Svg = animated ? motion.svg : 'svg'

  return (
    <Svg
      {...(animated
        ? { initial: false, animate: { viewBox }, transition: { type: 'spring', stiffness: 120, damping: 20 } }
        : { viewBox })}
      className={`${animated ? 'tree-anim ' : ''}${className ?? ''}`}
      role="img"
      aria-label={label}
      overflow="visible"
    >
      {/* Erde gegen den Zoom skalieren → im Garten überall gleich groß */}
      {ground && <g transform={scaleAboutBase(zoomOf(g) / 200)}>{Soil({ pal })}</g>}
      {animated ? (
        // key: Beim Wechsel Keimling ↔ Baum neu aufbauen statt hinüberzufedern
        <motion.g
          key={isTree ? 'tree' : 'small'}
          initial={false}
          animate={{ scale }}
          transition={{ type: 'spring', stiffness: 140, damping: 16 }}
          // Skalieren um den Stammfuß. motion setzt den Ursprung selbst –
          // darum originX/originY statt transformOrigin.
          style={{ transformBox: 'view-box', originX: `${BASE_X}px`, originY: `${GROUND}px` }}
        >
          <g ref={scope} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
            {content}
          </g>
        </motion.g>
      ) : (
        <g transform={scaleAboutBase(scale)}>{content}</g>
      )}
      {fall && <FallingLeaves key={fall.key} model={model} from={fall.from} to={fall.to} color={color} dark={dark} />}
    </Svg>
  )
})

/**
 * Kamera: Kleine Pflanzen werden herangezoomt, damit ein Samen auch im
 * 64-px-Listenbild erkennbar ist. Ab dem jungen Baum ist alles im Bild.
 */
const zoomOf = (g: number) => lerp(112, 200, clamp((g - 1.5) / 4, 0, 1))

function viewBoxFor(g: number): string {
  const v = zoomOf(g)
  const y0 = GROUND + (22 * v) / 200 - v
  return `${(BASE_X - v / 2).toFixed(1)} ${y0.toFixed(1)} ${v.toFixed(1)} ${v.toFixed(1)}`
}

const scaleAboutBase = (s: number) =>
  s === 1 ? undefined : `translate(${BASE_X} ${GROUND}) scale(${s}) translate(${-BASE_X} ${-GROUND})`

/** Blätter hängen lassen: Winkel Richtung „nach unten“ ziehen. */
function droop(angle: number, wilt: number): number {
  if (!wilt) return angle
  const target = angle >= 0 ? 165 : -165
  return angle + (target - angle) * 0.42 * wilt
}

const leafTransform = (x: number, y: number, angle: number) => ({
  transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
})

// ── Teile ────────────────────────────────────────────────────────────────────

function Soil({ pal }: { pal: TreePalette }) {
  return (
    <>
      <ellipse cx={BASE_X} cy={GROUND + 6} rx={60} ry={9} fill={pal.soilShadow} />
      <path d={`M${BASE_X - 40} ${GROUND + 4}Q${BASE_X} ${GROUND - 7} ${BASE_X + 40} ${GROUND + 4}Z`} fill={pal.soil} />
    </>
  )
}

function PlantingHole({ pal }: { pal: TreePalette }) {
  return <ellipse cx={BASE_X} cy={GROUND - 1} rx={6} ry={1.8} fill={pal.soilShadow} opacity={0.9} />
}

const SEED_PATH = 'M0 -8C5 -7 6.5 -1 5 3.5C3.5 7.5 -3.5 7.5 -5 3.5C-6.5 -1 -5 -7 0 -8Z'

function SeedShape({ x, y, scale, pal }: { x: number; y: number; scale: number; pal: TreePalette }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-18) scale(${scale})`}>
      <path d={SEED_PATH} fill={pal.seed} />
      <path d="M-2 -5C-3.5 -2 -3.5 1 -2.4 3.4" stroke="#fff" strokeOpacity={0.3} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </g>
  )
}

/** Samen: wird etwas dicker, ab der Hälfte schaut ein Trieb heraus. */
function Seed({ t, pal, pop }: { t: number; pal: TreePalette; pop: PopFn }) {
  const shoot = t >= 0.5 ? 5 + (t - 0.5) * 16 : 0
  return (
    <>
      <SeedShape x={BASE_X} y={GROUND - 8} scale={1.5 + t * 0.4} pal={pal} />
      {shoot > 0 && (
        <path
          className={pop('shoot', 1.5) ? 'pop-up' : undefined}
          d={`M${BASE_X + 2} ${GROUND - 19}q3 ${-shoot * 0.7} -1.5 ${-shoot * 1.4}`}
          stroke={pal.sprout}
          strokeWidth={3.4}
          fill="none"
          strokeLinecap="round"
        />
      )}
    </>
  )
}

/** Keimling: Stängel mit Keimblättern, dann kommen echte Blattpaare dazu. */
function Sprout({ t, pal, wilt, pop }: { t: number; pal: TreePalette; wilt: number; pop: PopFn }) {
  const h = 22 + 40 * t
  const x0 = BASE_X, y0 = GROUND, cx = BASE_X + 6, cy = GROUND - h * 0.5, x1 = BASE_X + 2.5, y1 = GROUND - h
  const at = (f: number) => quadPoint(x0, y0, cx, cy, x1, y1, f)
  const cot = at(Math.min(1, 20 / h))

  const leaves: { id: string; x: number; y: number; a: number; s: number; round?: boolean; appear: number }[] = [
    { id: 'c1', x: cot.x, y: cot.y, a: -72, s: 12, round: true, appear: 2 },
    { id: 'c2', x: cot.x, y: cot.y, a: 72, s: 12, round: true, appear: 2 },
  ]
  if (t >= 0.25) {
    const s = 8 + (t - 0.25) * 22
    leaves.push({ id: 'p1', x: x1, y: y1, a: -36, s, appear: 2.25 }, { id: 'p2', x: x1, y: y1, a: 36, s, appear: 2.25 })
  }
  if (t >= 0.75) {
    const p = at(0.7)
    leaves.push({ id: 'q1', x: p.x, y: p.y, a: -62, s: 11, appear: 2.75 }, { id: 'q2', x: p.x, y: p.y, a: 62, s: 11, appear: 2.75 })
  }

  return (
    <>
      <path d={`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`} stroke={pal.sprout} strokeWidth={3.6} fill="none" strokeLinecap="round" />
      {leaves.map((l) => (
        <g key={l.id} className="leaf-g" style={leafTransform(l.x, l.y, droop(l.a, wilt))}>
          <path
            className={pop(l.id, l.appear) ? 'leaf leaf-pop' : 'leaf'}
            d={l.round ? cotyledonPath(l.s) : leafPath(l.s)}
            fill={l.round ? pal.sprout : pal.leaf(0)}
          />
        </g>
      ))}
    </>
  )
}

const cotyledonPath = (s: number) =>
  `M0 0C${0.5 * s} ${-0.1 * s} ${0.6 * s} ${-0.8 * s} 0 ${-s}C${-0.6 * s} ${-0.8 * s} ${-0.5 * s} ${-0.1 * s} 0 0Z`

/** Der eigentliche Baum: Äste wachsen über die Strichlänge, Blätter erscheinen nach `appear`. */
function FullTree({ model, g, pal, wilt, pop }: { model: TreeModel; g: number; pal: TreePalette; wilt: number; pop: PopFn }) {
  return (
    <>
      <path d={model.flare} fill={pal.bark} />
      {model.branches.map((b) => {
        if (b.start >= g) return null
        const p = Math.min(1, (g - b.start) / b.span)
        return (
          <path
            key={b.id}
            className="branch"
            d={b.d}
            fill="none"
            stroke={pal.bark}
            strokeWidth={b.width}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 2"
            strokeDashoffset={1 - p}
          />
        )
      })}
      {model.leaves.map((l) =>
        !leafVisible(l, g) ? null : (
          <g key={l.id} className="leaf-g" style={leafTransform(l.x, l.y, droop(l.angle, wilt))}>
            <path className={pop(`l${l.id}`, l.appear) ? 'leaf leaf-pop' : 'leaf'} d={l.d} fill={pal.leaf(l.shade)} />
          </g>
        ),
      )}
      {model.blossoms.map((b) =>
        b.appear > g ? null : (
          <g key={b.id} style={{ transform: `translate(${b.x}px, ${b.y}px)` }}>
            <g className={pop(`b${b.id}`, b.appear) ? 'leaf-pop' : undefined}>
              <path className="leaf" d={b.d} fill={pal.blossom(b.shade)} />
              <circle r={b.size * 0.32} fill={pal.blossomCenter} />
            </g>
          </g>
        ),
      )}
    </>
  )
}

/** Eingegangener Baum: grauer Stamm mit Aststummeln, daneben ein neuer Samen. */
function Dormant({ model, pal, dark }: { model: TreeModel; pal: TreePalette; dark: boolean }) {
  const bark = DORMANT_BARK(dark)
  return (
    <>
      <g transform={scaleAboutBase(0.55)}>
        <path d={model.flare} fill={bark} />
        {model.branches
          .filter((b) => b.depth <= 1)
          .map((b) => (
            <path
              key={b.id}
              d={b.d}
              fill="none"
              stroke={bark}
              strokeWidth={b.width}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 2"
              strokeDashoffset={b.depth === 0 ? 0 : 0.62}
            />
          ))}
      </g>
      <SeedShape x={BASE_X + 26} y={GROUND - 3} scale={0.8} pal={pal} />
    </>
  )
}

/** Blätter und Blüten zwischen `to` und `from` fallen einmal herunter. */
function FallingLeaves({ model, from, to, color, dark }: { model: TreeModel; from: number; to: number; color: ColorKey; dark: boolean }) {
  // Fallende Blätter sind schon verfärbt
  const pal = treePalette(color, 1, dark)
  const leaves = model.leaves.filter((l) => leafVisible(l, from) && !leafVisible(l, to))
  const blossoms = model.blossoms.filter((b) => b.appear > to && b.appear <= from)
  if (!leaves.length && !blossoms.length) return null
  // Bei vielen Blättern nur jedes n-te animieren – sieht genauso aus, spart Arbeit
  const step = Math.max(1, Math.ceil(leaves.length / 60))
  const fallStyle = (id: number) =>
    ({
      '--dx': `${((id * 37) % 41) - 20}px`,
      '--rot': `${((id * 53) % 160) - 80}deg`,
      animationDelay: `${(id % 9) * 70}ms`,
    }) as CSSProperties

  return (
    <g transform={scaleAboutBase(from >= 3 ? treeScale(from) : 1)} aria-hidden>
      {leaves
        .filter((_, i) => i % step === 0)
        .map((l) => (
          <g key={`l${l.id}`} className="leaf-fall" style={fallStyle(l.id)}>
            <g style={leafTransform(l.x, l.y, l.angle)}>
              <path d={l.d} fill={pal.leaf(l.shade)} />
            </g>
          </g>
        ))}
      {blossoms.map((b) => (
        <g key={`b${b.id}`} className="leaf-fall" style={fallStyle(b.id + 7)}>
          <path d={b.d} transform={`translate(${b.x} ${b.y})`} fill={pal.blossom(b.shade)} />
        </g>
      ))}
    </g>
  )
}

// ── Welche Elemente sind neu? ────────────────────────────────────────────────

type PopFn = (id: string, appear: number) => boolean

/**
 * Merkt sich, welche Elemente schon zu sehen waren. Kommt ein Element neu
 * dazu, bekommt es einmalig die Plopp-Animation. Beim ersten Zeichnen
 * ploppt nichts – außer, es ist seit dem letzten Ansehen (`fromG`) gewachsen.
 */
function usePopTracker(enabled: boolean, fromG: number | undefined) {
  const ref = useRef<{ seen: Set<string>; popped: Set<string>; now: Set<string>; first: boolean } | null>(null)
  if (!ref.current) ref.current = { seen: new Set(), popped: new Set(), now: new Set(), first: true }
  const st = ref.current
  st.now = new Set()

  const is: PopFn = (id, appear) => {
    st.now.add(id)
    if (!st.seen.has(id)) {
      st.seen.add(id)
      const isNew = st.first ? fromG !== undefined && appear > fromG : true
      if (enabled && isNew) st.popped.add(id)
    }
    return st.popped.has(id)
  }
  const end = () => {
    for (const id of st.seen) {
      if (!st.now.has(id)) {
        st.seen.delete(id)
        st.popped.delete(id)
      }
    }
    st.first = false
  }
  return { is, end }
}

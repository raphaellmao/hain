/**
 * Schatten-Ich: Du (Licht, Habit-Farbe) und dein Schatten stehen sich auf
 * demselben Boden gegenüber. Die Grenze zwischen deinem Land und seinem
 * verschiebt sich mit dem Kräfteverhältnis (domain/shadow.ts).
 *
 * Je stärker der Schatten (S), desto größer und dichter wird er: mehr dunkle
 * Schwaden steigen von ihm auf, die Augen glühen heller, Risse ziehen durch
 * seinen Boden, ab „Verfolger“ greifen Klauen und Ranken nach dir. Bist du
 * stark, wird er klein, blass und an den Rand gedrängt.
 *
 * Animationen sind reines CSS (Schwaden, Funken, Atmen, Augenflackern – siehe
 * index.css) plus motion für das Vorrücken/Zurückweichen. Keine SVG-Filter:
 * die sind auf dem Handy teuer.
 */
import { memo, useEffect, useId, useRef, type CSSProperties } from 'react'
import { motion, useAnimate } from 'motion/react'
import { type ColorKey, colorHex, hexToHsl, hsl } from '../domain/colors'
import { SHADOW_LEVELS, TERRITORY_STATUS, levelOf, statusOf } from '../domain/shadow'
import { clamp, lerp } from '../tree/rng'
import { useDarkMode } from '../lib/useDarkMode'

export interface ShadowDuelProps {
  color: ColorKey
  /** dein Anteil am Territorium 0 … 1 */
  territory: number
  /** Stärke des Schattens 0 … 100 */
  s: number
  /** dein Licht 0 … 100 */
  light: number
  animated?: boolean
  /** Anteil beim letzten Ansehen – von dort aus wird hinübergeblendet */
  fromTerritory?: number
  /** wie viele Partikel: klein (Liste), normal (Garten), reich (Detail) */
  density?: 'small' | 'normal' | 'rich'
  className?: string
}

const BASE_Y = 181

// ── Formen (lokale Koordinaten: Fußpunkt bei 0,0, Kapuzenspitze oben bei −123) ──
// Kapuzengestalt mit Blick nach rechts (der Schatten wird gespiegelt und blickt nach links).
const SIDE_R =
  'M3 -123C10 -121 16 -112 16 -101C16 -93 14 -88 11 -84C20 -82 27 -78 29 -70C31 -60 31 -46 32 -34C33 -22 36 -10 38 0'
const SIDE_L =
  'C-36 -10 -33 -22 -32 -34C-31 -46 -31 -60 -29 -70C-27 -78 -20 -82 -11 -84C-14 -88 -16 -93 -16 -101C-16 -114 -6 -124 3 -123Z'
const LIGHT_CLOAK = `${SIDE_R}Q0 5 -38 0${SIDE_L}`
/** zerfetzter Saum, die Fetzen laufen in Rauch aus */
const SHADOW_CLOAK = `${SIDE_R}L35 9L30 -1L25 13L19 0L13 11L7 -2L1 14L-5 -1L-11 12L-17 -1L-23 11L-28 -2L-33 9L-38 0${SIDE_L}`
const FOLDS = 'M-5 -76C-9 -50 -12 -24 -16 -1M9 -76C12 -52 15 -26 19 0M3 -78C3 -52 4 -26 5 2'
const HOOD_RIM = 'M-11 -86C-6 -80 12 -80 15 -88'
const FACE = { cx: 3.5, cy: -101, rx: 8, ry: 10.5 }
/** Klauen, die aus dem Umhang nach vorn (zu dir) greifen */
const CLAWS = 'M24 -52C34 -52 43 -49 51 -44M24 -48C35 -46 43 -41 49 -35M24 -44C33 -40 39 -34 43 -27'
const EYE = 'M-2.2 0Q0 -1.7 2.2 0Q0 1.2 -2.2 0Z'

// Sense des Schattens (vor dem Spiegeln zeigt die Klinge nach vorn = zu dir)
const SCYTHE_STAFF = 'M24 8C27 -40 31 -100 35 -150'
const SCYTHE_STAFF_HI = 'M25.4 5C28.4 -40 32.4 -100 36.2 -147'
const SCYTHE_GRIP = 'M26 -58L39 -62'
const SCYTHE_BLADE = 'M35 -150C55 -162 82 -156 96 -134C84 -144 62 -146 36 -139Z'
const SCYTHE_EDGE = 'M40 -148C60 -156 80 -151 93 -137'
const BLOOD_SMEAR = 'M58 -146C70 -150 82 -147 90 -138C83 -142 73 -143.5 61 -142.5Z'
const BLOOD_SPOT = 'M45 -143.5C49 -146 54 -145.5 57 -143.5C54 -142.4 49 -142.2 45 -143.5Z'
const DRIP = 'M0 0C1.3 2.2 1.5 4.8 0 6.4C-1.5 4.8 -1.3 2.2 0 0Z'
/** Ansatzpunkte der Tropfen an der Unterkante der Klinge */
const DRIPS: [number, number][] = [[80, -141.6], [66, -143.6], [89, -138.4], [55, -143.4]]

// Spartanischer Rundschild (Hoplon) mit Lambda und Xiphos (Kurzschwert)
const SHIELD = { cx: 22, cy: -54, r: 21 }
const LAMBDA = 'M13 -41L22 -66L31 -41'
const SHIELD_SHINE = 'M8 -63C12 -70 20 -73.5 28 -72.5'
const SWORD_BLADE = 'M18 -31L52 -33C58 -33 63 -31.5 69 -30C63 -28.5 58 -27 52 -27L18 -29Z'
const SWORD_EDGE = 'M20 -30L66 -30'

/** Rauchzunge: hoch und schmal, Fuß bei (0, 0) */
const tongue = (r: number) =>
  `M0 0C${r * 0.9} ${-r * 0.3} ${r * 0.75} ${-r * 1.4} ${r * 0.1} ${-r * 2.5}` +
  `C${-r * 0.1} ${-r * 1.7} ${-r * 0.95} ${-r * 1.2} ${-r * 0.7} ${-r * 0.4}C${-r * 0.55} ${-r * 0.1} ${-r * 0.3} 0 0 0Z`

// Startpunkte der Schwaden am Schatten (x, y, Größe) – hinter und vor ihm
const WISPS_BACK: [number, number, number][] = [
  [2, -118, 9], [-12, -104, 8], [16, -100, 7], [-26, -72, 9], [28, -70, 8], [0, -60, 10], [-32, -30, 9],
]
const WISPS_FRONT: [number, number, number][] = [
  [-8, -112, 6], [12, -84, 6], [-20, -44, 7], [24, -36, 7], [-34, 4, 8], [34, 6, 8], [4, 8, 9],
]
const EMBERS: [number, number][] = [[-14, -60], [10, -90], [-30, -20], [26, -30], [0, -10], [-6, -104]]
const MOTES: [number, number][] = [[-16, -70], [14, -86], [-26, -24], [22, -36], [4, -110], [-4, -40]]
// Risse im dunklen Boden (Weltkoordinaten)
const CRACKS = [
  'M120 180L131 183L139 179L150 184',
  'M150 178L158 181L163 177L174 180',
  'M108 184L117 186L126 184',
  'M165 186L176 184L186 186',
  'M135 186L142 188L150 186L156 189',
]

const seq = (i: number, a: number, b: number, salt = 0) => a + (((i * 37 + salt * 17) % 23) / 22) * (b - a)

export const ShadowDuel = memo(function ShadowDuel({
  color,
  territory,
  s,
  light,
  animated = false,
  fromTerritory,
  density = 'normal',
  className,
}: ShadowDuelProps) {
  const dark = useDarkMode()
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const id = (n: string) => `${n}${uid}`
  const url = (n: string) => `url(#${id(n)})`

  const accent = hexToHsl(colorHex(color))
  const lightTop = hsl({ h: accent.h, s: Math.min(90, accent.s), l: Math.min(92, accent.l + 26) })
  const lightBottom = hsl({ h: accent.h, s: accent.s, l: accent.l - 4 })
  const lightDeep = hsl({ h: accent.h, s: accent.s * 0.8, l: Math.max(12, accent.l - 34) })
  const T = clamp(territory, 0.02, 0.98)
  const S = clamp(s, 0, 100)
  const menace = S / 100

  const layout = (t: number) => {
    const bx = 12 + 176 * t
    return {
      bx,
      youX: clamp(bx * 0.5 + 6, 36, 98),
      shadowX: clamp((bx + 200) / 2 - 6, 102, 168),
      youS: lerp(0.42, 0.9, t),
      shadowS: lerp(0.4, 1, 1 - t) * (0.88 + 0.22 * menace),
    }
  }
  const L = layout(T)
  const from = fromTerritory !== undefined ? layout(clamp(fromTerritory, 0.02, 0.98)) : undefined
  const shadowOpacity = clamp(0.45 + 0.55 * Math.max(1 - T, menace), 0.45, 1)
  const lightOpacity = clamp(0.5 + 0.5 * T, 0.5, 1)

  // Partikel-Anzahl nach Stärke und Platz
  const max = density === 'small' ? 4 : density === 'normal' ? 7 : 14
  const nWisps = Math.round(lerp(2, max, menace))
  const nEmbers = density === 'small' || S < 30 ? 0 : Math.round(lerp(1, density === 'rich' ? 6 : 3, (S - 30) / 70))
  const nMotes = density === 'small' ? 0 : Math.round(lerp(0, density === 'rich' ? 6 : 3, light / 100))
  const claws = clamp((S - 40) / 45, 0, 1)
  const tendril = clamp((S - 50) / 50, 0, 1)

  // Ground colors
  const darkLand = dark ? '#0c0710' : '#2a2131'
  const lightLand = hsl({ h: accent.h, s: dark ? 30 : 40, l: dark ? 26 : 84 })
  const lightLandEdge = hsl({ h: accent.h, s: dark ? 35 : 45, l: dark ? 34 : 74 })

  // ── Reaktion: Licht pulsiert, Schatten weicht zurück / stößt vor ──────────
  const [lightPulse, animateLight] = useAnimate<SVGGElement>()
  const [shadowPulse, animateShadow] = useAnimate<SVGGElement>()
  const prev = useRef(territory)
  useEffect(() => {
    const before = prev.current
    prev.current = territory
    if (!animated || Math.abs(territory - before) < 1e-6) return
    if (territory > before) {
      if (lightPulse.current) animateLight(lightPulse.current, { scale: [1, 1.45, 1], opacity: [1, 1, 1] }, { duration: 0.8 })
      if (shadowPulse.current) animateShadow(shadowPulse.current, { x: [0, 7, 0], opacity: [1, 0.55, 1] }, { duration: 0.7 })
    } else if (shadowPulse.current) {
      animateShadow(shadowPulse.current, { scale: [1, 1.08, 1] }, { duration: 0.7 })
    }
  }, [territory, animated, animateLight, animateShadow, lightPulse, shadowPulse])

  const figureMotion = (x: number, sc: number, fx?: number, fs?: number) =>
    animated
      ? {
          initial: fx !== undefined ? { x: fx, y: BASE_Y, scale: fs } : false,
          animate: { x, y: BASE_Y, scale: sc },
          transition: { type: 'spring' as const, stiffness: 60, damping: 16, mass: 1.2 },
          style: { transformBox: 'view-box' as const, originX: '0px', originY: '0px' },
        }
      : { transform: `translate(${x} ${BASE_Y}) scale(${sc})` }

  const G = animated ? motion.g : 'g'
  const Rect = animated ? motion.rect : 'rect'
  const status = TERRITORY_STATUS[statusOf(territory)].label
  const level = SHADOW_LEVELS[levelOf(S)].label

  const wisp = ([x, y, r]: [number, number, number], i: number, front: boolean) => (
    <g key={`${front ? 'f' : 'b'}${i}`} transform={`translate(${x} ${y})`}>
      <path
        className={animated || density !== 'small' ? 'wisp' : undefined}
        d={tongue(r * (0.95 + 0.6 * menace))}
        fill={url(front ? 'wispf' : 'wisp')}
        style={
          {
            '--dx': `${seq(i, -16, 16, front ? 3 : 0)}px`,
            '--dy': `${-seq(i, 48, 82, 5)}px`,
            '--t': `${seq(i, 3.2, 5.6, 7)}s`,
            '--o': `${0.55 + 0.4 * menace}`,
            animationDelay: `${-seq(i, 0, 5, 11)}s`,
          } as CSSProperties
        }
      />
    </g>
  )

  return (
    <svg
      viewBox="0 0 200 200"
      className={`${animated ? 'shadow-anim ' : ''}${className ?? ''}`}
      role="img"
      aria-label={`${status}: dir gehören ${Math.round(territory * 100)} % · Schatten-Ich: ${level}`}
      overflow="visible"
    >
      <defs>
        <linearGradient id={id('sc')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d0712" />
          <stop offset="0.6" stopColor="#1c0b28" />
          <stop offset="1" stopColor="#35134d" />
        </linearGradient>
        <linearGradient id={id('lc')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lightTop} />
          <stop offset="1" stopColor={lightBottom} />
        </linearGradient>
        <radialGradient id={id('aura')}>
          <stop offset="0" stopColor="#3d0f5c" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#1f0830" stopOpacity="0.45" />
          <stop offset="1" stopColor="#1f0830" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('laura')}>
          <stop offset="0" stopColor={lightTop} stopOpacity="0.7" />
          <stop offset="1" stopColor={lightTop} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('wisp')} cx="0.5" cy="0.75" r="0.6">
          <stop offset="0" stopColor={dark ? '#2a1440' : '#07030b'} stopOpacity="0.95" />
          <stop offset="0.45" stopColor={dark ? '#4b2672' : '#24103a'} stopOpacity={dark ? 0.7 : 0.75} />
          <stop offset="0.8" stopColor={dark ? '#7f4bb3' : '#5a2d80'} stopOpacity="0.3" />
          <stop offset="1" stopColor="#7f4bb3" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('wispf')} cx="0.5" cy="0.75" r="0.6">
          <stop offset="0" stopColor={dark ? '#3a1d58' : '#12071c'} stopOpacity="0.85" />
          <stop offset="0.55" stopColor={dark ? '#6a3a99' : '#3b1a5c'} stopOpacity="0.45" />
          <stop offset="1" stopColor="#9a66cc" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('mist')} cy="0.6">
          <stop offset="0" stopColor="#1a0a28" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#2d1245" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2d1245" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('eye')}>
          <stop offset="0" stopColor="#ffd3c4" stopOpacity="1" />
          <stop offset="0.35" stopColor="#ff3b2f" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff3b2f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('face')} cx="0.55" cy="0.5">
          <stop offset="0" stopColor={lightDeep} stopOpacity="1" />
          <stop offset="1" stopColor={lightDeep} stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id={id('leye')}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.5" stopColor="#dff6ff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#dff6ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('steel')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9ced8" />
          <stop offset="0.5" stopColor="#6c727e" />
          <stop offset="1" stopColor="#2b2f36" />
        </linearGradient>
        <linearGradient id={id('blade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f7fa" />
          <stop offset="1" stopColor="#97a1ac" />
        </linearGradient>
        <radialGradient id={id('bronze')} cx="0.38" cy="0.32">
          <stop offset="0" stopColor="#ffe39a" />
          <stop offset="0.55" stopColor="#d9a441" />
          <stop offset="1" stopColor="#8a5a14" />
        </radialGradient>
        <clipPath id={id('cl')}>
          <Rect x={0} y={150} height={60} {...(animated ? { initial: from ? { width: from.bx } : false, animate: { width: L.bx }, transition: { type: 'spring', stiffness: 60, damping: 16 } } : { width: L.bx })} />
        </clipPath>
      </defs>

      {/* ── Boden: sein Land (dunkel) und deins (Licht) ── */}
      <ellipse cx={100} cy={BASE_Y + 3} rx={98} ry={14} fill={darkLand} />
      <ellipse cx={100} cy={BASE_Y + 3} rx={98} ry={14} fill={lightLand} clipPath={url('cl')} />
      <ellipse cx={100} cy={BASE_Y + 1} rx={92} ry={10} fill={lightLandEdge} opacity={0.5} clipPath={url('cl')} />
      <g opacity={0.25 + 0.75 * menace}>
        {CRACKS.map((d, i) => (
          <g key={i}>
            <path d={d} stroke="#9b3dff" strokeWidth={2.4} opacity={0.18} fill="none" strokeLinecap="round" />
            <path d={d} stroke="#c77dff" strokeWidth={0.7} fill="none" strokeLinecap="round" className={animated ? 'crack' : undefined} />
          </g>
        ))}
      </g>
      {/* Grenze */}
      <G {...(animated ? { initial: from ? { x: from.bx } : false, animate: { x: L.bx }, transition: { type: 'spring', stiffness: 60, damping: 16 } } : { transform: `translate(${L.bx} 0)` })}>
        <ellipse cx={0} cy={BASE_Y + 3} rx={2.6} ry={13} fill="#7b2cbf" opacity={0.35} />
        <ellipse cx={-1} cy={BASE_Y + 3} rx={1} ry={12} fill={lightTop} opacity={0.8} className={animated ? 'seam' : undefined} />
      </G>

      {/* ── Dein Licht-Ich ── */}
      <G {...figureMotion(L.youX, L.youS, from?.youX, from?.youS)}>
        <g ref={lightPulse} style={{ transformBox: 'fill-box', transformOrigin: '50% 60%' }}>
          <ellipse cx={0} cy={-60} rx={46} ry={66} fill={url('laura')} opacity={0.35 + 0.5 * (light / 100)} />
        </g>
        <g opacity={lightOpacity} transform="skewX(-3)">
          <g className={animated ? 'breathe' : undefined}>
            <path d={LIGHT_CLOAK} fill={url('lc')} />
            <path d={LIGHT_CLOAK} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1} />
            <path d={FOLDS} stroke="#fff" strokeOpacity={0.28} strokeWidth={1.2} fill="none" strokeLinecap="round" />
            <ellipse {...FACE} fill={url('face')} />
            <path d={HOOD_RIM} stroke="#fff" strokeOpacity={0.6} strokeWidth={1.4} fill="none" strokeLinecap="round" />
            {/* ruhige, warme Augen – dasselbe Gesicht wie sein Schatten */}
            <circle cx={1} cy={-101} r={2.6} fill={url('leye')} />
            <circle cx={8} cy={-101} r={2.6} fill={url('leye')} />
            <circle cx={1} cy={-101} r={0.9} fill="#fffef5" />
            <circle cx={8} cy={-101} r={0.9} fill="#fffef5" />
            {/* Xiphos, nach vorn auf ihn gerichtet */}
            <path d={SWORD_BLADE} fill={url('blade')} stroke="#6b7480" strokeWidth={0.5} />
            <path d={SWORD_EDGE} stroke="#fff" strokeOpacity={0.6} strokeWidth={0.5} />
            <path d="M10 -30L17 -30" stroke="#3a2414" strokeWidth={3} strokeLinecap="round" />
            <path d="M17.5 -36L17.5 -24" stroke="#b8862b" strokeWidth={2.6} strokeLinecap="round" />
            <circle cx={9} cy={-30} r={1.9} fill="#d9a441" />
            {/* Hoplon mit Lambda */}
            <circle {...SHIELD} fill={url('bronze')} />
            <circle {...SHIELD} fill="none" stroke="#7a5312" strokeWidth={2.4} />
            <circle cx={SHIELD.cx} cy={SHIELD.cy} r={SHIELD.r - 3.6} fill="none" stroke="#fff1c4" strokeOpacity={0.5} strokeWidth={0.8} />
            <path d={LAMBDA} stroke="#a4161a" strokeWidth={3.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={SHIELD_SHINE} stroke="#fff" strokeOpacity={0.5} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          </g>
        </g>
        {MOTES.slice(0, nMotes).map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle
              r={1.6}
              fill={lightTop}
              className="mote"
              style={{ '--dx': `${seq(i, -10, 10)}px`, '--t': `${seq(i, 3, 5)}s`, animationDelay: `${-seq(i, 0, 4, 3)}s` } as CSSProperties}
            />
          </g>
        ))}
      </G>

      {/* ── Dein Schatten-Ich ── */}
      <G {...figureMotion(L.shadowX, L.shadowS, from?.shadowX, from?.shadowS)}>
        <g ref={shadowPulse} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
          <ellipse cx={0} cy={-58} rx={58} ry={78} fill={url('aura')} opacity={0.25 + 0.65 * menace} />
          {WISPS_BACK.slice(0, Math.ceil(nWisps / 2)).map((w, i) => wisp(w, i, false))}
          {/* Ranken über den Boden in Richtung deines Lands */}
          {tendril > 0 && (
            <g opacity={tendril} className={animated ? 'tendril' : undefined}>
              {[0, 1, 2].map((k) => {
                const len = 30 + 40 * tendril + k * 8
                const y0 = -1 + k * 2.5
                return (
                  <path
                    key={k}
                    d={`M-26 ${y0}C${-26 - len * 0.35} ${y0 - 6 + k * 3} ${-26 - len * 0.7} ${y0 + 5} ${-26 - len} ${y0 + 1 - k}`}
                    stroke={k === 1 ? '#3d1159' : '#12081a'}
                    strokeWidth={3.2 - k * 0.6}
                    fill="none"
                    strokeLinecap="round"
                  />
                )
              })}
            </g>
          )}
          {/* Nebel am Boden, aus dem er aufsteigt */}
          <ellipse cx={0} cy={-2} rx={50 + 18 * menace} ry={12} fill={url('mist')} className={animated ? 'seam' : undefined} />
          {/* gespiegelt: blickt nach links, zu dir */}
          <g opacity={shadowOpacity} transform="scale(-1 1) skewX(-8)">
            <g className={animated ? 'breathe breathe-slow' : undefined}>
              <path d={SHADOW_CLOAK} fill={url('sc')} />
              <path d={SHADOW_CLOAK} fill="none" stroke="#9b4dff" strokeOpacity={0.35 + 0.3 * menace} strokeWidth={1} />
              <path d={FOLDS} stroke="#8e3fd1" strokeOpacity={0.28} strokeWidth={1.2} fill="none" strokeLinecap="round" />
              <ellipse {...FACE} fill="#000" />
              <path d={HOOD_RIM} stroke="#9b4dff" strokeOpacity={0.6} strokeWidth={1.3} fill="none" strokeLinecap="round" />
              {/* Augen */}
              <g className={animated ? 'shadow-eyes' : undefined} opacity={0.6 + 0.4 * menace}>
                <circle cx={1} cy={-101} r={4.5 + 3 * menace} fill={url('eye')} />
                <circle cx={8} cy={-101} r={4.5 + 3 * menace} fill={url('eye')} />
                <path d={EYE} transform="translate(1 -101)" fill="#ffe2d6" />
                <path d={EYE} transform="translate(8 -101)" fill="#ffe2d6" />
              </g>
              {/* Sense: Blut wird mit seiner Stärke mehr */}
              <path d={SCYTHE_STAFF} stroke="#1b120c" strokeWidth={3.4} fill="none" strokeLinecap="round" />
              <path d={SCYTHE_STAFF_HI} stroke="#6b4a32" strokeOpacity={0.55} strokeWidth={0.9} fill="none" strokeLinecap="round" />
              <path d={SCYTHE_GRIP} stroke="#1b120c" strokeWidth={2.6} strokeLinecap="round" />
              <ellipse cx={27} cy={-59.5} rx={4.2} ry={3.2} fill="#07030b" />
              <path d={SCYTHE_BLADE} fill={url('steel')} stroke="#1f2228" strokeWidth={0.8} />
              <path d={SCYTHE_EDGE} stroke="#eef2f7" strokeOpacity={0.75} strokeWidth={0.8} fill="none" strokeLinecap="round" className={animated ? 'blade-glint' : undefined} />
              <g opacity={0.45 + 0.55 * menace}>
                <path d={BLOOD_SMEAR} fill="#8d0b13" />
                <path d={BLOOD_SPOT} fill="#a3101b" />
              </g>
              {DRIPS.slice(0, 1 + Math.round(3 * menace)).map(([x, y], i) => (
                <g key={i} transform={`translate(${x} ${y})`}>
                  <path
                    d={DRIP}
                    fill="#a3101b"
                    className={animated ? 'blood-drip' : undefined}
                    style={{ animationDelay: `${-i * 0.9}s`, animationDuration: `${2.6 + i * 0.5}s` }}
                  />
                </g>
              ))}
              {claws > 0 && (
                <g opacity={claws}>
                  <path d={CLAWS} stroke="#07030b" strokeWidth={2.8} fill="none" strokeLinecap="round" />
                  <path d={CLAWS} stroke="#b06bff" strokeOpacity={0.55} strokeWidth={0.8} fill="none" strokeLinecap="round" />
                </g>
              )}
            </g>
          </g>
          {WISPS_FRONT.slice(0, Math.floor(nWisps / 2)).map((w, i) => wisp(w, i, true))}
          {EMBERS.slice(0, nEmbers).map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <circle
                r={seq(i, 0.8, 1.4)}
                fill={i % 2 ? '#ff5a3c' : '#c77dff'}
                className="ember"
                style={{ '--dx': `${seq(i, -12, 12, 2)}px`, '--t': `${seq(i, 2.2, 3.6, 4)}s`, animationDelay: `${-seq(i, 0, 3, 9)}s` } as CSSProperties}
              />
            </g>
          ))}
        </g>
      </G>
    </svg>
  )
})

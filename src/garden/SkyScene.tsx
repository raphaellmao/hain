/**
 * Himmel und Landschaft in Schichten, von hinten nach vorn:
 *   Himmel mit Sonne, Mond und Regenbogen → Sterne, Strahlen, Wolken →
 *   Berge, Hügel, Wald und See → was sich dort bewegt.
 *
 * Unbewegtes liegt in eigenen SVGs, die der Browser nur einmal zeichnen muss.
 * Bewegtes ist ein eigenes Element mit CSS-Animation auf transform/opacity. Das
 * läuft auf dem Grafikchip, statt bei jedem Bild die ganze Szene neu zu zeichnen.
 */
import type { CSSProperties } from 'react'
import type { Sky } from '../lib/sky'
import { mix, rnd, type ScenePalette } from './palette'

const LAYER = 'pointer-events-none absolute inset-x-0 top-0 h-[300px] w-full'
const VIEW = { viewBox: '0 0 400 300', preserveAspectRatio: 'xMidYMax slice' }

// ── Landschaftslinien ────────────────────────────────────────────────────────

const farHill = (x: number) => 204 + 9 * Math.sin(x * 0.021 + 1) + 5 * Math.sin(x * 0.055 + 2)
const midHill = (x: number) => 224 + 7 * Math.sin(x * 0.017 + 4) + 3.5 * Math.sin(x * 0.05)
const nearHill = (x: number) => 244 + 6 * Math.sin(x * 0.013 + 2.2) + 3 * Math.sin(x * 0.041 + 1)

const hillPath = (fn: (x: number) => number) => {
  let d = `M-4 300L-4 ${fn(-4).toFixed(1)}`
  for (let x = 4; x <= 408; x += 8) d += `L${x} ${fn(x).toFixed(1)}`
  return `${d}L408 300Z`
}

const PEAKS: [number, number][] = [[-10, 190], [26, 158], [52, 176], [98, 122], [132, 168], [170, 140], [206, 174], [262, 106], [306, 164], [344, 134], [384, 170], [414, 150]]
const mountainPath = `M-10 300${PEAKS.map(([x, y]) => `L${x} ${y}`).join('')}L414 300Z`
/** Schneekappen der höchsten Gipfel */
const CAPS: [number, number, number][] = [[98, 122, 15], [262, 106, 19], [170, 140, 9], [344, 134, 10]]
const capPath = CAPS.map(([x, y, s]) => `M${x} ${y}L${x + s} ${y + s * 1.05}L${x + s * 0.45} ${y + s * 0.8}L${x + s * 0.1} ${y + s * 1.15}L${x - s * 0.35} ${y + s * 0.8}L${x - s} ${y + s * 1.05}Z`).join('')

/** Ein Wald als einzige Fläche: viele kleine Tannen auf der Hügellinie */
const forestPath = (fn: (x: number) => number, salt: number) => {
  let d = ''
  for (let i = 0; i < 44; i++) {
    const x = rnd(i, salt) * 410 - 5
    // Lücken lassen, sonst wird es eine Wand
    if (Math.sin(x * 0.03 + salt) < -0.35) continue
    const h = 7 + rnd(i, salt + 1) * 9
    const y = fn(x) + 2
    d += `M${x.toFixed(1)} ${(y - h).toFixed(1)}L${(x + h * 0.36).toFixed(1)} ${y.toFixed(1)}L${(x - h * 0.36).toFixed(1)} ${y.toFixed(1)}Z`
  }
  return d
}
const FOREST_FAR = forestPath(farHill, 21)
const FOREST_MID = forestPath(midHill, 33)

// ── Himmel ───────────────────────────────────────────────────────────────────

/** Mond in seiner echten Phase: 0 = Neumond, 0,5 = Vollmond */
function Moon({ phase }: { phase: number }) {
  const r = 14
  const waxing = phase < 0.5
  const c = Math.cos(phase * 2 * Math.PI)
  const inner = Math.abs(c) * r
  // Lichtgrenze: im ersten und letzten Viertel wölbt sie sich zur hellen Seite hin
  const sweep = c > 0 ? 0 : 1
  const lit = `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${inner.toFixed(2)} ${r} 0 0 ${sweep} 0 ${-r}Z`
  return (
    <>
      <circle r="52" fill="url(#moon-glow)" opacity={0.35 + Math.sin(phase * Math.PI) * 0.65} />
      <circle r={r} fill="#8d94ad" opacity="0.14" />
      <clipPath id="moon-lit">
        <path d={lit} transform={waxing ? undefined : 'scale(-1 1)'} />
      </clipPath>
      <g clipPath="url(#moon-lit)">
        <circle r={r} fill="#f4f1e4" />
        <circle cx="-5" cy="3" r="3" fill="#d7d2bf" />
        <circle cx="5" cy="-5" r="2.2" fill="#dcd7c5" />
        <circle cx="-2" cy="-7" r="1.5" fill="#d7d2bf" />
        <circle cx="6" cy="6" r="1.8" fill="#dcd7c5" />
      </g>
    </>
  )
}

function SkyBack({ sky, p }: { sky: Sky; p: ScenePalette }) {
  const { phase } = sky
  const sunX = 30 + 340 * sky.sun
  const sunY = 240 - Math.sin(Math.PI * sky.sun) * 190
  const moonX = 40 + 320 * sky.moon
  const moonY = 212 - Math.sin(Math.PI * sky.moon) * 150
  const warm = phase === 'morgen' || phase === 'abend'
  const clearing = sky.weather === 'regen' && phase === 'tag'

  return (
    <svg {...VIEW} className={LAYER} aria-hidden>
      <defs>
        <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
          {p.sky.map((c, i) => (
            <stop key={i} offset={[0, 0.28, 0.5, 0.68, 0.84][i]} stopColor={c} />
          ))}
        </linearGradient>
        <radialGradient id="sun-glow">
          <stop offset="0" stopColor={warm ? '#fff0c4' : '#fffdf0'} stopOpacity="1" />
          <stop offset="0.14" stopColor={warm ? '#ffd28f' : '#fff7cf'} stopOpacity="0.72" />
          <stop offset="0.42" stopColor={warm ? '#ff9a5c' : '#fff3c0'} stopOpacity="0.24" />
          <stop offset="1" stopColor={warm ? '#ff7a45' : '#fff3c0'} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moon-glow">
          <stop offset="0" stopColor="#dfe8ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#dfe8ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="milky">
          <stop offset="0" stopColor="#c9d5ff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#c9d5ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="272" fill="url(#g-sky)" />

      {phase === 'nacht' && (
        <g transform="rotate(-24 200 90)">
          <ellipse cx="200" cy="90" rx="290" ry="42" fill="url(#milky)" />
          <ellipse cx="150" cy="86" rx="120" ry="20" fill="url(#milky)" />
        </g>
      )}

      {phase !== 'nacht' && sky.weather !== 'regen' && (
        <g transform={`translate(${sunX} ${sunY})`}>
          <circle r="118" fill="url(#sun-glow)" />
          <circle r="15" fill={warm ? '#fff0c4' : '#fffdf0'} />
        </g>
      )}

      {phase === 'nacht' && (
        <g transform={`translate(${moonX} ${moonY})`}>
          <Moon phase={sky.moonPhase} />
        </g>
      )}

      {clearing && (
        <g fill="none" strokeWidth="5" opacity="0.5" transform="translate(238 232)">
          {['#ff5a5a', '#ffa94d', '#ffe14d', '#63d471', '#5aa9ff', '#a678f0'].map((c, i) => (
            <path key={c} d={`M${-(150 - i * 5)} 0A${150 - i * 5} ${150 - i * 5} 0 0 1 ${150 - i * 5} 0`} stroke={c} />
          ))}
        </g>
      )}
    </svg>
  )
}

/** Drei Sternenfelder, die ganz flackern, statt jeden Stern einzeln zu animieren */
function Stars({ sky }: { sky: Sky }) {
  const { phase } = sky
  const visible = phase === 'nacht' ? 1 : phase === 'morgen' || phase === 'abend' ? 0.3 : 0
  if (visible === 0 || sky.weather === 'regen') return null
  const maxY = phase === 'nacht' ? 200 : 100
  return (
    <div style={{ opacity: visible }} aria-hidden>
      {[0, 1, 2].map((layer) => (
        <svg
          key={layer}
          {...VIEW}
          className={`${LAYER} star-layer`}
          style={{ animationDelay: `${-layer * 1.7}s`, animationDuration: `${3.6 + layer * 1.3}s` }}
        >
          {Array.from({ length: 26 }, (_, i) => (
            <circle key={i} cx={rnd(i, layer + 1) * 400} cy={rnd(i, layer + 11) * maxY} r={0.5 + rnd(i, layer + 21) * rnd(i, layer + 31) * 1.5} fill="#fff" />
          ))}
        </svg>
      ))}
      {phase === 'nacht' && <span className="shooting-star" />}
    </div>
  )
}

/** Sonnenstrahlen: dreht sich sehr langsam */
function Rays({ sky, p }: { sky: Sky; p: ScenePalette }) {
  if (p.phase === 'nacht' || sky.weather === 'regen') return null
  const warm = p.phase !== 'tag'
  const color = warm ? '255,190,130' : '255,250,220'
  const stops = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * 360
    const w = 5 + rnd(i, 51) * 9
    return `rgba(${color},0) ${a}deg, rgba(${color},${warm ? 0.3 : 0.2}) ${a + w / 2}deg, rgba(${color},0) ${a + w}deg`
  }).join(', ')
  const style: CSSProperties = {
    left: `${((30 + 340 * sky.sun) / 400) * 100}%`,
    top: 240 - Math.sin(Math.PI * sky.sun) * 190,
    background: `conic-gradient(${stops})`,
    maskImage: 'radial-gradient(closest-side, #000 18%, transparent 100%)',
    WebkitMaskImage: 'radial-gradient(closest-side, #000 18%, transparent 100%)',
  }
  return <span className="sun-rays pointer-events-none absolute size-[520px]" style={style} aria-hidden />
}

function CloudShape({ i, p }: { i: number; p: ScenePalette }) {
  const id = `g-cloud-${i}`
  const puffs = 4 + Math.floor(rnd(i, 61) * 3)
  return (
    <svg viewBox="0 0 120 54" className="block size-full" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.15" stopColor={p.cloud[0]} />
          <stop offset="1" stopColor={p.cloud[1]} />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`}>
        <rect x="14" y="30" width="92" height="20" rx="10" />
        {Array.from({ length: puffs }, (_, k) => {
          const x = 24 + (k / (puffs - 1)) * 72
          const lift = Math.sin(((k + 0.5) / puffs) * Math.PI)
          const r = 9 + lift * 11 + rnd(k, i + 62) * 4
          return <circle key={k} cx={x} cy={38 - lift * 12} r={r} />
        })}
      </g>
    </svg>
  )
}

function Clouds({ sky, p }: { sky: Sky; p: ScenePalette }) {
  const count = sky.weather === 'klar' ? 3 : sky.weather === 'wolkig' ? 6 : 8
  return (
    <div style={{ opacity: p.cloudOpacity }} aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        // weiter hinten: kleiner, höher, langsamer
        const depth = rnd(i, 71)
        const width = 74 + depth * 96
        return (
          <span
            key={i}
            className="cloud pointer-events-none absolute left-0 block"
            style={{
              top: 24 + (1 - depth) * 12 + rnd(i, 72) * 118,
              width,
              height: width * 0.45,
              animationDuration: `${150 - depth * 80}s`,
              animationDelay: `${-rnd(i, 73) * 150}s`,
            }}
          >
            <CloudShape i={i} p={p} />
          </span>
        )
      })}
    </div>
  )
}

// ── Landschaft ───────────────────────────────────────────────────────────────

function Landscape({ p }: { p: ScenePalette }) {
  const snow = mix('#ffffff', p.mountain[1], p.phase === 'nacht' ? 0.55 : 0.08)
  const water = [mix(p.sky[2], p.far, 0.15), mix(p.sky[4], p.near, 0.2)]
  return (
    <svg {...VIEW} className={LAYER} aria-hidden>
      <defs>
        <linearGradient id="g-mountain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.3" stopColor={p.mountain[0]} />
          <stop offset="0.72" stopColor={p.mountain[1]} />
        </linearGradient>
        <linearGradient id="g-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.65" stopColor={p.far} />
          <stop offset="0.86" stopColor={mix(p.far, p.near, 0.6)} />
        </linearGradient>
        <linearGradient id="g-near" gradientUnits="userSpaceOnUse" x1="0" y1="238" x2="0" y2="268">
          <stop offset="0.2" stopColor={p.near} />
          <stop offset="1" stopColor={p.meadow[0]} />
        </linearGradient>
        <linearGradient id="g-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={water[1]} />
          <stop offset="1" stopColor={water[0]} />
        </linearGradient>
        {/* Unten blendet die Landschaft in die Wiese über: keine Kante, wo sie aufhört */}
        <linearGradient id="g-fade" gradientUnits="userSpaceOnUse" x1="0" y1="262" x2="0" y2="300">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="m-fade" maskUnits="userSpaceOnUse" x="-20" y="0" width="440" height="300">
          <rect x="-20" width="440" height="300" fill="url(#g-fade)" />
        </mask>
      </defs>

      <g mask="url(#m-fade)">
        <path d={mountainPath} fill="url(#g-mountain)" />
        <path d={capPath} fill={snow} opacity="0.92" />

        <path d={hillPath(farHill)} fill="url(#g-far)" />
        <path d={FOREST_FAR} fill={mix(p.forest, p.far, 0.45)} />
        <path d={hillPath(midHill)} fill={mix(p.far, p.near, 0.55)} />

        {/* See: spiegelt den Himmel, das vordere Ufer verdeckt die Hügellinie */}
        <path d="M214 240C240 229 290 226 330 227C360 228 390 226 408 229V262H214Z" fill="url(#g-lake)" />

        <path d={FOREST_MID} fill={p.forest} />
        <path d={hillPath(nearHill)} fill="url(#g-near)" />
      </g>
    </svg>
  )
}

/** Was sich in der Landschaft regt: Glitzern auf dem See, Enten, grasendes Reh */
function LandscapeLife({ sky, p }: { sky: Sky; p: ScenePalette }) {
  const { phase, season } = sky
  const glint = phase === 'nacht' ? '#c9d8ff' : phase === 'tag' ? '#ffffff' : '#ffd9a8'
  const ducks = phase === 'tag' && (season === 'fruehling' || season === 'sommer') && sky.weather !== 'regen'
  const deer = (phase === 'morgen' || phase === 'abend') && season !== 'winter'
  // in der Lücke zwischen den ersten Pflanzen, sonst stünde es meist dahinter
  const deerX = 136
  const body = p.lit('#7a5636')
  return (
    <svg {...VIEW} className={LAYER} aria-hidden>
      <g fill={glint}>
        {Array.from({ length: 7 }, (_, i) => (
          <rect
            key={i}
            className="glint"
            x={252 + rnd(i, 81) * 130}
            y={230 + rnd(i, 82) * 8}
            width={5 + rnd(i, 83) * 10}
            height="0.9"
            rx="0.45"
            style={{ animationDelay: `${-rnd(i, 84) * 5}s`, animationDuration: `${2.8 + rnd(i, 85) * 3}s` }}
          />
        ))}
      </g>

      {ducks && (
        <g className="duck-drift">
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${296 + i * 15} ${233.5 + i * 1.2}) scale(${0.95 - i * 0.12})`}>
              <path d="M-3.6 0Q0 2.6 3.8 0L2.8 -1.8Q0 -2.8 -2.8 -1.8Z" fill={i ? '#8d7a5c' : '#f3f1e8'} />
              <circle cx="3" cy="-3" r="1.35" fill={i ? '#6e5b43' : '#2f6b45'} />
              <path d="M4.1 -3.1L5.8 -2.7L4.1 -2.4Z" fill="#e8a13a" />
            </g>
          ))}
        </g>
      )}

      {deer && (
        <g transform={`translate(${deerX} ${farHill(deerX) + 1.5}) scale(0.82)`} fill={body}>
          <path d="M-7 -8C-4 -10 3 -10 6 -8L6 -5C2 -4 -3 -4 -7 -5Z" />
          <path d="M-6.4 -6L-6.9 0H-6L-5 -5.4ZM-4 -5.6L-3.8 0H-3L-2.8 -5.2ZM3 -5.4L3.2 0H4L4.2 -5.6ZM5 -6L5.8 0H6.6L6 -6.6Z" />
          <g className="deer-head">
            <path d="M5 -9L8.5 -14L10.5 -13.6L10.8 -12.4L8.4 -11.6L6.6 -7.4Z" />
            <path d="M9 -14L8.2 -17M9 -14.5L10.6 -17M8.6 -15.4L7.2 -16.2" stroke={body} strokeWidth="0.6" strokeLinecap="round" fill="none" />
          </g>
        </g>
      )}
    </svg>
  )
}

/** Vögel, Fledermäuse und Nebel: bewegte Einzelteile über der Landschaft */
function AirLife({ sky, p }: { sky: Sky; p: ScenePalette }) {
  const { phase, season, weather } = sky
  const dry = weather !== 'regen'
  const birdColor = phase === 'tag' ? '#27384a' : mix('#1a1a2c', p.sky[1], 0.2)
  return (
    <>
      {phase !== 'nacht' && dry && (
        <>
          <Flock delay={-6} top={52} duration={38} color={birdColor} scale={1} />
          {season !== 'winter' && <Flock delay={-27} top={92} duration={52} color={birdColor} scale={0.72} />}
        </>
      )}
      {(phase === 'abend' || phase === 'nacht') && season !== 'winter' && dry &&
        [0, 1].map((i) => (
          <span key={i} className="bat pointer-events-none absolute left-0" style={{ top: 42 + i * 46, animationDelay: `${-i * 11 - 3}s`, animationDuration: `${17 + i * 6}s` }} aria-hidden>
            <svg viewBox="0 0 20 10" className="wing-bat block h-[9px] w-[18px]" style={{ animationDelay: `${-i * 0.07}s` }}>
              <path d="M10 3.4L8.8 1.4L8.2 3C6 1.6 3 1.6 0 3.6C2 3.8 2.6 5 3 6C4 5 5 5 6 6C6.6 5.2 7.8 5 8.4 6.4L10 8.4L11.6 6.4C12.2 5 13.4 5.2 14 6C15 5 16 5 17 6C17.4 5 18 3.8 20 3.6C17 1.6 14 1.6 11.8 3L11.2 1.4Z" fill={phase === 'nacht' ? '#0b0f1e' : '#1f1a2e'} />
            </svg>
          </span>
        ))}
      {(phase === 'morgen' || weather === 'wolkig') && (
        <>
          <span className="mist-band" style={{ top: 208, opacity: 0.55 }} aria-hidden />
          <span className="mist-band" style={{ top: 232, opacity: 0.4, animationDelay: '-9s', animationDuration: '26s' }} aria-hidden />
        </>
      )}
    </>
  )
}

function Flock({ delay, top, duration, color, scale }: { delay: number; top: number; duration: number; color: string; scale: number }) {
  const birds: [number, number][] = [[0, 0], [-11, 5], [-11, -5], [-21, 10], [-21, -9]]
  return (
    <span className="flock pointer-events-none absolute left-0" style={{ top, animationDelay: `${delay}s`, animationDuration: `${duration}s`, scale: String(scale) }} aria-hidden>
      {birds.map(([x, y], i) => (
        <svg key={i} viewBox="0 0 14 6" className="absolute block h-[5px] w-[12px]" style={{ left: x, top: y }}>
          <path className="wing" d="M1 4.5Q4 0.4 7 4Q10 0.4 13 4.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none" style={{ animationDelay: `${-i * 0.13}s` }} />
        </svg>
      ))}
    </span>
  )
}

/** Perfekter Tag: ein Regenbogen hinter den Hügeln */
function Rainbow() {
  const colors = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#748ffc', '#b197fc']
  return (
    <svg className={`${LAYER} rainbow-in`} {...VIEW} aria-hidden data-rainbow>
      <g fill="none" strokeWidth="4.2" opacity="0.34">
        {colors.map((c, i) => {
          const r = 172 - i * 4
          return <path key={c} d={`M${200 - r} 262A${r} ${r} 0 0 1 ${200 + r} 262`} stroke={c} />
        })}
      </g>
    </svg>
  )
}

export function SkyScene({ sky, p, perfect = false }: { sky: Sky; p: ScenePalette; perfect?: boolean }) {
  return (
    <>
      <SkyBack sky={sky} p={p} />
      {/* endet hinter der Landschaft, sonst schiene es unten durch die Überblendung */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[258px] overflow-hidden" aria-hidden>
        <Stars sky={sky} />
        <Rays sky={sky} p={p} />
        {perfect && sky.phase !== 'nacht' && <Rainbow />}
        <Clouds sky={sky} p={p} />
      </div>
      <Landscape p={p} />
      <LandscapeLife sky={sky} p={p} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] overflow-hidden" aria-hidden>
        <AirLife sky={sky} p={p} />
      </div>
    </>
  )
}

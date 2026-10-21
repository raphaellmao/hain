/**
 * Lebendiger Garten: Himmel, Licht und Wetter folgen der echten Tageszeit
 * und Jahreszeit (lib/sky.ts).
 *
 *   Morgen  – Morgenrot, Nebel über den Hügeln, letzte Sterne
 *   Tag     – blauer Himmel, Sonne im Bogen, ziehende Wolken, Vögel
 *   Abend   – Abendrot, tief stehende Sonne
 *   Nacht   – Sterne funkeln, Mondsichel, Glühwürmchen über der Wiese
 *
 * Dazu je Jahreszeit: Blütenblätter (Frühling), Schmetterlinge (Sommer),
 * fallende Blätter (Herbst), Schnee (Winter). Alles reine CSS-Animationen
 * auf transform/opacity – läuft auf dem Grafikchip, auch auf älteren Handys.
 */
import type { CSSProperties, ReactNode } from 'react'
import { type Phase, type Season, type Sky } from '../lib/sky'
import { useDarkMode } from '../lib/useDarkMode'

interface Palette {
  top: string
  mid: string
  horizon: string
  far: string
  near: string
  meadow: [string, string]
  text: string
  cloud: string
  cloudOpacity: number
}

const PALETTES: Record<Phase, Palette> = {
  morgen: { top: '#47508f', mid: '#c77e9e', horizon: '#ffc79a', far: '#8d7f9c', near: '#7f9a78', meadow: ['#8bb075', '#6b9460'], text: '#ffffff', cloud: '#ffdbe2', cloudOpacity: 0.75 },
  tag: { top: '#4ea3e3', mid: '#8ccbf0', horizon: '#dff2fb', far: '#a6c99c', near: '#86bc72', meadow: ['#9acb7c', '#77ad5f'], text: '#12301d', cloud: '#ffffff', cloudOpacity: 0.95 },
  abend: { top: '#352f6c', mid: '#c95f70', horizon: '#ffab68', far: '#7b5b78', near: '#6c6c55', meadow: ['#7d8c5a', '#5d6d44'], text: '#ffffff', cloud: '#ffc6a3', cloudOpacity: 0.7 },
  nacht: { top: '#060a1b', mid: '#111a38', horizon: '#26345e', far: '#18223a', near: '#13201a', meadow: ['#1a2b22', '#0f1813'], text: '#e9eef8', cloud: '#3c4870', cloudOpacity: 0.35 },
}

/** Farbe abdunkeln (für den Dunkelmodus der App) */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.round(v * f).toString(16).padStart(2, '0')
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`
}

/** feste Pseudo-Zufallszahl 0 … 1 für Partikel i (stabil zwischen Renderings) */
const rnd = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function GardenScene({ sky, children }: { sky: Sky; children: ReactNode }) {
  const dark = useDarkMode()
  const base = PALETTES[sky.phase]
  // Im Dunkelmodus Wiese und Taghimmel etwas gedämpfter, damit es zur App passt
  const f = dark && sky.phase !== 'nacht' ? 0.78 : 1
  const pal = { ...base, meadow: [shade(base.meadow[0], f), shade(base.meadow[1], f)] as [string, string], near: shade(base.near, f), far: shade(base.far, f) }

  return (
    <div
      className="garden-scene relative min-h-dvh overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${pal.horizon} 0px, ${pal.meadow[0]} 250px, ${pal.meadow[1]} 100%)`, color: pal.text }}
      data-phase={sky.phase}
      data-season={sky.season}
    >
      <SkySvg sky={sky} pal={pal} />
      {sky.phase === 'nacht' && <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_40%,transparent_40%,rgba(3,6,20,0.45))]" />}
      <div className="relative z-[2]">{children}</div>
      <Particles season={sky.season} phase={sky.phase} />
    </div>
  )
}

// ── Himmel ───────────────────────────────────────────────────────────────────

function SkySvg({ sky, pal }: { sky: Sky; pal: Palette }) {
  const { phase } = sky
  const HORIZON = 232
  const sunX = 30 + 340 * sky.sun
  const sunY = HORIZON + 8 - Math.sin(Math.PI * sky.sun) * 180
  const moonX = 40 + 320 * sky.moon
  const moonY = HORIZON - 20 - Math.sin(Math.PI * sky.moon) * 150
  const starOpacity = phase === 'nacht' ? 1 : phase === 'morgen' || phase === 'abend' ? 0.35 : 0
  const warm = phase === 'morgen' || phase === 'abend'

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMax slice"
      className="pointer-events-none absolute inset-x-0 top-0 h-[300px] w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.top} />
          <stop offset="0.55" stopColor={pal.mid} />
          <stop offset="0.82" stopColor={pal.horizon} />
        </linearGradient>
        <radialGradient id="sun-glow">
          <stop offset="0" stopColor={warm ? '#ffd9a0' : '#fffbe6'} stopOpacity="0.95" />
          <stop offset="0.25" stopColor={warm ? '#ffb070' : '#fff3c0'} stopOpacity="0.55" />
          <stop offset="1" stopColor={warm ? '#ff8a50' : '#fff3c0'} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moon-glow">
          <stop offset="0" stopColor="#dfe8ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#dfe8ff" stopOpacity="0" />
        </radialGradient>
        <mask id="moon-cut">
          <rect x="-30" y="-30" width="60" height="60" fill="#fff" />
          <circle cx="7" cy="-4" r="13" fill="#000" />
        </mask>
        <linearGradient id="cloud-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.cloud} stopOpacity="1" />
          <stop offset="1" stopColor={pal.cloud} stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="mist-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="400" height="300" fill="url(#sky-g)" />

      {/* Sterne */}
      {starOpacity > 0 && (
        <g opacity={starOpacity}>
          {Array.from({ length: 48 }, (_, i) => {
            const x = rnd(i, 1) * 400
            const y = rnd(i, 2) * (phase === 'nacht' ? 190 : 110)
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={0.5 + rnd(i, 3) * 1.1}
                fill="#fff"
                className="star"
                style={{ animationDelay: `${-rnd(i, 4) * 4}s`, animationDuration: `${2.5 + rnd(i, 5) * 3}s` }}
              />
            )
          })}
        </g>
      )}

      {/* Sonne */}
      {phase !== 'nacht' && (
        <g transform={`translate(${sunX} ${sunY})`}>
          <circle r="70" fill="url(#sun-glow)" className="sun-glow" />
          <circle r="15" fill={warm ? '#ffe2a8' : '#fffbea'} />
        </g>
      )}

      {/* Mond */}
      {phase === 'nacht' && (
        <g transform={`translate(${moonX} ${moonY})`}>
          <circle r="42" fill="url(#moon-glow)" />
          <g mask="url(#moon-cut)">
            <circle r="13" fill="#f3f0e2" />
            <circle cx="-4" cy="3" r="2.2" fill="#d8d3c0" />
            <circle cx="-7" cy="-5" r="1.3" fill="#d8d3c0" />
          </g>
        </g>
      )}

      {/* Wolken */}
      <g opacity={pal.cloudOpacity}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i} className="cloud" style={{ animationDuration: `${90 + i * 35}s`, animationDelay: `${-(i * 47 + 13)}s` }}>
            <g transform={`translate(0 ${30 + i * 34}) scale(${0.7 + rnd(i, 7) * 0.6})`}>
              <ellipse cx="0" cy="12" rx="38" ry="11" fill="url(#cloud-g)" />
              <ellipse cx="-14" cy="5" rx="16" ry="12" fill="url(#cloud-g)" />
              <ellipse cx="9" cy="0" rx="20" ry="16" fill="url(#cloud-g)" />
              <ellipse cx="26" cy="8" rx="13" ry="9" fill="url(#cloud-g)" />
            </g>
          </g>
        ))}
      </g>

      {/* Vögel am Tag */}
      {phase === 'tag' && (
        <g fill="none" stroke="#2c3e50" strokeWidth="1.4" strokeLinecap="round" opacity="0.55">
          {[0, 1, 2].map((i) => (
            <g key={i} className="bird" style={{ animationDelay: `${-i * 9 - 4}s`, animationDuration: `${26 + i * 5}s` }}>
              <g transform={`translate(0 ${60 + i * 18})`}>
                <path className="wing" d="M-6 0Q-3 -4 0 0Q3 -4 6 0" style={{ animationDelay: `${-i * 0.2}s` }} />
              </g>
            </g>
          ))}
        </g>
      )}

      {/* Hügel: hinten mit kleinen Baumsilhouetten, vorn in die Wiese übergehend */}
      <path d={`M0 ${HORIZON - 14}C60 ${HORIZON - 40} 110 ${HORIZON - 8} 170 ${HORIZON - 22}C240 ${HORIZON - 40} 300 ${HORIZON - 6} 400 ${HORIZON - 30}V300H0Z`} fill={pal.far} />
      <g fill={shade(pal.far, 0.82)}>
        {[34, 58, 120, 196, 226, 288, 330, 372].map((x, i) => {
          const y = HORIZON - 22 - Math.sin((x / 400) * Math.PI * 2.2) * 9
          const s = 0.7 + rnd(i, 9) * 0.6
          return (
            <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
              <rect x="-0.8" y="-4" width="1.6" height="6" />
              <ellipse cx="0" cy="-8" rx="4.5" ry="6" />
            </g>
          )
        })}
      </g>
      {phase === 'morgen' && <rect x="-200" y={HORIZON - 34} width="800" height="22" fill="url(#mist-g)" className="mist" />}
      <path d={`M0 ${HORIZON + 8}C80 ${HORIZON - 14} 150 ${HORIZON + 14} 230 ${HORIZON}C300 ${HORIZON - 12} 350 ${HORIZON + 4} 400 ${HORIZON - 4}V300H0Z`} fill={pal.near} />
      <rect y="262" width="400" height="38" fill={pal.meadow[0]} />
      <path d={`M0 266C100 ${HORIZON + 22} 260 ${HORIZON + 34} 400 ${HORIZON + 20}V300H0Z`} fill={pal.meadow[0]} />
    </svg>
  )
}

// ── Wetter & Leben ───────────────────────────────────────────────────────────

const LEAF_COLORS = ['#d9822b', '#c4531f', '#e2a531', '#a5592a', '#c9772f']
const PETAL_COLORS = ['#f7c6d9', '#f3a9c4', '#fde3ec']

function Particles({ season, phase }: { season: Season; phase: Phase }) {
  const night = phase === 'nacht'
  const parts: ReactNode[] = []

  if (season === 'herbst' || season === 'fruehling') {
    const n = night ? 6 : 12
    for (let i = 0; i < n; i++) {
      const colors = season === 'herbst' ? LEAF_COLORS : PETAL_COLORS
      parts.push(
        <span
          key={`l${i}`}
          className={season === 'herbst' ? 'fall-leaf' : 'fall-leaf fall-petal'}
          style={
            {
              left: `${rnd(i, 11) * 100}%`,
              background: colors[i % colors.length],
              '--dx': `${(rnd(i, 12) - 0.5) * 160}px`,
              animationDuration: `${9 + rnd(i, 13) * 8}s`,
              animationDelay: `${-rnd(i, 14) * 16}s`,
              width: `${8 + rnd(i, 15) * 6}px`,
              height: `${6 + rnd(i, 16) * 4}px`,
            } as CSSProperties
          }
        />,
      )
    }
  }

  if (season === 'winter') {
    for (let i = 0; i < 34; i++) {
      const s = 2 + rnd(i, 21) * 4
      parts.push(
        <span
          key={`s${i}`}
          className="snow"
          style={
            {
              left: `${rnd(i, 22) * 100}%`,
              width: s,
              height: s,
              '--dx': `${(rnd(i, 23) - 0.5) * 60}px`,
              animationDuration: `${8 + rnd(i, 24) * 9}s`,
              animationDelay: `${-rnd(i, 25) * 17}s`,
              opacity: 0.6 + rnd(i, 26) * 0.4,
            } as CSSProperties
          }
        />,
      )
    }
  }

  if (night && season !== 'winter') {
    for (let i = 0; i < 14; i++) {
      parts.push(
        <span
          key={`f${i}`}
          className="firefly"
          style={
            {
              left: `${rnd(i, 31) * 96}%`,
              top: `${35 + rnd(i, 32) * 55}%`,
              '--fx': `${(rnd(i, 33) - 0.5) * 50}px`,
              '--fy': `${(rnd(i, 34) - 0.5) * 40}px`,
              animationDuration: `${5 + rnd(i, 35) * 5}s, ${1.6 + rnd(i, 36) * 2.4}s`,
              animationDelay: `${-rnd(i, 37) * 8}s, ${-rnd(i, 38) * 3}s`,
            } as CSSProperties
          }
        />,
      )
    }
  }

  if (season === 'sommer' && phase === 'tag') {
    for (let i = 0; i < 4; i++) {
      parts.push(
        <span
          key={`b${i}`}
          className="butterfly"
          style={
            {
              top: `${40 + rnd(i, 41) * 40}%`,
              animationDuration: `${18 + rnd(i, 42) * 10}s`,
              animationDelay: `${-rnd(i, 43) * 20}s`,
              '--c': ['#f2a541', '#ea7fae', '#5a9aef', '#e2bd3a'][i],
            } as CSSProperties
          }
        >
          <i />
          <i />
        </span>,
      )
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[3] overflow-hidden" aria-hidden>
      {parts}
    </div>
  )
}

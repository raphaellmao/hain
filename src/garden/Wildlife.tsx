/**
 * Was durch den Garten zieht: Wetter, Insekten und kleine Tiere. Alles läuft von
 * selbst, nichts davon will angetippt werden. Die Tiere haben lange Pausen zwischen
 * ihren Auftritten – man entdeckt sie, statt ständig von ihnen umgeben zu sein.
 */
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Sky } from '../lib/sky'
import { mix, rnd, type ScenePalette } from './palette'
import { tuft } from './meadow'

const LEAF_COLORS = ['#d9822b', '#c4531f', '#e2a531', '#a5592a', '#c9772f']
const PETAL_COLORS = ['#f7c6d9', '#f3a9c4', '#fde3ec']

type Vars = CSSProperties & Record<`--${string}`, string>

function Weather({ sky }: { sky: Sky }) {
  const { season, phase, weather } = sky
  const night = phase === 'nacht'
  const parts: ReactNode[] = []

  if ((season === 'herbst' || season === 'fruehling') && weather !== 'regen') {
    const n = night ? 6 : 11
    const colors = season === 'herbst' ? LEAF_COLORS : PETAL_COLORS
    for (let i = 0; i < n; i++) {
      parts.push(
        <span
          key={`l${i}`}
          className={season === 'herbst' ? 'fall-leaf' : 'fall-leaf fall-petal'}
          style={
            {
              left: `${rnd(i, 11) * 100}%`,
              background: colors[i % colors.length],
              '--dx': `${(rnd(i, 12) - 0.5) * 170}px`,
              animationDuration: `${10 + rnd(i, 13) * 9}s`,
              animationDelay: `${-rnd(i, 14) * 18}s`,
              width: `${8 + rnd(i, 15) * 6}px`,
              height: `${6 + rnd(i, 16) * 4}px`,
            } as Vars
          }
        />,
      )
    }
  }

  // Schnee fällt nicht jeden Wintertag: Der Boden bleibt weiß, der Himmel wechselt
  if (season === 'winter' && weather !== 'klar') {
    for (let i = 0; i < 30; i++) {
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
            } as Vars
          }
        />,
      )
    }
  }

  if (weather === 'regen' && season !== 'winter') {
    for (let i = 0; i < 26; i++) {
      parts.push(
        <span
          key={`r${i}`}
          className="rain"
          style={{ left: `${rnd(i, 91) * 104 - 2}%`, height: 12 + rnd(i, 92) * 12, animationDuration: `${0.75 + rnd(i, 93) * 0.5}s`, animationDelay: `${-rnd(i, 94) * 2}s` }}
        />,
      )
    }
  }

  // Lichtstaub im Sonnenlicht
  if (!night && weather === 'klar' && season !== 'winter') {
    for (let i = 0; i < 9; i++) {
      parts.push(
        <span
          key={`m${i}`}
          className="dust"
          style={
            {
              left: `${rnd(i, 101) * 96}%`,
              top: `${30 + rnd(i, 102) * 56}%`,
              '--fx': `${(rnd(i, 103) - 0.5) * 60}px`,
              '--fy': `${-20 - rnd(i, 104) * 40}px`,
              animationDuration: `${9 + rnd(i, 105) * 9}s`,
              animationDelay: `${-rnd(i, 106) * 16}s`,
            } as Vars
          }
        />,
      )
    }
  }

  if (night && season !== 'winter' && weather !== 'regen') {
    for (let i = 0; i < 14; i++) {
      parts.push(
        <span
          key={`f${i}`}
          className="firefly"
          style={
            {
              left: `${rnd(i, 31) * 96}%`,
              top: `${35 + rnd(i, 32) * 50}%`,
              '--fx': `${(rnd(i, 33) - 0.5) * 50}px`,
              '--fy': `${(rnd(i, 34) - 0.5) * 40}px`,
              animationDuration: `${5 + rnd(i, 35) * 5}s, ${1.6 + rnd(i, 36) * 2.4}s`,
              animationDelay: `${-rnd(i, 37) * 8}s, ${-rnd(i, 38) * 3}s`,
            } as Vars
          }
        />,
      )
    }
  }

  return <>{parts}</>
}

function Butterflies() {
  const colors = ['#f2a541', '#ea7fae', '#5a9aef', '#e2bd3a']
  return (
    <>
      {colors.map((c, i) => (
        <span
          key={c}
          className="butterfly"
          style={
            {
              top: `${38 + rnd(i, 41) * 42}%`,
              animationDuration: `${22 + rnd(i, 42) * 12}s`,
              animationDelay: `${-rnd(i, 43) * 26}s`,
              '--c': c,
            } as Vars
          }
        >
          <i />
          <i />
          <b />
        </span>
      ))}
    </>
  )
}

function Bees() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="bee"
          style={
            {
              left: `${14 + rnd(i, 111) * 72}%`,
              top: `${34 + rnd(i, 112) * 44}%`,
              '--fx': `${24 + rnd(i, 113) * 26}px`,
              '--fy': `${-14 - rnd(i, 114) * 18}px`,
              animationDuration: `${3.8 + rnd(i, 115) * 2.4}s`,
              animationDelay: `${-rnd(i, 116) * 5}s`,
            } as Vars
          }
        />
      ))}
    </>
  )
}

function Rabbit({ p }: { p: ScenePalette }) {
  const fur = p.season === 'winter' ? '#f4f4f0' : p.lit('#9b7a58')
  const belly = mix(fur, '#ffffff', 0.45)
  return (
    <span className="runner rabbit-run" style={{ top: '74%' }} aria-hidden>
      <span className="block rabbit-hop">
        <svg viewBox="0 0 30 24" className="block h-[23px] w-[29px]">
          <ellipse cx="13" cy="21.5" rx="10" ry="1.6" fill="#000" opacity="0.14" />
          <circle cx="4.6" cy="14" r="2.5" fill={belly} />
          <ellipse cx="11.5" cy="13.6" rx="7.6" ry="6.2" fill={fur} />
          <ellipse cx="9.5" cy="18.2" rx="4.4" ry="2.4" fill={fur} />
          <circle cx="19.6" cy="9.6" r="4.2" fill={fur} />
          <path d="M18 7C17 3.6 17.4 1 18.4 1C19.6 1 20 4 20 6.6Z" fill={fur} />
          <path d="M20.2 6.6C20.4 3.6 21.4 1.2 22.4 1.4C23.2 1.6 22.8 4.6 21.8 7Z" fill={fur} />
          <circle cx="21.1" cy="8.8" r="0.8" fill="#1d1a16" />
          <circle cx="23.7" cy="10.4" r="0.55" fill="#b9707a" />
          <ellipse cx="15.8" cy="19.4" rx="2" ry="1.2" fill={belly} />
        </svg>
      </span>
    </span>
  )
}

function Hedgehog({ p }: { p: ScenePalette }) {
  const spikes = p.lit('#4b3a2c')
  const face = p.lit('#c9a982')
  return (
    <span className="runner hedgehog-walk" style={{ top: '80%' }} aria-hidden>
      <svg viewBox="0 0 28 16" className="hedgehog-waddle block h-[15px] w-[26px]">
        <path d="M2 14C2 6 8 2 14 2C19 2 22 6 23 9L27 12.6C26.6 14.2 24 14.6 21 14.6H4Z" fill={spikes} />
        <path d="M20 8.6C22 9 23.4 10 26.8 12.7C26.4 14.2 24 14.6 21 14.6C19.4 13 19 10.6 20 8.6Z" fill={face} />
        <circle cx="26.8" cy="12.8" r="0.8" fill="#14100c" />
        <circle cx="23.2" cy="11.2" r="0.55" fill="#14100c" />
        <path d="M5 4.6L3.6 2.8M8 3L7 1M11.4 1.8L11 0M15 1.8L15.8 0M18 3.2L19.4 1.6" stroke={spikes} strokeWidth="0.8" strokeLinecap="round" />
      </svg>
    </span>
  )
}

/** Eule auf einem Pfosten am linken Rand, blinzelt und schaut sich um */
function Owl({ p }: { p: ScenePalette }) {
  const wood = p.lit('#6d553d')
  const feather = '#3f4258'
  return (
    <span className="pointer-events-none absolute left-1" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 64px)' }} aria-hidden>
      <svg viewBox="0 0 34 92" className="block h-[92px] w-[34px]">
        <rect x="12.5" y="38" width="9" height="54" rx="1.6" fill={wood} />
        <path d="M12.5 46H21.5M12.5 62H21.5M12.5 78H21.5" stroke="#000" strokeOpacity="0.22" strokeWidth="1" />
        <path d="M5 40C4 26 7 12 17 12C27 12 30 26 29 40Z" fill={feather} />
        <path d="M10 39C10 32 12 28 17 28C22 28 24 32 24 39Z" fill="#62667d" />
        <g className="owl-look">
          <path d="M6 12L9.6 5L13 10.6C15.6 9.8 18.4 9.8 21 10.6L24.4 5L28 12C29.6 20 26 25.6 17 25.6C8 25.6 4.4 20 6 12Z" fill={feather} />
          <circle cx="12" cy="16.4" r="4.6" fill="#ece5cd" />
          <circle cx="22" cy="16.4" r="4.6" fill="#ece5cd" />
          <g className="owl-blink">
            <circle cx="12" cy="16.4" r="2.5" fill="#1a1712" />
            <circle cx="22" cy="16.4" r="2.5" fill="#1a1712" />
            <circle cx="12.9" cy="15.5" r="0.7" fill="#fff" />
            <circle cx="22.9" cy="15.5" r="0.7" fill="#fff" />
          </g>
          <path d="M15.4 19.6L17 22.6L18.6 19.6Z" fill="#d9a23f" />
        </g>
      </svg>
    </span>
  )
}

/** Vordergrund über der Leiste: Gras und Blumen im Wind geben dem Bild Tiefe */
function Foreground({ p }: { p: ScenePalette }) {
  const W = 400
  const H = 60
  const winter = p.season === 'winter'

  const blades = (count: number, salt: number, minH: number, maxH: number) => {
    let d = ''
    for (let i = 0; i < count; i++) d += tuft(rnd(i, salt) * W, H, minH + rnd(i, salt + 1) * (maxH - minH), salt + i, 4)
    return d
  }
  const back = blades(winter ? 14 : 58, 121, 12, 26)
  const front = blades(winter ? 7 : 34, 131, 16, 38)
  const shine = blades(winter ? 0 : 14, 151, 12, 30)
  const backColor = mix(p.blade[0], p.meadow[1], 0.35)
  const frontColor = mix(p.blade[0], '#000000', p.phase === 'nacht' ? 0.25 : 0.1)

  const flowers = winter
    ? []
    : Array.from({ length: 7 }, (_, i) => ({
        x: 18 + rnd(i, 141) * (W - 36),
        h: 24 + rnd(i, 142) * 22,
        color: p.flowers[i % p.flowers.length],
      }))

  return (
    <div className="pointer-events-none absolute inset-x-0 h-[60px]" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 64px)' }} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="fg-layer absolute inset-0 block size-full" overflow="visible">
        {winter ? (
          <path d={`M0 ${H}V${H - 12}C90 ${H - 22} 170 ${H - 6} 250 ${H - 13}C310 ${H - 18} 360 ${H - 10} ${W} ${H - 15}V${H}Z`} fill={p.meadow[0]} />
        ) : (
          <rect y={H - 6} width={W} height="6" fill={backColor} />
        )}
        <path d={back} stroke={backColor} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="fg-layer fg-near absolute inset-0 block size-full" overflow="visible">
        <path d={front} stroke={frontColor} strokeWidth="1.7" strokeLinecap="round" fill="none" />
        <path d={shine} stroke={p.blade[1]} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
        {flowers.map((f, i) => (
          <g key={i}>
            <path d={`M${f.x} ${H}Q${f.x + 3} ${H - f.h * 0.5} ${f.x} ${H - f.h}`} stroke={frontColor} strokeWidth="1.6" fill="none" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse key={a} cx={f.x} cy={H - f.h - 3.2} rx="1.7" ry="3.2" fill={f.color} transform={`rotate(${a} ${f.x} ${H - f.h})`} />
            ))}
            <circle cx={f.x} cy={H - f.h} r="1.9" fill={f.color === p.flowers[1] ? '#8d5a1e' : '#f3c33c'} />
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Perfekter Tag: nachts und abends goldene Glühwürmchen, tagsüber Funkeln über der Wiese */
function PerfectLife({ phase }: { phase: Sky['phase'] }) {
  if (phase === 'nacht' || phase === 'abend') {
    return (
      <>
        {Array.from({ length: 26 }, (_, i) => (
          <span
            key={`g${i}`}
            className="firefly firefly-gold"
            data-perfect
            style={
              {
                left: `${rnd(i, 61) * 96}%`,
                top: `${30 + rnd(i, 62) * 60}%`,
                '--fx': `${(rnd(i, 63) - 0.5) * 70}px`,
                '--fy': `${(rnd(i, 64) - 0.5) * 60}px`,
                animationDuration: `${5 + rnd(i, 65) * 5}s, ${1.4 + rnd(i, 66) * 2}s`,
                animationDelay: `${-rnd(i, 67) * 8}s, ${-rnd(i, 68) * 3}s`,
              } as Vars
            }
          />
        ))}
      </>
    )
  }
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={`s${i}`}
          className="sparkle"
          data-perfect
          style={{ left: `${rnd(i, 71) * 96}%`, top: `${34 + rnd(i, 72) * 54}%`, animationDuration: `${3 + rnd(i, 73) * 3}s`, animationDelay: `${-rnd(i, 74) * 6}s` }}
        >
          ✦
        </span>
      ))}
    </>
  )
}

export function Wildlife({ sky, p, perfect = false }: { sky: Sky; p: ScenePalette; perfect?: boolean }) {
  const { season, phase, weather } = sky
  const warm = season === 'fruehling' || season === 'sommer'
  const dry = weather !== 'regen'
  // Fest im Bild: Die Tiere bleiben beim Scrollen im Sichtfeld. Direkt im body,
  // damit Gras und Tiere beim Wischen zwischen den Ansichten nicht verrutschen.
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[3] overflow-hidden" aria-hidden>
      <Weather sky={sky} />
      {warm && phase === 'tag' && dry && <Butterflies />}
      {warm && phase !== 'nacht' && dry && <Bees />}
      {phase !== 'nacht' && season !== 'winter' && dry && <Rabbit p={p} />}
      {phase === 'nacht' && season !== 'winter' && <Hedgehog p={p} />}
      <Foreground p={p} />
      {phase === 'nacht' && <Owl p={p} />}
      {perfect && <PerfectLife phase={phase} />}
    </div>,
    document.body,
  )
}

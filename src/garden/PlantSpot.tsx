/**
 * Der Platz einer Pflanze im Garten: Schatten und Gras statt einer Scheibe Erde,
 * dazu je nach Pflanze ein paar Steine, Blumen oder Pilze. Geht es ihr gut, fallen
 * ab und zu Blüten aus der Krone, welkt sie, ein trockenes Blatt.
 */
import { memo } from 'react'
import { mix, rnd, type ScenePalette } from './palette'
import { tuft } from './meadow'

const W = 130
const H = 40
/** Bodenlinie in der Grafik, sie liegt auf der Bodenlinie der Pflanze */
const BASE = 18

const Stones = ({ x, p, salt }: { x: number; p: ScenePalette; salt: number }) => {
  const stone = p.lit('#9aa0a6')
  const big = 4.5 + rnd(1, salt) * 2.5
  return (
    <g>
      <ellipse cx={x} cy={BASE + 8} rx={big} ry={big * 0.72} fill={stone} />
      <ellipse cx={x - big * 0.25} cy={BASE + 7} rx={big * 0.5} ry={big * 0.26} fill={mix(stone, '#ffffff', 0.32)} />
      <ellipse cx={x + big * 1.05} cy={BASE + 9.4} rx={big * 0.52} ry={big * 0.4} fill={mix(stone, '#000000', 0.12)} />
      {p.season === 'winter' && <ellipse cx={x} cy={BASE + 5.2} rx={big * 0.74} ry={big * 0.3} fill="#fff" />}
    </g>
  )
}

const Mushrooms = ({ x, p }: { x: number; p: ScenePalette }) => {
  const cap = p.lit('#c4432e')
  const stem = p.lit('#f0e6d2')
  return (
    <g>
      {[[0, 1], [6, 0.7]].map(([dx, s]) => (
        <g key={dx} transform={`translate(${x + dx} ${BASE + 9}) scale(${s})`}>
          <path d="M-1.4 0L-1.1 -5H1.1L1.4 0Z" fill={stem} />
          <path d="M-4.6 -4.6C-4.4 -8.6 4.4 -8.6 4.6 -4.6Z" fill={cap} />
          <circle cx="-1.6" cy="-6.2" r="0.7" fill={stem} />
          <circle cx="1.5" cy="-6.6" r="0.55" fill={stem} />
        </g>
      ))}
    </g>
  )
}

const Flowers = ({ x, p, salt }: { x: number; p: ScenePalette; salt: number }) => (
  <g>
    {[0, 1, 2].map((i) => {
      const fx = x + (i - 1) * 5.5
      const h = 7 + rnd(i, salt) * 6
      const color = p.flowers[(i + salt) % p.flowers.length]
      return (
        <g key={i}>
          <path d={`M${fx} ${BASE + 10}L${fx} ${BASE + 10 - h}`} stroke={p.blade[0]} strokeWidth="0.9" />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx={fx} cy={BASE + 10 - h - 1.7} rx="1.05" ry="1.7" fill={color} transform={`rotate(${a} ${fx} ${BASE + 10 - h})`} />
          ))}
          <circle cx={fx} cy={BASE + 10 - h} r="0.95" fill={color === p.flowers[1] ? '#8d5a1e' : '#f3c33c'} />
        </g>
      )
    })}
  </g>
)

/** Boden unter der Pflanze */
export const PlantGround = memo(function PlantGround({ seed, spread, p }: { seed: number; spread: number; p: ScenePalette }) {
  const winter = p.season === 'winter'
  const kind = Math.floor(rnd(seed % 997, 5) * 4)
  const side = rnd(seed % 997, 6) > 0.5 ? 1 : -1
  const decorX = W / 2 + side * (26 + rnd(seed % 997, 7) * 14)

  let dark = ''
  let light = ''
  const tufts = winter ? 5 : 15
  for (let i = 0; i < tufts; i++) {
    const a = rnd(i, (seed % 89) + 9) * Math.PI * 2
    const x = W / 2 + Math.cos(a) * (10 + rnd(i, 3) * 26 * spread)
    const y = BASE + 2 + Math.sin(a) * 6 + 1
    const d = tuft(x, y, 6 + rnd(i, 4) * 7, seed % 89, 3)
    if (i % 3 === 0) light += d
    else dark += d
  }

  const shadowId = `g-spot-${seed}`
  const shadow = winter ? '#6d86a8' : p.phase === 'nacht' ? '#000000' : mix(p.meadow[1], '#14220e', 0.78)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute left-1/2 block w-[118%] -translate-x-1/2" style={{ top: '76%' }} aria-hidden overflow="visible">
      <defs>
        <radialGradient id={shadowId}>
          <stop offset="0.25" stopColor={shadow} stopOpacity={winter ? 0.42 : 0.62} />
          <stop offset="1" stopColor={shadow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={W / 2} cy={BASE + 2.4} rx={38 * spread} ry={9.5} fill={`url(#${shadowId})`} />
      <path d={dark} stroke={p.blade[0]} strokeWidth="1.15" strokeLinecap="round" fill="none" />
      <path d={light} stroke={p.blade[1]} strokeWidth="1.05" strokeLinecap="round" fill="none" />
      {kind === 0 && <Stones x={decorX} p={p} salt={seed % 89} />}
      {kind === 1 && !winter && <Flowers x={decorX} p={p} salt={seed % 89} />}
      {kind === 2 && p.season === 'herbst' && <Mushrooms x={decorX} p={p} />}
      {kind === 2 && p.season !== 'herbst' && <Stones x={decorX} p={p} salt={(seed % 89) + 1} />}
    </svg>
  )
})

/** Kleine Lebenszeichen an der Pflanze. Nichts davon will angetippt werden. */
export function PlantLife({ index, g, wilted, color, phase }: { index: number; g: number; wilted: boolean; color: string; phase: ScenePalette['phase'] }) {
  const delay = (i: number) => `${-((index * 3.7 + i * 5.3) % 14)}s`
  if (wilted) {
    return <span className="spot-drop" style={{ background: '#a87f46', left: `${42 + (index % 4) * 6}%`, top: '38%', animationDelay: delay(0) }} aria-hidden />
  }
  if (g < 5) return null
  return (
    <span aria-hidden>
      {[0, 1].map((i) => (
        <span
          key={i}
          className="spot-drop spot-petal"
          style={{ background: color, left: `${30 + ((index * 11 + i * 29) % 44)}%`, top: `${22 + ((index + i * 3) % 3) * 8}%`, animationDelay: delay(i) }}
        />
      ))}
      {g >= 7 && phase === 'nacht' &&
        [0, 1, 2].map((i) => (
          <span key={`s${i}`} className="spot-spark" style={{ left: `${24 + i * 26}%`, top: `${26 + ((index + i) % 3) * 12}%`, animationDelay: `${-i * 0.9 - index * 0.4}s` }} />
        ))}
    </span>
  )
}

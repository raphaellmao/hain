/**
 * Gartendeko als Belohnung: Erfolge schalten Dinge im Garten frei, die von
 * selbst erscheinen – nichts zu tun, nur zu entdecken. Gezeichnet wie die
 * Pflanzen (viewBox 200 × 200, Boden bei y = 178) und im Licht der Tageszeit.
 */
import { useId } from 'react'
import { mix, type ScenePalette } from './palette'

export interface DecorDef {
  id: string
  /** Erfolg, der sie freischaltet (domain/achievements.ts) */
  achievement: string
  name: string
}

export const DECOR: DecorDef[] = [
  { id: 'bank', achievement: 'woche', name: 'Gartenbank' },
  { id: 'vogelhaus', achievement: 'haken-100', name: 'Vogelhaus' },
  { id: 'rosenbogen', achievement: 'perfekt-7', name: 'Rosenbogen' },
  { id: 'laterne', achievement: 'serie-30', name: 'Laterne' },
  { id: 'teich', achievement: 'hain', name: 'Seerosenteich' },
  { id: 'steinkreis', achievement: 'schatten-besiegt', name: 'Steinkreis' },
  { id: 'brunnen', achievement: 'perfekter-monat', name: 'Brunnen' },
  { id: 'obelisk', achievement: 'futurist', name: 'Kristall-Obelisk' },
]

const G = 178

export function DecorArt({ id, p, className }: { id: string; p: ScenePalette; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const night = p.phase === 'nacht' || p.phase === 'abend'
  const wood = p.lit('#8a5a34')
  const woodDark = p.lit('#5e3b20')
  const stone = p.lit('#9aa3ad')
  const stoneDark = p.lit('#6b737d')
  const shadow = <ellipse cx={100} cy={G + 2} rx={62} ry={9} fill="#000" opacity={0.18} />

  let body: React.ReactNode
  switch (id) {
    case 'bank':
      body = (
        <>
          {shadow}
          {/* Beine */}
          {[52, 70, 130, 148].map((x) => (
            <rect key={x} x={x - 3} y={x < 100 ? 130 : 130} width={6} height={48} rx={2} fill={woodDark} />
          ))}
          {/* Sitz und Lehne */}
          <rect x={40} y={128} width={120} height={9} rx={3} fill={wood} />
          <rect x={40} y={137} width={120} height={4} rx={2} fill={woodDark} opacity={0.6} />
          {[86, 100, 114].map((y) => (
            <rect key={y} x={44} y={y} width={112} height={8} rx={3} fill={wood} />
          ))}
          <rect x={46} y={84} width={6} height={50} rx={2} fill={woodDark} />
          <rect x={148} y={84} width={6} height={50} rx={2} fill={woodDark} />
          {/* Armlehnen */}
          <rect x={36} y={110} width={20} height={6} rx={3} fill={woodDark} />
          <rect x={144} y={110} width={20} height={6} rx={3} fill={woodDark} />
        </>
      )
      break
    case 'vogelhaus':
      body = (
        <>
          <ellipse cx={100} cy={G + 2} rx={26} ry={5} fill="#000" opacity={0.18} />
          <rect x={96} y={96} width={8} height={82} rx={2} fill={woodDark} />
          <path d="M66 70L100 42L134 70Z" fill={p.lit('#b0473a')} />
          <path d="M60 72L100 38L140 72L134 76L100 47L66 76Z" fill={p.lit('#7d2f26')} />
          <rect x={72} y={70} width={56} height={40} rx={3} fill={wood} />
          <circle cx={100} cy={86} r={8} fill={woodDark} />
          <rect x={92} y={98} width={16} height={4} rx={2} fill={woodDark} />
          {/* Meise auf der Stange */}
          <g transform="translate(116 92)">
            <ellipse cx={0} cy={0} rx={7} ry={5.5} fill={p.lit('#e7c84a')} />
            <circle cx={5} cy={-4} r={3.6} fill={p.lit('#2c3e70')} />
            <circle cx={6} cy={-4.4} r={0.9} fill="#fff" />
            <path d="M8.6 -3.6L11 -3L8.6 -2.4Z" fill="#333" />
            <path d="M-6 -1L-12 -3L-7 2Z" fill={p.lit('#2c3e70')} />
          </g>
        </>
      )
      break
    case 'rosenbogen':
      body = (
        <>
          {shadow}
          <path d="M52 178L52 92C52 52 148 52 148 92L148 178" fill="none" stroke={p.lit('#e8e2d6')} strokeWidth={6} />
          <path d="M62 178L62 94C62 64 138 64 138 94L138 178" fill="none" stroke={p.lit('#d9d2c4')} strokeWidth={3} />
          {/* Ranken und Rosen */}
          <path d="M52 170C60 150 44 130 54 110C64 90 52 74 70 62C90 50 110 50 130 62C148 74 136 90 146 110C156 130 140 150 148 170" fill="none" stroke={p.lit('#4f8a3a')} strokeWidth={2.4} />
          {[
            [56, 150], [48, 122], [58, 98], [70, 70], [92, 58], [112, 58], [132, 70], [144, 98], [152, 124], [142, 150], [100, 54], [60, 172], [140, 172],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x + 4} cy={y + 3} r={4} fill={p.lit('#4f8a3a')} />
              <circle cx={x} cy={y} r={5.2} fill={p.lit(i % 3 === 0 ? '#e85d8a' : i % 3 === 1 ? '#f28fb0' : '#c9365f')} />
              <circle cx={x - 1} cy={y - 1} r={2} fill={p.lit('#ffd3e2')} opacity={0.7} />
            </g>
          ))}
        </>
      )
      break
    case 'laterne':
      body = (
        <>
          {night && (
            <>
              <defs>
                <radialGradient id={`lg${uid}`}>
                  <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.85" />
                  <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx={100} cy={G} rx={70} ry={14} fill="#ffd36b" opacity={0.22} />
              <circle cx={100} cy={64} r={52} fill={`url(#lg${uid})`} className="lantern-glow" />
            </>
          )}
          <ellipse cx={100} cy={G + 2} rx={22} ry={5} fill="#000" opacity={0.2} />
          <rect x={96} y={86} width={8} height={92} rx={2} fill={p.lit('#2f3338')} />
          <rect x={88} y={170} width={24} height={8} rx={2} fill={p.lit('#2f3338')} />
          <path d="M82 50L100 34L118 50Z" fill={p.lit('#2f3338')} />
          <rect x={84} y={50} width={32} height={34} rx={3} fill={night ? '#ffe38a' : p.lit('#dfe6ec')} stroke={p.lit('#2f3338')} strokeWidth={3} />
          <path d="M100 50L100 84M84 67L116 67" stroke={p.lit('#2f3338')} strokeWidth={2} />
          <rect x={86} y={84} width={28} height={5} rx={2} fill={p.lit('#2f3338')} />
        </>
      )
      break
    case 'teich':
      body = (
        <>
          <defs>
            <radialGradient id={`w${uid}`} cy="0.4">
              <stop offset="0" stopColor={mix(p.lit('#6fb6d9'), '#ffffff', night ? 0 : 0.25)} />
              <stop offset="1" stopColor={p.lit('#3b7fa8')} />
            </radialGradient>
          </defs>
          <ellipse cx={100} cy={160} rx={86} ry={26} fill={p.lit('#7b8a70')} />
          <ellipse cx={100} cy={158} rx={78} ry={21} fill={`url(#w${uid})`} />
          <path d="M60 152Q90 146 120 150" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.5} fill="none" className="glint" />
          {[[64, 160, 10], [118, 164, 12], [142, 152, 9]].map(([x, y, r], i) => (
            <g key={i}>
              <path d={`M${x} ${y}m-${r} 0a${r} ${r * 0.45} 0 1 0 ${r * 2} 0a${r} ${r * 0.45} 0 1 0 -${r * 2} 0Z`} fill={p.lit('#4f9a4a')} />
              <path d={`M${x} ${y}L${x + r} ${y - r * 0.2}`} stroke={p.lit('#3d7a38')} strokeWidth={1.2} />
            </g>
          ))}
          <g transform="translate(118 158)">
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse key={a} cx={0} cy={-5} rx={2.6} ry={5.5} fill={p.lit('#f5b8cf')} transform={`rotate(${a})`} />
            ))}
            <circle r={2.4} fill={p.lit('#f6d05a')} />
          </g>
          {/* Schilf am Rand */}
          {[24, 30, 172, 178].map((x, i) => (
            <path key={x} d={`M${x} 160Q${x + (i % 2 ? 3 : -3)} 130 ${x + (i % 2 ? 6 : -2)} ${112 + i * 4}`} stroke={p.lit('#5d8a3e')} strokeWidth={2.2} fill="none" />
          ))}
          <ellipse cx={30} cy={118} rx={2.6} ry={8} fill={p.lit('#6b4a2c')} />
          <ellipse cx={178} cy={126} rx={2.6} ry={8} fill={p.lit('#6b4a2c')} />
        </>
      )
      break
    case 'steinkreis':
      body = (
        <>
          <ellipse cx={100} cy={G - 6} rx={84} ry={18} fill="#000" opacity={0.14} />
          {[
            [56, 150, 14, 34], [100, 146, 15, 38], [144, 150, 14, 34], [38, 174, 17, 42], [162, 174, 17, 42], [100, 182, 18, 44],
          ].map(([x, y, w, h], i) => (
            <g key={i}>
              <path d={`M${x - w / 2} ${y}L${x - w / 2 + 2} ${y - h + 4}Q${x} ${y - h - 3} ${x + w / 2 - 2} ${y - h + 4}L${x + w / 2} ${y}Z`} fill={i % 2 ? stone : stoneDark} />
              <path d={`M${x - 2} ${y - h * 0.65}L${x + 2} ${y - h * 0.5}L${x - 2} ${y - h * 0.35}`} stroke={night ? '#7fe7ff' : p.lit('#4a5560')} strokeWidth={1.4} fill="none" opacity={night ? 0.95 : 0.6} className={night ? 'rune-glow' : undefined} />
            </g>
          ))}
        </>
      )
      break
    case 'brunnen':
      body = (
        <>
          {shadow}
          <ellipse cx={100} cy={160} rx={62} ry={16} fill={stoneDark} />
          <rect x={38} y={140} width={124} height={22} fill={stone} />
          <ellipse cx={100} cy={140} rx={62} ry={14} fill={mix(stone, '#ffffff', 0.15)} />
          <ellipse cx={100} cy={141} rx={54} ry={10} fill={p.lit('#5fa9d0')} />
          <rect x={94} y={92} width={12} height={48} rx={3} fill={stone} />
          <ellipse cx={100} cy={92} rx={22} ry={6} fill={mix(stone, '#ffffff', 0.15)} />
          <ellipse cx={100} cy={92} rx={17} ry={4} fill={p.lit('#5fa9d0')} />
          {/* Wasserstrahl und Tropfen */}
          <path d="M100 90C99 70 101 62 100 56" stroke={p.lit('#bfe6f7')} strokeWidth={3} fill="none" strokeLinecap="round" />
          {[-1, 1].map((s) => (
            <path key={s} d={`M100 58C${100 + s * 10} 52 ${100 + s * 18} 66 ${100 + s * 20} 88`} stroke={p.lit('#bfe6f7')} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.85} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={100 + (i % 2 ? 1 : -1) * (14 + i * 3)} cy={84} r={1.6} fill="#e8f7ff" className="fountain-drop" style={{ animationDelay: `${-i * 0.35}s` }} />
          ))}
        </>
      )
      break
    case 'obelisk':
      body = (
        <>
          <defs>
            <linearGradient id={`ob${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#b9f3ff" />
              <stop offset="0.5" stopColor="#7c8cff" />
              <stop offset="1" stopColor="#c86bff" />
            </linearGradient>
            <radialGradient id={`og${uid}`}>
              <stop offset="0" stopColor="#a8b4ff" stopOpacity="0.6" />
              <stop offset="1" stopColor="#a8b4ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={100} cy={100} r={70} fill={`url(#og${uid})`} opacity={night ? 1 : 0.5} className="halo-pulse" />
          <ellipse cx={100} cy={G + 2} rx={34} ry={6} fill="#000" opacity={0.2} />
          <path d="M70 178L80 166L120 166L130 178Z" fill={stoneDark} />
          <path d="M84 166L92 52L100 30L108 52L116 166Z" fill={`url(#ob${uid})`} />
          <path d="M100 30L100 166M92 52L108 52" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1} />
          <path d="M84 166L92 52L100 30L100 166Z" fill="#000" opacity={0.15} />
          {[[70, 70], [132, 90], [76, 120], [128, 134]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y - 6}L${x + 2} ${y}L${x} ${y + 6}L${x - 2} ${y}Z`} fill="#e3e8ff" opacity={0.85} className="rune-glow" style={{ animationDelay: `${-i * 0.6}s` }} />
          ))}
        </>
      )
      break
    default:
      body = null
  }

  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden overflow="visible">
      {body}
    </svg>
  )
}

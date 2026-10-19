/**
 * Baumlabor (nur Entwicklung): zeigt Bäume in allen Stufen, welk und kahl,
 * für mehrere Seeds. Hilft beim Abstimmen von generate.ts.
 * Aufruf: http://localhost:5173/baumlabor.html?seeds=1,2,3
 */
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { Tree } from '../tree/Tree'
import { growthOf, STAGE_NAMES } from '../domain/health'
import { COLOR_KEYS, type ColorKey } from '../domain/colors'

const params = new URLSearchParams(location.search)
const seeds = (params.get('seeds') ?? '11,2024,77,5150').split(',').map(Number)
const H_VALUES = [0, 1, 2, 3, 5, 7, 10, 14, 20, 30, 45, 60, 80, 100]

function Lab() {
  const [color, setColor] = useState<ColorKey>((params.get('color') as ColorKey) ?? 'koralle')
  const [h, setH] = useState(30)
  const size = Number(params.get('size') ?? 120)

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {COLOR_KEYS.map((k) => (
          <button key={k} onClick={() => setColor(k)} className={`rounded px-2 py-1 text-sm ${k === color ? 'bg-ink text-bg' : 'bg-surface'}`}>
            {k}
          </button>
        ))}
      </div>

      {seeds.map((seed) => (
        <section key={seed} className="mb-6">
          <h2 className="text-sm text-muted">Seed {seed}</h2>
          <div className="flex flex-wrap gap-1">
            {H_VALUES.map((hv) => {
              const g = growthOf(hv)
              return (
                <figure key={hv} className="text-center" style={{ width: size }}>
                  <Tree seed={seed} color={color} g={g} className="w-full" />
                  <figcaption className="text-[11px] text-muted">
                    H {hv} · {STAGE_NAMES[Math.min(6, Math.floor(g))]}
                  </figcaption>
                </figure>
              )
            })}
            <figure className="text-center" style={{ width: size }}>
              <Tree seed={seed} color={color} g={growthOf(29)} wilted className="w-full" />
              <figcaption className="text-[11px] text-warn">H 29 welk</figcaption>
            </figure>
            <figure className="text-center" style={{ width: size }}>
              <Tree seed={seed} color={color} g={growthOf(4)} wilted className="w-full" />
              <figcaption className="text-[11px] text-warn">H 4 welk</figcaption>
            </figure>
            <figure className="text-center" style={{ width: size }}>
              <Tree seed={seed} color={color} g={0.5} dormant className="w-full" />
              <figcaption className="text-[11px] text-muted">kahl</figcaption>
            </figure>
          </div>
        </section>
      ))}

      <section className="mt-8">
        <h2 className="text-sm text-muted">Animiert: H = {h}</h2>
        <div className="flex gap-2">
          {[-10, -1, +1, +10].map((d) => (
            <button key={d} className="rounded bg-surface px-3 py-2" onClick={() => setH((v) => Math.max(0, Math.min(100, v + d)))}>
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
          <button className="rounded bg-surface px-3 py-2" onClick={() => setH((v) => v / 2)}>
            ÷2
          </button>
        </div>
        <div style={{ width: 320 }}>
          <Tree seed={seeds[0]} color={color} g={growthOf(h)} animated className="w-full" />
        </div>
      </section>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
)

/**
 * Baumlabor (nur Entwicklung): zeigt Pflanzen in allen Stufen, welk und kahl.
 * Hilft beim Abstimmen der Arten in tree/species/.
 *
 *   /baumlabor.html                         alle Arten, Stufen bis zur Blüte
 *   /baumlabor.html?species=tanne&seeds=1,2 eine Art, mehrere Seeds
 *   /baumlabor.html?hain                    Hain-Stufen (H 100 … 365)
 */
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { Tree } from '../tree/Tree'
import { growthOf } from '../domain/health'
import { COLOR_KEYS, type ColorKey } from '../domain/colors'
import { SPECIES_INFO, SPECIES_KEYS, stageName, type SpeciesKey } from '../domain/species'
import { H_MAX } from '../domain/health'
import { SHADOW_DECAY, SHADOW_GAIN, SHADOW_LEVELS, TERRITORY_STATUS, shadowState } from '../domain/shadow'
import { ShadowDuel } from '../shadow/ShadowDuel'

/** H und S nach einer Folge aus erledigt (d) / verpasst (m) – wie in health.ts/shadow.ts */
function simulate(steps: string): { h: number; s: number } {
  let h = 0, s = 0, miss = 0
  for (const c of steps) {
    if (c === 'd') { h = Math.min(H_MAX, h + 1); s *= 1 - SHADOW_DECAY; miss = 0 }
    else { miss++; h = miss === 1 ? Math.max(0, h - 1) : h / 2; s += (100 - s) * SHADOW_GAIN }
  }
  return { h, s }
}
const SCENARIOS: [string, string][] = [
  ['Start', ''], ['7 Tage dran', 'd'.repeat(7)], ['30 Tage dran', 'd'.repeat(30)], ['60 Tage dran', 'd'.repeat(60)],
  ['60 + 1 verpasst', 'd'.repeat(60) + 'm'], ['60 + 2 verpasst', 'd'.repeat(60) + 'mm'], ['60 + 3 verpasst', 'd'.repeat(60) + 'mmm'],
  ['60 + 5 verpasst', 'd'.repeat(60) + 'm'.repeat(5)], ['60 + 7 verpasst', 'd'.repeat(60) + 'm'.repeat(7)],
  ['14 verpasst', 'm'.repeat(14)], ['…dann 5 dran', 'm'.repeat(14) + 'd'.repeat(5)], ['…dann 12 dran', 'm'.repeat(14) + 'd'.repeat(12)],
]

function ShadowLab({ color, size }: { color: ColorKey; size: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SCENARIOS.map(([label, steps]) => {
        const { h, s } = simulate(steps)
        const st = shadowState(h, s)
        return (
          <figure key={label} className="text-center" style={{ width: size }}>
            <ShadowDuel color={color} territory={st.territory} s={st.s} light={st.light} animated density="rich" className="w-full" />
            <figcaption className="text-[10px] leading-tight text-muted">
              {label}
              <br />
              {TERRITORY_STATUS[st.status].label} · {Math.round(st.territory * 100)} %<br />
              {SHADOW_LEVELS[st.level].label} ({Math.round(st.s)})
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}

const params = new URLSearchParams(location.search)
const onlySpecies = params.get('species') as SpeciesKey | null
const seeds = (params.get('seeds') ?? '11').split(',').map(Number)
const grove = params.has('hain')
const H_VALUES = grove ? [60, 100, 130, 160, 200, 260, 320, 365] : [3, 7, 10, 14, 20, 30, 45, 60, 80, 100]

function Lab() {
  const [color, setColor] = useState<ColorKey>((params.get('color') as ColorKey) ?? 'koralle')
  const [h, setH] = useState(30)
  const size = Number(params.get('size') ?? 110)
  const list = onlySpecies ? [onlySpecies] : SPECIES_KEYS
  if (params.has('schatten')) {
    return (
      <div className="p-4">
        <ShadowLab color={color} size={size} />
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {COLOR_KEYS.map((k) => (
          <button key={k} onClick={() => setColor(k)} className={`rounded px-2 py-1 text-sm ${k === color ? 'bg-ink text-bg' : 'bg-surface'}`}>
            {k}
          </button>
        ))}
      </div>

      {list.map((species) =>
        seeds.map((seed) => (
          <section key={`${species}${seed}`} className="mb-3">
            <h2 className="text-sm font-semibold">
              {SPECIES_INFO[species].label} <span className="font-normal text-muted">· Seed {seed}</span>
            </h2>
            <div className="flex flex-wrap gap-1">
              {H_VALUES.map((hv) => {
                const g = growthOf(hv)
                return (
                  <figure key={hv} className="text-center" style={{ width: size }}>
                    <Tree seed={seed} color={color} species={species} g={g} className="w-full" />
                    <figcaption className="text-[10px] leading-tight text-muted">
                      H {hv} · {stageName(species, Math.min(9, Math.floor(g)))}
                    </figcaption>
                  </figure>
                )
              })}
              {!grove && (
                <>
                  <figure className="text-center" style={{ width: size }}>
                    <Tree seed={seed} color={color} species={species} g={growthOf(29)} wilted className="w-full" />
                    <figcaption className="text-[10px] text-warn">H 29 welk</figcaption>
                  </figure>
                  <figure className="text-center" style={{ width: size }}>
                    <Tree seed={seed} color={color} species={species} g={0.5} dormant className="w-full" />
                    <figcaption className="text-[10px] text-muted">kahl</figcaption>
                  </figure>
                </>
              )}
            </div>
          </section>
        )),
      )}

      <section className="mt-8">
        <h2 className="text-sm text-muted">Animiert: H = {Math.round(h)}</h2>
        <div className="flex gap-2">
          {[-10, -1, +1, +10, +50].map((d) => (
            <button key={d} className="rounded bg-surface px-3 py-2" onClick={() => setH((v) => Math.max(0, Math.min(365, v + d)))}>
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
          <button className="rounded bg-surface px-3 py-2" onClick={() => setH((v) => v / 2)}>
            ÷2
          </button>
        </div>
        <div style={{ width: 320 }}>
          <Tree seed={seeds[0]} color={color} species={list[0]} g={growthOf(h)} animated className="w-full" />
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

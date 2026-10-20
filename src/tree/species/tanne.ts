/**
 * Tanne: gerader Stamm, der über lange Zeit in die Höhe wächst. Die Etagen
 * erscheinen von unten nach oben, sobald der Stamm sie erreicht; Nadelbüschel
 * an den Etagen-Rändern verdichten das Bild Tag für Tag. Zapfen in der
 * Habit-Farbe statt Blüten.
 */
import { lerp, mulberry32 } from '../rng'
import {
  BASE_X, GROUND, type Blossom, type PlantModel, type RawBranch, type RawLeaf, blossomTime, finishBranches,
  finishLeaves, flarePath, makeFit, scheduleLeaves, shuffle,
} from '../model'
import { cone, coneScales, firTier, needleTuft, r1 } from '../shapes'

const T_START = 2.45 // Stamm beginnt zu wachsen …
const T_SPAN = 3.3 //   … und ist bei g ≈ 5,75 oben

export function tanne(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const tiers: RawLeaf[] = []
  const tufts: RawLeaf[] = []

  const H = r(140, 156)
  const topX = BASE_X + r(-3, 3)
  const tw = r(6.5, 8)
  branches.push({ pts: [BASE_X, GROUND, BASE_X + r(-2, 2), GROUND - H / 2, topX, GROUND - H], width: tw, depth: 0, start: T_START, span: T_SPAN })
  const xAt = (frac: number) => lerp(BASE_X, topX, frac)
  const reach = (frac: number) => T_START + T_SPAN * frac + 0.05

  const N = 7 + (rnd() < 0.5 ? 1 : 0) + (rnd() < 0.3 ? 1 : 0)
  const baseW = r(96, 112)
  const extra: { x: number; y: number }[] = []
  const coneSpots: { x: number; y: number; min: number }[] = []

  for (let i = 0; i < N; i++) {
    const u = i / (N - 1)
    const bottomFrac = lerp(0.12, 0.84, u)
    const w = lerp(baseW, 20, Math.pow(u, 0.9)) * r(0.92, 1.08)
    const h = lerp(40, 22, u)
    const x = xAt(bottomFrac)
    const yb = GROUND - bottomFrac * H
    const appear = reach(bottomFrac)
    // dunklere, etwas schmalere Etage dahinter → Tiefe
    for (const [k, shade] of [[0.8, -0.9], [1, r(-0.2, 0.4)]] as const) {
      tiers.push({
        x, y: yb - h * k - 3 * (1 - k), angle: r(-2, 2), size: w * k, shade, depth: 1,
        minAppear: appear, appear, fixed: true, tone: 'needle', droop: 0.06,
        shape: (s) => firTier(s, (h * k * s) / (w * k)),
      })
    }
    extra.push({ x: x - w / 2, y: yb }, { x: x + w / 2, y: yb }, { x, y: yb - h })
    // Nadelbüschel entlang der Unterkante
    const m = Math.round(lerp(9, 4, u))
    for (let j = 0; j < m; j++) {
      const fx = lerp(-0.46, 0.46, (j + r(0.2, 0.8)) / m)
      tufts.push({
        x: x + fx * w, y: yb - r(1, 5), angle: fx * 70 + r(-15, 15), size: r(6, 8.5), shade: r(-1, 1), depth: 2,
        minAppear: appear + 0.05, appear: 0, tone: 'needle', droop: 0.3, shape: needleTuft,
      })
      if (rnd() < 0.6) coneSpots.push({ x: x + fx * w * 0.9, y: yb - 1, min: appear + 0.1 })
    }
  }
  // Spitze
  const topAppear = T_START + T_SPAN + 0.02
  tiers.push({
    x: topX, y: GROUND - H - 12, angle: 0, size: 12, shade: 0.3, depth: 1, minAppear: topAppear, appear: topAppear,
    fixed: true, tone: 'needle', droop: 0, shape: (s) => firTier(s, s * 1.6, 3),
  })

  extra.push({ x: topX, y: GROUND - H - 12 })
  const leaves = [...tiers, ...tufts]
  const f = makeFit(branches, tufts, extra)
  scheduleLeaves(leaves, rnd, 3, 6, 1.25)

  const spots = shuffle(coneSpots, rnd).slice(0, 26)
  const blossoms: Blossom[] = spots.map((c, k) => {
    const size = r(6, 8.5) * f.fit
    const rot = r(-10, 10)
    return {
      id: k,
      x: r1(f.fx(c.x)),
      y: r1(f.fy(c.y)),
      d: cone(size, rot),
      size: r1(size),
      rot: Math.round(rot),
      shade: r(-1, 1),
      appear: Math.max(blossomTime(k, spots.length, 4, 4.6), c.min),
      lines: coneScales(size, rot),
    }
  })
  blossoms.sort((a, b) => a.appear - b.appear)

  return { branches: finishBranches(branches, f), leaves: finishLeaves(leaves, f), blossoms, flare: flarePath(tw * 0.8 * f.fit), stump: { trunk: 0.3, limbs: false } }
}

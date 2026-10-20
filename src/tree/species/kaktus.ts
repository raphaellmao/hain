/**
 * Säulenkaktus: eine dicke Säule wächst in die Höhe, später kommen ein bis
 * drei Arme dazu. Statt Blättern erscheinen Stacheln (jeden Tag ein paar),
 * zur Blüte öffnen sich Blüten auf der Krone und an den Armspitzen.
 */
import { lerp, mulberry32 } from '../rng'
import {
  BASE_X, GROUND, type Blossom, type PlantModel, type RawBranch, type RawLeaf, blossomTime, finishBranches,
  finishLeaves, makeFit, pointOn, scheduleLeaves, shuffle,
} from '../model'
import { cactusFlower, r1, spine } from '../shapes'

export function kaktus(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const spines: RawLeaf[] = []
  const flowerSpots: { x: number; y: number; min: number; big: boolean }[] = []

  // ── Säule ─────────────────────────────────────────────────────────────────
  const H = r(100, 120)
  const W = r(22, 27)
  const topX = BASE_X + r(-4, 4)
  const midX = BASE_X + r(-3, 3)
  const col: RawBranch = { pts: [BASE_X, GROUND, midX, GROUND - H / 2, topX, GROUND - H], width: W, depth: 0, start: 2.5, span: 2.6, tone: 'cactus' }
  branches.push(col)
  // Rippen: helle Linien parallel zur Säule
  for (const o of [-0.22, 0.22]) {
    const dx = o * W
    branches.push({ pts: [BASE_X + dx, GROUND, midX + dx, GROUND - H / 2, topX + dx * 0.8, GROUND - H], width: 1.4, depth: 0, start: col.start, span: col.span, tone: 'rib' })
  }
  // Stacheln an beiden Rändern der Säule
  const nSp = 22
  for (let j = 0; j < nSp; j++) {
    const t = lerp(0.06, 0.97, j / (nSp - 1))
    const p = pointOn(col, t)
    for (const side of [-1, 1]) {
      spines.push({
        x: p.x + side * W * 0.47, y: p.y - r(0, 3), angle: side * r(70, 105), size: r(3, 4.2), shade: 0, depth: 1,
        minAppear: col.start + col.span * t, appear: 0, tone: 'spine', droop: 0, shape: spine,
      })
    }
  }
  // Krone
  const crown = pointOn(col, 1)
  for (let i = 0; i < 6; i++) {
    flowerSpots.push({ x: crown.x + r(-0.42, 0.42) * W, y: crown.y - W * 0.35 + r(-3, 2), min: col.start + col.span, big: true })
  }
  for (let i = 0; i < 5; i++) {
    const p = pointOn(col, r(0.75, 0.95))
    flowerSpots.push({ x: p.x + (i % 2 ? 1 : -1) * W * 0.5, y: p.y, min: col.start + col.span, big: false })
  }

  // ── Arme ──────────────────────────────────────────────────────────────────
  const nArms = 1 + (rnd() < 0.6 ? 1 : 0) + (rnd() < 0.35 ? 1 : 0)
  let side = rnd() < 0.5 ? -1 : 1
  const used: number[] = []
  for (let i = 0; i < nArms; i++) {
    let frac = r(0.32, 0.62)
    if (used.some((u) => Math.abs(u - frac) < 0.1)) frac = Math.min(0.66, frac + 0.12)
    used.push(frac)
    const p = pointOn(col, frac)
    const out = r(16, 22)
    const up = r(28, 48)
    const x0 = p.x + side * W * 0.3
    const ex = x0 + side * out
    const arm: RawBranch = {
      pts: [x0, p.y, ex + side * 2, p.y + 4, ex, p.y - up * 0.35, ex, p.y - up],
      width: W * r(0.62, 0.72), depth: 1, start: col.start + col.span * frac + r(0.6, 1.2), span: 0.8, tone: 'cactus',
    }
    branches.push(arm)
    branches.push({ ...arm, width: 1.2, tone: 'rib' })
    for (let j = 0; j < 9; j++) {
      const t = lerp(0.25, 0.97, j / 8)
      const q = pointOn(arm, t)
      for (const s2 of [-1, 1]) {
        const a = ((q.angle + s2 * 90) * Math.PI) / 180
        spines.push({
          x: q.x + Math.sin(a) * arm.width * 0.47, y: q.y - Math.cos(a) * arm.width * 0.47,
          angle: q.angle + s2 * r(70, 105), size: r(2.8, 3.8), shade: 0, depth: 2,
          minAppear: arm.start + arm.span * t, appear: 0, tone: 'spine', droop: 0, shape: spine,
        })
      }
    }
    const tip = pointOn(arm, 1)
    for (let k = 0; k < 3; k++) {
      flowerSpots.push({ x: tip.x + r(-0.4, 0.4) * arm.width, y: tip.y - arm.width * 0.35 + r(-2, 2), min: arm.start + arm.span, big: k === 0 })
    }
    side = -side
  }

  const f = makeFit(branches, spines, [{ x: topX, y: GROUND - H - W * 0.9 }])
  scheduleLeaves(spines, rnd, 2.9, 6, 1.2)

  const spots = shuffle(flowerSpots, rnd)
  const blossoms: Blossom[] = spots.map((s, k) => {
    const size = (s.big ? r(5.5, 7) : r(3.6, 4.6)) * f.fit
    const rot = r(0, 36)
    return {
      id: k,
      x: r1(f.fx(s.x)),
      y: r1(f.fy(s.y)),
      d: cactusFlower(size, rot),
      size: r1(size),
      rot: Math.round(rot),
      shade: r(-1, 1),
      appear: Math.max(blossomTime(k, spots.length, 3, 4.4), s.min + 0.05),
      center: { r: r1(size * 0.3), tone: 'yellow' },
    }
  })
  blossoms.sort((a, b) => a.appear - b.appear)

  return { branches: finishBranches(branches, f), leaves: finishLeaves(spines, f), blossoms, stump: { trunk: 0.45, limbs: false } }
}

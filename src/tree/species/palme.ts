/**
 * Palme: ein schlanker, leicht gebogener Stamm mit Ringen. Oben öffnet sich
 * Wedel für Wedel die Krone, die Fiederblättchen kommen Tag für Tag dazu.
 * Unter der Krone reifen Büschel runder Früchte in der Habit-Farbe.
 */
import { lerp, mulberry32 } from '../rng'
import {
  BASE_X, GROUND, type Blossom, type PlantModel, type RawBranch, type RawLeaf, blossomTime, finishBranches, finishLeaves,
  flarePath, makeFit, pointOn, scheduleLeaves, shuffle,
} from '../model'
import { appleShine, lanceLeaf, nut, r1 } from '../shapes'

export function palme(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []

  // ── Stamm: früh fertig, die Größe wächst über treeScale mit ───────────────
  const H = r(108, 124)
  const bendSide = rnd() < 0.5 ? -1 : 1
  const bend = r(10, 22) * bendSide
  const trunk: RawBranch = {
    pts: [BASE_X, GROUND, BASE_X + bend * 0.1, GROUND - H * 0.4, BASE_X + bend * 0.9, GROUND - H * 0.75, BASE_X + bend, GROUND - H],
    width: r(8, 9.5), depth: 0, start: 2.45, span: 0.5,
  }
  branches.push(trunk)
  // Ringe quer über den Stamm
  for (let i = 1; i < 14; i++) {
    const t = i / 14
    const q = pointOn(trunk, t)
    const a = ((q.angle + 90) * Math.PI) / 180
    const w = trunk.width * lerp(1, 0.8, t) * 0.5
    branches.push({
      pts: [q.x - Math.sin(a) * w, q.y + Math.cos(a) * w, q.x, q.y + 1.2, q.x + Math.sin(a) * w, q.y - Math.cos(a) * w],
      width: 1.1, depth: 0, start: trunk.start + trunk.span * t, span: 0.05, tone: 'mark',
    })
  }

  // ── Krone: Wedel nach allen Seiten, die oberen steiler ────────────────────
  const top = pointOn(trunk, 1)
  const n = 8 + Math.floor(rnd() * 3)
  const fruitSpots: { x: number; y: number; min: number }[] = []
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1)
    const side = i % 2 ? 1 : -1
    // Winkel: −115° … 115°, mittlere Wedel stehen höher
    const ang = lerp(-118, 118, u) + r(-8, 8)
    const len = r(46, 58) * (Math.abs(ang) > 80 ? 0.92 : 1)
    const rad = (ang * Math.PI) / 180
    const ex = top.x + Math.sin(rad) * len
    const ey = top.y - Math.cos(rad) * len * 0.55 + Math.abs(Math.sin(rad)) * len * 0.35
    const cx = top.x + Math.sin(rad) * len * 0.55
    const cy = top.y - len * 0.42
    // Reihenfolge des Erscheinens: abwechselnd, damit die Krone symmetrisch wächst
    const order = Math.abs(i - (n - 1) / 2)
    const start = 2.5 + order * r(0.36, 0.46)
    const frond: RawBranch = { pts: [top.x, top.y, cx, cy, ex, ey], width: 2.2, depth: 1, start, span: 0.45, tone: 'stem' }
    branches.push(frond)
    // Fiederblättchen beidseitig, zur Spitze kleiner
    const pairs = 9
    for (let k = 0; k < pairs; k++) {
      const t = lerp(0.18, 0.98, k / (pairs - 1))
      const q = pointOn(frond, t)
      for (const s2 of [-1, 1]) {
        leaves.push({
          x: q.x, y: q.y, angle: q.angle + s2 * r(58, 82), size: lerp(17, 8, t) * r(0.9, 1.1), shade: r(-1, 1), depth: 2,
          minAppear: frond.start + frond.span * t, appear: 0, shape: lanceLeaf, droop: 0.8,
        })
      }
    }
    if (side === 1 || i === 0) fruitSpots.push({ x: top.x + Math.sin(rad) * 7, y: top.y + 6, min: start })
  }

  const f = makeFit(branches, leaves)
  scheduleLeaves(leaves, rnd, 2.7, 6, 1.5)

  // ── Früchte: Büschel unter der Krone ──────────────────────────────────────
  const blossoms: Blossom[] = []
  const spots: { x: number; y: number; min: number }[] = []
  for (const s of fruitSpots) for (let k = 0; k < 4; k++) spots.push({ x: s.x + r(-6, 6), y: s.y + r(-2, 9), min: s.min })
  shuffle(spots, rnd).forEach((s, k, all) => {
    const size = r(3.4, 4.4) * f.fit
    blossoms.push({
      id: blossoms.length, x: r1(f.fx(s.x)), y: r1(f.fy(s.y)), d: nut(size), size: r1(size), rot: 0, shade: r(-1, 1),
      appear: Math.max(blossomTime(k, all.length, 3, 4.6), s.min + 0.6), shine: appleShine(size),
    })
  })
  blossoms.sort((a, b) => a.appear - b.appear)

  return {
    branches: finishBranches(branches, f),
    leaves: finishLeaves(leaves, f),
    blossoms,
    flare: flarePath(trunk.width * f.fit * 0.9),
    stump: { trunk: 0.5, limbs: false },
  }
}

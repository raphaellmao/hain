/**
 * Sonnenblume: ein hoher Stängel mit großen Herzblättern, oben eine Knospe,
 * die sich zur Blüte öffnet – Blütenblatt für Blütenblatt, jeden Tag eins.
 * An Seitentrieben öffnen sich später kleinere Blüten.
 */
import { lerp, mulberry32 } from '../rng'
import {
  BASE_X, GROUND, type Blossom, type PlantModel, type RawBranch, type RawLeaf, finishBranches, finishLeaves,
  makeFit, pointOn, scheduleLeaves, shuffle,
} from '../model'
import { budPath, circle, heartLeaf, r1, seedDots, sunPetal } from '../shapes'

interface Head {
  x: number
  y: number
  R: number
  petals: number
  bud: number //   Knospe sichtbar ab
  open: number //  Blüte öffnet sich ab …
  full: number //  … und ist bis hier komplett
}

export function sonnenblume(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []

  const H = r(128, 145)
  const stem: RawBranch = {
    pts: [BASE_X, GROUND, BASE_X + r(-6, 6), GROUND - H * 0.35, BASE_X + r(-8, 8), GROUND - H * 0.7, BASE_X + r(-5, 5), GROUND - H],
    width: r(5, 6.5), depth: 0, start: 2.45, span: 2.75, tone: 'stem',
  }
  branches.push(stem)
  const reach = (t: number) => stem.start + stem.span * t

  // große Herzblätter, abwechselnd links/rechts, oben kleiner
  let side = rnd() < 0.5 ? -1 : 1
  for (let k = 0; k < 9; k++) {
    const t = lerp(0.1, 0.82, k / 8) + r(-0.02, 0.02)
    const p = pointOn(stem, t)
    // untere Blätter hängen weit nach außen, obere stehen steiler
    leaves.push({
      x: p.x, y: p.y, angle: p.angle + side * lerp(108, 62, k / 8) + r(-8, 8), size: lerp(30, 14, k / 8) * r(0.9, 1.1),
      shade: r(-0.8, 0.8), depth: 1, minAppear: reach(t) + 0.03, appear: 0, shape: heartLeaf,
    })
    side = -side
  }

  const top = pointOn(stem, 1)
  const R = r(17, 20)
  // Die Hauptblüte öffnet sich ab g = 5,5, damit sie zur Stufe „Blühende Sonnenblume“ (H 60) schon blüht
  const heads: Head[] = [{ x: top.x, y: top.y - R * 0.15, R, petals: 22, bud: 5, open: 5.5, full: 6.9 }]

  // Seitentriebe mit kleineren Blüten
  const nSide = 2 + (rnd() < 0.35 ? 1 : 0)
  for (let i = 0; i < nSide; i++) {
    const t = r(0.42, 0.72)
    const p = pointOn(stem, t)
    const s = i % 2 ? 1 : -1
    const len = r(26, 34)
    const ex = p.x + s * len * 0.55
    const ey = p.y - len
    const shoot: RawBranch = {
      pts: [p.x, p.y, p.x + s * len * 0.45, p.y - len * 0.2, ex, ey],
      width: 3, depth: 1, start: reach(t) + r(0.4, 0.8), span: 0.5, tone: 'stem',
    }
    branches.push(shoot)
    for (let k = 0; k < 2; k++) {
      const q = pointOn(shoot, 0.45 + k * 0.3)
      leaves.push({
        x: q.x, y: q.y, angle: q.angle + (k ? 1 : -1) * r(45, 70), size: r(10, 13), shade: r(-0.8, 0.8), depth: 2,
        minAppear: shoot.start + shoot.span * (0.45 + k * 0.3), appear: 0, shape: heartLeaf,
      })
    }
    heads.push({ x: ex, y: ey, R: R * r(0.5, 0.6), petals: 14, bud: 5.6, open: 6.1, full: 6.95 })
  }

  const extra = heads.flatMap((h) => [{ x: h.x - h.R, y: h.y - h.R }, { x: h.x + h.R, y: h.y - h.R }])
  const f = makeFit(branches, leaves, extra)
  scheduleLeaves(leaves, rnd, 2.9, 5.4, 1.1)

  // Reihenfolge im Array = Zeichenreihenfolge: Knospe, Blütenblätter, Scheibe obenauf
  const blossoms: Blossom[] = []
  for (const h of heads) {
    const R2 = h.R * f.fit
    const x = r1(f.fx(h.x))
    const y = r1(f.fy(h.y))
    const disk = R2 * 0.46
    blossoms.push({ id: blossoms.length, x, y, d: budPath(R2 * 0.62, r(0, 45)), size: r1(R2), rot: 0, shade: 0, appear: h.bud, tone: 'green' })
    const order = shuffle([...Array(h.petals).keys()], rnd)
    for (let i = 0; i < h.petals; i++) {
      const rot = (360 / h.petals) * i + r(-4, 4)
      blossoms.push({
        id: blossoms.length, x, y, d: sunPetal(disk, R2 * 0.6 * r(0.9, 1.08), rot), size: r1(R2), rot: Math.round(rot),
        shade: r(-1, 1), appear: lerp(h.open, h.full, order[i] / (h.petals - 1)),
      })
    }
    blossoms.push({
      id: blossoms.length, x, y, d: circle(disk), size: r1(disk), rot: 0, shade: r(-0.5, 0.5),
      appear: h.open - 0.04, tone: 'brown', dots: seedDots(disk),
    })
  }

  return { branches: finishBranches(branches, f), leaves: finishLeaves(leaves, f), blossoms, stump: { trunk: 0.35, limbs: false } }
}

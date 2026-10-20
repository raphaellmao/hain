/**
 * Trauerweide: kräftiger Stamm, wenige ausladende Hauptäste, von denen lange
 * Ruten herabhängen. Schmale Blätter entlang der Ruten, Kätzchen als Blüten.
 */
import { lerp, mulberry32 } from '../rng'
import {
  BASE_X, GROUND, type Blossom, type PlantModel, type RawBranch, type RawLeaf, blossomTime, finishBranches,
  finishLeaves, flarePath, makeFit, pointOn, scheduleLeaves, shuffle,
} from '../model'
import { catkin, lanceLeaf, r1 } from '../shapes'

export function weide(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []

  // ── Stamm ─────────────────────────────────────────────────────────────────
  const tw = r(10, 12.5)
  const tl = r(42, 50)
  const lean = r(-0.1, 0.1)
  const tx = BASE_X + Math.sin(lean) * tl
  const ty = GROUND - Math.cos(lean) * tl
  const trunk: RawBranch = { pts: [BASE_X, GROUND, BASE_X + r(-6, 6), GROUND - tl * 0.5, tx, ty], width: tw, depth: 0, start: 2.5, span: 0.3 }
  branches.push(trunk)

  // ── Hauptäste, leicht nach oben und außen ─────────────────────────────────
  const anchors: { x: number; y: number; start: number; side: number }[] = []
  const nLimbs = 3 + (rnd() < 0.5 ? 1 : 0)
  for (let i = 0; i < nLimbs; i++) {
    const a = lerp(-1.05, 1.05, i / (nLimbs - 1)) + r(-0.15, 0.15)
    const len = r(30, 42)
    const x2 = tx + Math.sin(a) * len
    const y2 = ty - Math.cos(a) * len * 0.75
    const limb: RawBranch = {
      pts: [tx, ty, tx + Math.sin(a) * len * 0.35, ty - len * 0.55, x2, y2],
      width: tw * 0.55, depth: 1, start: 2.6 + r(0, 0.2), span: 0.35,
    }
    branches.push(limb)
    const end = limb.start + limb.span
    anchors.push({ x: x2, y: y2, start: end, side: Math.sign(a) || 1 })
    for (const t of [0.55, 0.8]) {
      const p = pointOn(limb, t)
      anchors.push({ x: p.x, y: p.y, start: limb.start + limb.span * t, side: Math.sign(a) || 1 })
    }
    // Jugendblätter für den kleinen Busch
    for (let k = 0; k < 2; k++) {
      const p = pointOn(limb, r(0.4, 0.95))
      leaves.push({
        x: p.x, y: p.y, angle: p.angle + (k ? 1 : -1) * r(30, 60), size: r(11, 13), shade: r(-0.5, 1), depth: 1,
        minAppear: limb.start + 0.2, appear: Math.max(limb.start + 0.2, r(2.85, 3.15)), vanish: r(4.5, 5.6),
        shape: lanceLeaf, droop: 0.5,
      })
    }
    // Nebenast
    const p = pointOn(limb, r(0.55, 0.85))
    const a2 = a + Math.sign(a || 1) * r(0.2, 0.45)
    const l2 = r(18, 26)
    const sub: RawBranch = {
      pts: [p.x, p.y, p.x + Math.sin(a2) * l2 * 0.5, p.y - l2 * 0.6, p.x + Math.sin(a2) * l2, p.y - Math.cos(a2) * l2 * 0.6],
      width: 3.6, depth: 2, start: 2.95 + r(0, 0.3), span: 0.35,
    }
    branches.push(sub)
    anchors.push({ x: sub.pts[4], y: sub.pts[5], start: sub.start + sub.span, side: Math.sign(a2) || 1 })
  }
  for (let k = 0; k < 4; k++) {
    const p = pointOn(trunk, lerp(0.5, 0.95, k / 3))
    leaves.push({
      x: p.x, y: p.y, angle: (k % 2 ? 1 : -1) * r(50, 80), size: r(11, 13), shade: r(-0.5, 1), depth: 0,
      minAppear: 2.8, appear: lerp(2.8, 3, k / 3), vanish: r(4.5, 5.6), shape: lanceLeaf, droop: 0.5,
    })
  }

  // ── Hängende Ruten mit Blättern ───────────────────────────────────────────
  const strands: RawBranch[] = []
  for (const an of anchors) {
    const n = 2 + Math.floor(rnd() * 3)
    for (let i = 0; i < n; i++) {
      const s = an.side * (rnd() < 0.8 ? 1 : -1)
      const drop = Math.min(GROUND - 20 - an.y, r(45, 92))
      const strand: RawBranch = {
        pts: [
          an.x, an.y,
          an.x + s * r(6, 14), an.y - r(6, 14),
          an.x + s * r(14, 24), an.y + r(4, 12),
          an.x + s * r(14, 30), an.y + drop,
        ],
        width: r(1.1, 1.6), depth: 3, start: Math.max(an.start, r(3.1, 5)), span: 0.6, tone: 'twig',
      }
      strands.push(strand)
      const nl = 5 + Math.floor(rnd() * 3)
      for (let k = 0; k < nl; k++) {
        const t = Math.min(1, 0.2 + (0.8 * (k + r(0, 0.6))) / nl)
        const p = pointOn(strand, t)
        leaves.push({
          x: p.x, y: p.y, angle: p.angle + (k % 2 ? 1 : -1) * r(14, 34), size: r(9, 12), shade: r(-1, 1), depth: 3,
          minAppear: strand.start + strand.span * t, appear: 0, shape: lanceLeaf, droop: 0.4,
        })
      }
    }
  }
  branches.push(...strands)

  const f = makeFit(branches, leaves)
  scheduleLeaves(leaves, rnd, 2.85, 6, 1.35)

  // ── Kätzchen entlang der Ruten ────────────────────────────────────────────
  const spots = shuffle(strands.map((s) => ({ s, t: r(0.45, 0.95) })), rnd).slice(0, 34)
  const blossoms: Blossom[] = spots.map(({ s, t }, k) => {
    const p = pointOn(s, t)
    const size = r(5, 7) * f.fit
    const rot = r(-12, 12)
    return {
      id: k,
      x: r1(f.fx(p.x + r(-2, 2))),
      y: r1(f.fy(p.y + 2)),
      d: catkin(size, rot),
      size: r1(size),
      rot: Math.round(rot),
      shade: r(-1, 1),
      appear: Math.max(blossomTime(k, spots.length, 4), s.start + s.span * t + 0.05),
    }
  })
  blossoms.sort((a, b) => a.appear - b.appear)

  return { branches: finishBranches(branches, f), leaves: finishLeaves(leaves, f), blossoms, flare: flarePath(tw * f.fit) }
}

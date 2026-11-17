/**
 * Fünf weitere erfundene Arten (Grundlagen in futur.ts):
 *
 *   Luftqualle  – schwebt an einem Leuchtfaden; der Schirm baut sich in durchscheinenden
 *                 Schichten auf, Tentakel wachsen nach unten, an ihren Enden glüht es
 *   Helixranke  – zwei Stränge winden sich als Doppelhelix um einen Stab nach oben,
 *                 an den Kreuzungen leuchten Knoten, oben öffnet sich ein Stern
 *   Solarbaum   – Arme im rechten Winkel wie auf einer Platine, an ihren Enden falten
 *                 sich sechseckige Solarzellen auf, Energiepunkte an den Knicken
 *   Glutkoralle – dunkle Basaltkoralle mit glühenden Lavaadern, Polypen an den Spitzen
 *   Mondlilie   – ein gebogener Stiel mit hängenden Monden: vorn eine schmale Sichel,
 *                 zur Spitze hin bis zum Vollmond; drumherum Sterne
 */
import { lerp, mulberry32 } from '../rng'
import {
  BASE_X, GROUND, type Blossom, type PlantModel, type RawBranch, type RawLeaf, blossomTime, finishBranches, finishLeaves,
  makeFit, pointOn, scheduleLeaves, shuffle,
} from '../model'
import { blade, circle, hexPanel, lanceLeaf, moonPhase, mushroomCap, nub, pinna, r1, shard, star4, sunPetal } from '../shapes'
import { recursiveTree } from './recursive'
import { glowOrb, rad, sortByAppear } from './futur'

// ── Luftqualle ───────────────────────────────────────────────────────────────

export function qualle(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []

  const H = r(112, 124)
  const cx = BASE_X + r(-10, 10)
  const cy = GROUND - H
  // Leuchtfaden vom Boden zum Schirm
  branches.push({ pts: [BASE_X, GROUND, BASE_X + r(-14, 14), GROUND - H * 0.4, cx + r(-12, 12), cy + H * 0.25, cx, cy], width: 1.6, depth: 0, start: 2.45, span: 0.9, tone: 'neon' })
  // Wurzelkristalle am Boden
  for (let k = 0; k < 5; k++) {
    leaves.push({
      x: BASE_X + (k - 2) * 4, y: GROUND, angle: (k - 2) * 22, size: r(8, 12), shade: r(-1, 1), depth: 0, minAppear: 2.6,
      appear: lerp(2.6, 3.1, k / 4), tone: 'crystal', droop: 0, shape: shard, fixed: true,
    })
  }
  // Tentakel: wellig nach unten, unterschiedlich lang, nacheinander
  const W = r(30, 36)
  const n = 7
  const tips: { x: number; y: number; min: number }[] = []
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1) - 0.5) * 2
    const x0 = cx + u * W * 0.8
    const len = r(42, 70) * (1 - Math.abs(u) * 0.25)
    const sway = r(-10, 10)
    const st = 3.0 + Math.abs(u) * 0.6 + r(0, 1.4)
    const t: RawBranch = { pts: [x0, cy + 2, x0 + sway, cy + len * 0.35, x0 - sway, cy + len * 0.7, x0 + sway * 0.5, cy + len], width: 1.4, depth: 1, start: st, span: 0.7, tone: 'neon' }
    branches.push(t)
    for (let k = 1; k <= 6; k++) {
      const q = pointOn(t, k / 6.5)
      leaves.push({
        x: q.x, y: q.y, angle: 180 + (k % 2 ? 1 : -1) * r(30, 55), size: r(6, 9) * (1 - k * 0.07), shade: r(-1, 1), depth: 2,
        minAppear: st + 0.7 * (k / 6.5), appear: 0, tone: k % 3 === 0 ? 'glow' : 'frond', droop: 0, shape: pinna,
      })
    }
    tips.push({ x: t.pts[6], y: t.pts[7], min: st + 0.7 })
  }

  const f = makeFit(branches, leaves, [{ x: cx - W * 1.05, y: cy - W * 0.8 }, { x: cx + W * 1.05, y: cy - W * 0.8 }])
  scheduleLeaves(leaves, rnd, 3, 6, 1.2)

  const blossoms: Blossom[] = []
  const X = r1(f.fx(cx))
  const Y = r1(f.fy(cy))
  // Schirm in Schichten: innen leuchtend, außen durchscheinend
  const layers: [number, number, 'glow' | 'halo' | 'core'][] = [[0.42, 2.9, 'glow'], [0.7, 3.8, 'halo'], [0.88, 4.7, 'halo'], [1.05, 5.5, 'halo']]
  for (const [k, appear, tone] of layers) {
    const w = W * k * f.fit
    blossoms.push({ id: 0, x: X, y: Y, d: mushroomCap(w, w * 0.62), size: r1(w), rot: 0, shade: 0, appear, tone })
  }
  // Leuchtpunkte im Schirm
  for (let i = 0; i < 6; i++) glowOrb(blossoms, f, cx + (i - 2.5) * W * 0.22, cy - W * r(0.12, 0.38), r(1.3, 2), lerp(4.4, 6.2, i / 5), { core: 'core', halo: 1.8 })
  // Tentakelenden glühen zur vollen Blüte
  shuffle(tips, rnd).forEach((t, k, all) => glowOrb(blossoms, f, t.x, t.y, r(1.8, 2.6), Math.max(t.min + 0.2, lerp(5.9, 6.95, k / (all.length - 1))), { core: 'glow' }))

  return { branches: finishBranches(branches, f), leaves: finishLeaves(leaves, f), blossoms: sortByAppear(blossoms), stump: { trunk: 0.3, limbs: false } }
}

// ── Helixranke ───────────────────────────────────────────────────────────────

export function helix(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []

  const H = r(128, 142)
  const T0 = 2.45
  const TS = 2.9
  branches.push({ pts: [BASE_X, GROUND, BASE_X, GROUND - H / 2, BASE_X, GROUND - H], width: 2.6, depth: 0, start: T0, span: TS, tone: 'metal' })
  const turns = 3.2
  const A = r(15, 19)
  const steps = Math.round(turns * 4) // Viertelwindungen
  const nodes: { x: number; y: number; min: number }[] = []
  for (const phase of [0, Math.PI]) {
    for (let k = 0; k < steps; k++) {
      const a0 = phase + (k / 4) * Math.PI * 2
      const a1 = phase + ((k + 1) / 4) * Math.PI * 2
      const y0 = GROUND - 6 - (H - 10) * (k / steps)
      const y1 = GROUND - 6 - (H - 10) * ((k + 1) / steps)
      const amp = (y: number) => A * (0.55 + 0.45 * ((GROUND - y) / H))
      const x0 = BASE_X + Math.sin(a0) * amp(y0)
      const x1 = BASE_X + Math.sin(a1) * amp(y1)
      // Kontrollpunkte entlang der Tangente der Sinuswelle
      const k3 = (Math.PI / 2) / 3
      const c1x = x0 + Math.cos(a0) * amp(y0) * k3 * 1.6
      const c2x = x1 - Math.cos(a1) * amp(y1) * k3 * 1.6
      const t = k / steps
      branches.push({
        pts: [x0, y0, c1x, lerp(y0, y1, 0.33), c2x, lerp(y0, y1, 0.66), x1, y1], width: 2.2, depth: 1,
        start: T0 + TS * t + 0.05, span: TS / steps, tone: phase === 0 ? 'ring' : 'neon',
      })
      // Blattklingen an den äußeren Punkten
      if (Math.abs(Math.sin(a1)) > 0.9) {
        leaves.push({
          x: x1, y: y1, angle: Math.sign(Math.sin(a1)) * r(55, 80), size: r(10, 15), shade: r(-1, 1), depth: 2,
          minAppear: T0 + TS * ((k + 1) / steps), appear: 0, tone: 'glow', droop: 0.4, shape: blade,
        })
      }
      if (phase === 0 && Math.abs(Math.sin(a1)) < 0.1) nodes.push({ x: BASE_X, y: y1, min: T0 + TS * ((k + 1) / steps) })
    }
  }
  // kleine Triebe am Fuß
  for (let k = 0; k < 4; k++) {
    leaves.push({
      x: BASE_X, y: GROUND - 2, angle: (k < 2 ? -1 : 1) * r(30, 70), size: r(12, 16), shade: r(-1, 1), depth: 0, minAppear: 2.6,
      appear: lerp(2.6, 3, k / 3), vanish: r(4.6, 5.6), tone: 'glow', droop: 0.3, shape: blade,
    })
  }

  const top = { x: BASE_X, y: GROUND - H }
  const f = makeFit(branches, leaves, [{ x: top.x, y: top.y - 16 }])
  scheduleLeaves(leaves, rnd, 2.9, 6, 1.2)

  const blossoms: Blossom[] = []
  nodes.forEach((nd, k) => glowOrb(blossoms, f, nd.x, nd.y, r(2.2, 3), Math.max(nd.min + 0.1, blossomTime(k, nodes.length, 3, 4.3)), { core: k % 2 ? 'core' : 'glow' }))
  // Stern an der Spitze
  glowOrb(blossoms, f, top.x, top.y, 4, 5.9, { core: 'glow', halo: 2.8, center: 'pale' })
  const R = 6 * f.fit
  for (let i = 0; i < 8; i++) {
    const rot = i * 45
    blossoms.push({ id: 0, x: r1(f.fx(top.x)), y: r1(f.fy(top.y)), d: sunPetal(R, R * (i % 2 ? 1.1 : 1.9), rot), size: r1(R), rot, shade: r(-1, 1), appear: lerp(6.1, 6.9, i / 7), tone: 'glow' })
  }

  return { branches: finishBranches(branches, f), leaves: finishLeaves(leaves, f), blossoms: sortByAppear(blossoms), stump: { trunk: 0.4, limbs: false } }
}

// ── Solarbaum ────────────────────────────────────────────────────────────────

export function solar(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []
  const joints: { x: number; y: number; min: number }[] = []

  const H = r(96, 110)
  const T0 = 2.45
  const TS = 1.6
  branches.push({ pts: [BASE_X, GROUND, BASE_X, GROUND - H / 2, BASE_X, GROUND - H], width: 6, depth: 0, start: T0, span: TS, tone: 'metal' })
  const reach = (y: number) => T0 + TS * ((GROUND - y) / H)
  const line = (x0: number, y0: number, x1: number, y1: number, width: number, start: number, span: number) =>
    branches.push({ pts: [x0, y0, (x0 + x1) / 2, (y0 + y1) / 2, x1, y1], width, depth: 1, start, span, tone: 'metal' })
  /** Wabe aus Solarzellen um einen Punkt */
  const cluster = (x: number, y: number, min: number, n: number, size: number) => {
    const offs: [number, number][] = [[0, 0], [-0.87, 0.5], [0.87, 0.5], [0, -1], [-0.87, -0.5], [0.87, -0.5], [0, 1]]
    for (let k = 0; k < n; k++) {
      const [ox, oy] = offs[k]
      leaves.push({
        x: x + ox * size * 0.92, y: y + oy * size * 0.92 + size / 2, angle: 0, size, shade: r(-1, 1), depth: 2, minAppear: min, appear: 0,
        tone: k === 0 ? 'glow' : 'panel', droop: 0.2, shape: hexPanel,
      })
    }
  }

  // Arme: waagerecht hinaus, dann senkrecht hoch (Platinen-Look); oben kürzer
  const levels = 4
  for (let i = 0; i < levels; i++) {
    const y = GROUND - H * lerp(0.32, 0.92, i / (levels - 1))
    for (const side of [-1, 1]) {
      if (i === levels - 1 && side === 1) continue
      const out = r(22, 34) * (1 - i * 0.14)
      const up = r(12, 22)
      const st = reach(y) + r(0.05, 0.3)
      const xo = BASE_X + side * out
      line(BASE_X, y, xo, y, 3.2, st, 0.3)
      line(xo, y, xo, y - up, 3.2, st + 0.3, 0.25)
      joints.push({ x: xo, y, min: st + 0.3 })
      cluster(xo, y - up, st + 0.55, 4 + (rnd() < 0.5 ? 1 : 0) + (i < 2 ? 1 : 0), r(10, 12))
    }
  }
  // Krone oben
  cluster(BASE_X, GROUND - H, T0 + TS, 7, 12)
  // Jugendzellen am Fuß
  for (let k = 0; k < 3; k++) {
    leaves.push({ x: BASE_X + (k - 1) * 9, y: GROUND - 4, angle: (k - 1) * 18, size: 11, shade: 0, depth: 0, minAppear: 2.6, appear: lerp(2.6, 3, k / 2), vanish: r(4.6, 5.4), tone: 'panel', droop: 0, shape: hexPanel })
  }

  const f = makeFit(branches, leaves)
  scheduleLeaves(leaves, rnd, 2.9, 6, 1.25)

  const blossoms: Blossom[] = []
  shuffle(joints, rnd).forEach((j, k, all) => glowOrb(blossoms, f, j.x, j.y, r(2, 2.8), Math.max(j.min + 0.1, blossomTime(k, all.length, 3, 4.3)), { core: 'glow' }))
  // Energieströme: Punkte am Stamm, zur Blüte
  for (let k = 0; k < 6; k++) glowOrb(blossoms, f, BASE_X, GROUND - H * lerp(0.15, 0.95, k / 5), 1.8, lerp(5.6, 6.95, k / 5), { core: 'core', halo: 2 })

  return { branches: finishBranches(branches, f), leaves: finishLeaves(leaves, f), blossoms: sortByAppear(blossoms), stump: { trunk: 0.5, limbs: true } }
}

// ── Glutkoralle ──────────────────────────────────────────────────────────────

export const koralle = (seed: number): PlantModel =>
  recursiveTree(seed, {
    spread: [0.5, 0.7],
    ratio: [0.72, 0.8],
    upright: [0.05, 0.15],
    lean: [-0.1, 0.1],
    trunkLen: [30, 36],
    trunkWidth: [15, 18],
    leafSize: [4, 5.5],
    leafShape: nub,
    leafTone: 'ember',
    branchTone: () => 'metal',
    thirdChild: [0.5, 0.3],
    flare: false,
    blossom: { count: 34, early: 5, size: [3.4, 4.8], shape: (s) => circle(s), tone: 'glow', center: { f: 0.45, tone: 'pale' } },
    // Glühende Lavaader in jedem Ast
    extras: ({ branches }) => {
      const veins = branches.map((b) => ({ ...b, width: Math.max(0.9, b.width * 0.28), tone: 'ring' as const }))
      branches.push(...veins)
    },
  })

// ── Mondlilie ────────────────────────────────────────────────────────────────

export function mondlilie(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []

  const side = rnd() < 0.5 ? -1 : 1
  const H = r(108, 122)
  const reachX = side * r(46, 58)
  // gebogener Stiel: hoch und zur Seite überhängend
  const stem: RawBranch = {
    pts: [BASE_X, GROUND, BASE_X - side * 6, GROUND - H * 0.8, BASE_X + reachX * 0.6, GROUND - H * 1.05, BASE_X + reachX, GROUND - H * 0.62],
    width: 3.4, depth: 0, start: 2.45, span: 2.4, tone: 'crystal',
  }
  branches.push(stem)
  // Rosette aus langen Leuchtblättern am Fuß
  for (let k = 0; k < 9; k++) {
    const u = (k / 8 - 0.5) * 2
    leaves.push({
      x: BASE_X + u * 4, y: GROUND - 1, angle: u * r(40, 62), size: r(24, 34) * (1 - Math.abs(u) * 0.3), shade: r(-1, 1), depth: 1,
      minAppear: 2.5, appear: 0, tone: k % 3 === 0 ? 'glow' : 'frond', droop: 0.7, shape: lanceLeaf,
    })
  }
  // kleine Blätter am Stiel
  for (let k = 0; k < 6; k++) {
    const t = lerp(0.15, 0.6, k / 5)
    const q = pointOn(stem, t)
    leaves.push({
      x: q.x, y: q.y, angle: q.angle + (k % 2 ? 1 : -1) * r(40, 65), size: r(9, 13), shade: r(-1, 1), depth: 2,
      minAppear: stem.start + stem.span * t, appear: 0, tone: 'frond', droop: 0.6, shape: lanceLeaf,
    })
  }
  const f = makeFit(branches, leaves, [{ x: BASE_X + reachX + side * 10, y: GROUND - H * 1.1 }, { x: BASE_X - side * 20, y: GROUND - H * 1.1 }])
  scheduleLeaves(leaves, rnd, 2.8, 5.8, 1.2)

  const blossoms: Blossom[] = []
  // Monde hängen unter dem Bogen: von der schmalen Sichel bis zum Vollmond an der Spitze
  const n = 6
  for (let k = 0; k < n; k++) {
    const t = lerp(0.48, 1, k / (n - 1))
    const q = pointOn(stem, t)
    const size = lerp(5.5, 9, k / (n - 1)) * f.fit
    const x = q.x
    const y = q.y + size / f.fit + 4
    const appear = Math.max(stem.start + stem.span * t + 0.1, lerp(3.6, 6.2, k / (n - 1)))
    const X = r1(f.fx(x))
    const Y = r1(f.fy(y))
    blossoms.push({ id: 0, x: X, y: Y, d: circle(size * 1.75), size: r1(size), rot: 0, shade: 0, appear, tone: 'halo' })
    // dunkle Seite des Mondes, schwach sichtbar
    blossoms.push({ id: 0, x: X, y: Y, d: circle(size), size: r1(size), rot: 0, shade: 0, appear, tone: 'halo' })
    blossoms.push({ id: 0, x: X, y: Y, d: moonPhase(size, lerp(0.12, 1, k / (n - 1))), size: r1(size), rot: 0, shade: r(-0.5, 0.5), appear: appear + 0.01, tone: 'core' })
    // Faden zum Stiel
    blossoms.push({ id: 0, x: X, y: Y, d: `M-0.4 ${r1(-size)}L0.4 ${r1(-size)}L0.3 ${r1(-size - 4 * f.fit)}L-0.3 ${r1(-size - 4 * f.fit)}Z`, size: 1, rot: 0, shade: 0, appear, tone: 'glow' })
  }
  // Sterne rund um die Pflanze
  for (let k = 0; k < 10; k++) {
    const a = rad(lerp(-80, 80, k / 9) + r(-8, 8))
    const dist = r(40, 70)
    const x = BASE_X + Math.sin(a) * dist + reachX * 0.3
    const y = GROUND - H * 0.75 - Math.cos(a) * dist * 0.6
    const s = r(1.6, 2.8) * f.fit
    blossoms.push({ id: 0, x: r1(f.fx(x)), y: r1(f.fy(y)), d: star4(s * 1.8), size: r1(s), rot: 0, shade: 0, appear: lerp(5, 6.95, k / 9), tone: k % 3 === 0 ? 'glow' : 'core' })
  }

  return { branches: finishBranches(branches, f), leaves: finishLeaves(leaves, f), blossoms: sortByAppear(blossoms), stump: { trunk: 0.35, limbs: false } }
}

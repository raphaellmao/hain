/**
 * Futuristische Arten – erfunden, nicht aus der Natur. Sie leuchten in einem Ton
 * nahe der Habit-Farbe (palette.ts: neon, crystal, glow, halo), welk verlieren
 * sie „Energie“ statt Farbe. Jede entwickelt sich auf ihre eigene Art:
 *
 *   Kristallbaum  – kantige Glieder wachsen in festen Winkeln, Splitter setzen an,
 *                   zur Blüte leuchten Kristallbüschel mit pulsierendem Schein
 *   Lumenpilz     – ein Turm aus Schirmen, einer nach dem anderen; Leuchtfäden
 *                   hängen herab, Punkte glühen auf, Sporen schweben
 *   Orbitalblume  – um einen Energiekern zeichnen sich Ringe selbst, Monde
 *                   kreisen darauf, zuletzt öffnen sich Klingen um den Kern
 *   Neonfarn      – eingerollte Wedel entrollen sich, Fieder für Fieder;
 *                   die Spitzen verschwinden beim Entrollen, Sporen leuchten
 */
import { lerp, mulberry32 } from '../rng'
import {
  BASE_X, GROUND, type Blossom, type BlossomTone, type CenterTone, type PlantModel, type RawBranch, type RawLeaf, blossomTime,
  finishBranches, finishLeaves, makeFit, pointOn, scheduleLeaves, shuffle, type Fit,
} from '../model'
import {
  blade, capSpots, circle, crystalCluster, crystalFacets, fiddlehead, gills, mushroomCap, pinna, r1, shard, sunPetal,
} from '../shapes'

export const rad = (deg: number) => (deg * Math.PI) / 180

/** Leuchtpunkt: durchscheinender, pulsierender Schein und heller Kern darüber */
export function glowOrb(
  out: Blossom[], f: Fit, x: number, y: number, size: number, appear: number,
  opts: { core?: BlossomTone; halo?: number; center?: CenterTone } = {},
) {
  const s = size * f.fit
  const X = r1(f.fx(x))
  const Y = r1(f.fy(y))
  // Schattierung aus der Lage: Bei mehrfarbigen Farben (Regenbogen …) leuchtet jeder Punkt anders
  const shade = Math.round((((Math.abs(X * 7.3 + Y * 13.1) % 200) / 100) - 1) * 100) / 100
  out.push({ id: out.length, x: X, y: Y, d: circle(s * (opts.halo ?? 2.2)), size: r1(s), rot: 0, shade, appear, tone: 'halo' })
  const core: Blossom = { id: out.length, x: X, y: Y, d: circle(s), size: r1(s), rot: 0, shade, appear: appear + 0.01, tone: opts.core ?? 'glow' }
  if (opts.center) core.center = { r: r1(s * 0.45), tone: opts.center }
  out.push(core)
}

export const sortByAppear = (b: Blossom[]) => b.sort((x, y) => x.appear - y.appear).map((x, id) => ({ ...x, id }))

// ── Kristallbaum ─────────────────────────────────────────────────────────────

export function kristall(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []
  const tips: { x: number; y: number; min: number }[] = []
  // Winkel rasten in 15°-Schritten ein: Das macht die Kanten kristallin
  const snap = (a: number) => Math.round(a / 15) * 15
  const WIN = [2.45, 3.0, 3.5, 4.0]
  const SPAN = [0.35, 0.4, 0.45, 0.5]

  function seg(x: number, y: number, ang: number, len: number, width: number, depth: number, start: number) {
    const x2 = x + Math.sin(rad(ang)) * len
    const y2 = y - Math.cos(rad(ang)) * len
    const b: RawBranch = { pts: [x, y, (x + x2) / 2, (y + y2) / 2, x2, y2], width, depth: Math.min(depth, 3), start, span: SPAN[Math.min(depth, 3)], tone: 'crystal' }
    branches.push(b)
    // Leuchtader im Inneren des Glieds
    branches.push({ ...b, width: Math.max(1, width * 0.22), tone: 'neon' })
    // Splitter entlang des Glieds
    const n = depth === 0 ? 2 : 1 + (rnd() < 0.5 ? 1 : 0)
    for (let k = 0; k < n; k++) {
      const t = r(0.35, 0.95)
      const side = k % 2 ? 1 : -1
      leaves.push({
        x: lerp(x, x2, t), y: lerp(y, y2, t), angle: snap(ang + side * r(35, 65)), size: r(12, 17) * (1 - depth * 0.1), shade: r(-1, 1),
        depth, minAppear: b.start + b.span * t, appear: 0, tone: rnd() < 0.22 ? 'glow' : 'crystal', droop: 0.3, shape: shard,
      })
    }
    return { x2, y2, end: b.start + b.span }
  }

  // Stamm aus drei Gliedern, jedes leicht geknickt; an jedem Gelenk Seitenäste
  let x = BASE_X
  let y = GROUND
  let ang = snap(r(-15, 15))
  let start = WIN[0]
  const w0 = r(9, 11)
  for (let j = 0; j < 3; j++) {
    const len = r(30, 38) * (1 - j * 0.12)
    const s = seg(x, y, ang, len, w0 * (1 - j * 0.2), 0, start)
    x = s.x2
    y = s.y2
    start = s.end
    // Jugend-Splitter am Fuß: machen den kleinen Spross sichtbar, verschwinden später
    if (j === 0) {
      for (let k = 0; k < 4; k++) {
        leaves.push({
          x: lerp(BASE_X, x, 0.3 + k * 0.15), y: lerp(GROUND, y, 0.3 + k * 0.15), angle: snap((k % 2 ? 1 : -1) * r(30, 60)), size: r(11, 14),
          shade: r(-1, 1), depth: 0, minAppear: 2.8, appear: lerp(2.8, 3, k / 3), vanish: r(4.6, 5.6), tone: 'crystal', droop: 0.3, shape: shard,
        })
      }
    }
    const sides = j === 2 ? [-1, 0, 1] : [-1, 1]
    for (const side of sides) {
      grow(x, y, snap(ang + side * r(30, 60)), r(30, 38) * (1 - j * 0.1), w0 * 0.6, 1, start + r(0.05, 0.4))
    }
    ang = snap(ang + r(-15, 15))
  }

  function grow(x0: number, y0: number, a: number, len: number, width: number, depth: number, st: number) {
    const s = seg(x0, y0, a, len, width, depth, Math.max(st, WIN[depth] + rnd() * 0.3))
    if (depth >= 2 || len < 14) {
      tips.push({ x: s.x2, y: s.y2, min: s.end })
      // Splitterkrone an der Spitze: zwei seitlich, einer leuchtend in der Mitte
      for (let k = 0; k < 3; k++) {
        leaves.push({
          x: s.x2, y: s.y2, angle: snap(a + (k - 1) * r(25, 40)), size: r(14, 19) * (k === 1 ? 1.2 : 1), shade: r(-1, 1), depth: 3,
          minAppear: s.end, appear: 0, tone: k === 1 ? 'glow' : 'crystal', droop: 0.3, shape: shard,
        })
      }
      return
    }
    const n = rnd() < 0.3 ? 3 : 2
    for (let i = 0; i < n; i++) {
      const off = (i / (n - 1) - 0.5) * 2
      grow(s.x2, s.y2, snap(a + off * r(30, 45)), len * r(0.7, 0.82), width * 0.68, depth + 1, s.end)
    }
  }

  const f = makeFit(branches, leaves)
  scheduleLeaves(leaves, rnd, 2.85, 6, 1.4)

  // Leuchtende Kristallbüschel an den Spitzen, mit pulsierendem Schein
  const blossoms: Blossom[] = []
  shuffle(tips, rnd).forEach((t, k, all) => {
    const appear = Math.max(blossomTime(k, all.length, 3, 4.4), t.min + 0.05)
    const size = r(5.5, 7.5) * f.fit
    const rot = r(-12, 12)
    const X = r1(f.fx(t.x))
    const Y = r1(f.fy(t.y))
    blossoms.push({ id: 0, x: X, y: Y, d: circle(size * 1.5), size: r1(size), rot: 0, shade: 0, appear, tone: 'halo' })
    blossoms.push({
      id: 0, x: X, y: Y, d: crystalCluster(size, rot), size: r1(size), rot: Math.round(rot), shade: r(-1, 1), appear: appear + 0.01,
      tone: 'glow', lines: crystalFacets(size, rot), center: { r: r1(size * 0.16), tone: 'pale' },
    })
  })

  return {
    branches: finishBranches(branches, f),
    leaves: finishLeaves(leaves, f),
    blossoms: sortByAppear(blossoms),
    stump: { trunk: 0.5, limbs: true },
  }
}

// ── Lumenpilz ────────────────────────────────────────────────────────────────

export function lumenpilz(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []

  const H = r(118, 132)
  const sway = r(-10, 10)
  const stalk: RawBranch = {
    pts: [BASE_X, GROUND, BASE_X - sway * 0.6, GROUND - H * 0.35, BASE_X + sway, GROUND - H * 0.7, BASE_X + sway * 0.4, GROUND - H],
    width: r(7, 8.5), depth: 0, start: 2.45, span: 2.9, tone: 'crystal',
  }
  branches.push(stalk)
  const reach = (t: number) => stalk.start + stalk.span * t

  // Schirme von unten nach oben, oben kleiner (Pagode). Jeder erscheint, sobald der Stiel ihn erreicht.
  const nCaps = 4 + (rnd() < 0.5 ? 1 : 0)
  const caps: { x: number; y: number; w: number; h: number; appear: number }[] = []
  for (let k = 0; k < nCaps; k++) {
    const t = lerp(0.3, 1, k / (nCaps - 1))
    const p = pointOn(stalk, t)
    const w = lerp(44, 18, k / (nCaps - 1)) * r(0.92, 1.08)
    caps.push({ x: p.x, y: p.y, w, h: w * r(0.42, 0.55), appear: Math.max(2.9, reach(t) + 0.04) })
    // Leuchtfäden hängen vom Rand des Schirms
    const nFil = Math.round(lerp(9, 4, k / (nCaps - 1)))
    for (let i = 0; i < nFil; i++) {
      const u = lerp(-0.92, 0.92, nFil > 1 ? i / (nFil - 1) : 0.5)
      leaves.push({
        x: p.x + u * w, y: p.y + 2 + Math.abs(u) * -2, angle: 180 + u * 14 + r(-6, 6), size: r(7, 13) * (1 - k * 0.08), shade: r(-1, 1),
        depth: 1, minAppear: Math.max(2.9, reach(t) + 0.1), appear: 0, tone: 'glow', droop: 0, shape: pinna,
      })
    }
  }
  // Kleine Seitenpilze am Fuß – sie machen den Anfang sichtbar und bleiben
  for (const side of [-1, 1]) {
    const len = r(16, 22)
    const b: RawBranch = {
      pts: [BASE_X + side * 6, GROUND, BASE_X + side * 12, GROUND - len * 0.5, BASE_X + side * 14, GROUND - len],
      width: 3, depth: 1, start: 2.6, span: 0.4, tone: 'crystal',
    }
    branches.push(b)
    caps.push({ x: b.pts[4], y: b.pts[5], w: r(9, 11), h: r(5, 6), appear: 3 })
  }

  const extra = caps.flatMap((c) => [{ x: c.x - c.w, y: c.y - c.h * 1.3 }, { x: c.x + c.w, y: c.y - c.h * 1.3 }])
  const f = makeFit(branches, leaves, extra)
  scheduleLeaves(leaves, rnd, 2.9, 6, 1.2)

  const blossoms: Blossom[] = []
  // Zeichenreihenfolge: hinten (unten) zuerst, damit obere Schirme die Fäden der unteren nicht verdecken
  for (const c of [...caps].sort((a, b) => b.y - a.y)) {
    const w = c.w * f.fit
    const h = c.h * f.fit
    const X = r1(f.fx(c.x))
    const Y = r1(f.fy(c.y))
    blossoms.push({ id: 0, x: X, y: Y, d: mushroomCap(w, h), size: r1(w), rot: 0, shade: r(-0.6, 0.6), appear: c.appear, tone: 'glow', lines: gills(w, h) })
    // Leuchtpunkte glühen später auf (ab „Großer Schirmturm“)
    blossoms.push({ id: 0, x: X, y: Y, d: capSpots(w, h, seed % 97), size: r1(w * 0.1), rot: 0, shade: 0, appear: Math.max(c.appear + 0.3, r(4.6, 6.2)), tone: 'core' })
  }
  // Schwebende Sporen rund um den Turm, zur vollen Blüte
  const n = 12
  for (let i = 0; i < n; i++) {
    const t = r(0.25, 1.05)
    const p = pointOn(stalk, Math.min(1, t))
    const side = i % 2 ? 1 : -1
    glowOrb(blossoms, f, p.x + side * r(18, 46), p.y - r(0, 22), r(1.6, 2.6), lerp(5.4, 6.95, i / (n - 1)), { core: 'core' })
  }

  return {
    branches: finishBranches(branches, f),
    leaves: finishLeaves(leaves, f),
    blossoms: sortByAppear(blossoms),
    stump: { trunk: 0.4, limbs: false },
  }
}

// ── Orbitalblume ─────────────────────────────────────────────────────────────

/** Ellipse (Mittelpunkt cx/cy, Radien rx/ry, gekippt um tilt Grad) als vier kubische Viertel */
function ellipseQuarters(cx: number, cy: number, rx: number, ry: number, tilt: number, from: number): number[][] {
  const k = 0.5523
  const ct = Math.cos(rad(tilt))
  const st = Math.sin(rad(tilt))
  const tr = (x: number, y: number) => [cx + x * ct - y * st, cy + x * st + y * ct]
  const E = (t: number) => [rx * Math.cos(t), ry * Math.sin(t)]
  const D = (t: number) => [-rx * Math.sin(t), ry * Math.cos(t)]
  const out: number[][] = []
  for (let q = 0; q < 4; q++) {
    const a = rad(from) + (q * Math.PI) / 2
    const b = a + Math.PI / 2
    const [x0, y0] = E(a)
    const [x3, y3] = E(b)
    const [dx0, dy0] = D(a)
    const [dx3, dy3] = D(b)
    out.push([...tr(x0, y0), ...tr(x0 + k * dx0, y0 + k * dy0), ...tr(x3 - k * dx3, y3 - k * dy3), ...tr(x3, y3)])
  }
  return out
}

export function orbital(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []

  const H = r(92, 106)
  const lean = r(-8, 8)
  const stem: RawBranch = {
    pts: [BASE_X, GROUND, BASE_X + lean * 0.2, GROUND - H * 0.4, BASE_X + lean, GROUND - H * 0.75, BASE_X + lean * 0.8, GROUND - H],
    width: r(3.2, 4), depth: 0, start: 2.45, span: 1.4, tone: 'metal',
  }
  branches.push(stem)
  // Energieklingen am Stiel
  let side = rnd() < 0.5 ? -1 : 1
  for (let k = 0; k < 12; k++) {
    const t = lerp(0.08, 0.8, k / 11)
    const p = pointOn(stem, t)
    leaves.push({
      x: p.x, y: p.y, angle: p.angle + side * r(30, 62), size: lerp(26, 13, t) * r(0.9, 1.1), shade: r(-1, 1), depth: 1,
      minAppear: stem.start + stem.span * t, appear: 0, tone: 'glow', droop: 0.6, shape: blade,
    })
    side = -side
  }

  // Ringe um den Kern: zeichnen sich nacheinander selbst
  const core = pointOn(stem, 1)
  const cy = core.y - 6
  const nRings = 2 + (rnd() < 0.55 ? 1 : 0)
  const rings: { rx: number; ry: number; tilt: number; from: number; done: number }[] = []
  for (let i = 0; i < nRings; i++) {
    const rx = r(30, 36) + i * 9
    const ry = r(8, 12) + i * 2
    const tilt = (i % 2 ? 1 : -1) * r(10, 28)
    const from = r(0, 360)
    const st = [3.6, 4.5, 5.3][i]
    ellipseQuarters(core.x, cy, rx, ry, tilt, from).forEach((pts, q) => {
      branches.push({ pts, width: 1.7 - i * 0.2, depth: 2, start: st + q * 0.18, span: 0.18, tone: 'ring' })
    })
    rings.push({ rx, ry, tilt, from, done: st + 0.75 })
  }

  const extra = rings.flatMap((g) => [{ x: core.x - g.rx - 6, y: cy - g.rx * 0.5 }, { x: core.x + g.rx + 6, y: cy - g.rx * 0.5 }])
  extra.push({ x: core.x, y: cy - 34 })
  const f = makeFit(branches, leaves, extra)
  scheduleLeaves(leaves, rnd, 2.85, 5.6, 1.2)

  const blossoms: Blossom[] = []
  // Kern: erst klein (Knospe), wird zur Blüte groß
  glowOrb(blossoms, f, core.x, cy, 4.5, 2.95, { core: 'glow', halo: 2, center: 'pale' })
  glowOrb(blossoms, f, core.x, cy, 7.5, 4.9, { core: 'glow', halo: 2.6, center: 'pale' })
  // Monde auf den Ringen
  rings.forEach((g, i) => {
    const n = 3 + i
    for (let k = 0; k < n; k++) {
      const t = rad(g.from + (360 / n) * k + r(-15, 15))
      const ct = Math.cos(rad(g.tilt))
      const st = Math.sin(rad(g.tilt))
      const x = g.rx * Math.cos(t)
      const y = g.ry * Math.sin(t)
      glowOrb(blossoms, f, core.x + x * ct - y * st, cy + x * st + y * ct, r(2, 3.2), Math.max(g.done, lerp(g.done, 6.9, k / n)), { core: k % 2 ? 'core' : 'glow' })
    }
  })
  // Klingen um den Kern öffnen sich zur vollen Blüte
  const petals = 10
  const R = 9 * f.fit
  const X = r1(f.fx(core.x))
  const Y = r1(f.fy(cy))
  for (let i = 0; i < petals; i++) {
    const rot = (360 / petals) * i + r(-4, 4)
    blossoms.push({ id: 0, x: X, y: Y, d: sunPetal(R, R * r(1.3, 1.7), rot), size: r1(R), rot: Math.round(rot), shade: r(-1, 1), appear: lerp(5.8, 6.85, i / (petals - 1)), tone: 'glow' })
  }

  return {
    branches: finishBranches(branches, f),
    leaves: finishLeaves(leaves, f),
    blossoms: sortByAppear(blossoms),
    stump: { trunk: 0.5, limbs: false },
  }
}

// ── Neonfarn ─────────────────────────────────────────────────────────────────

export function neonfarn(seed: number): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []
  const sori: { x: number; y: number; min: number }[] = []
  const tips: { x: number; y: number; min: number }[] = []

  const n = 7 + Math.floor(rnd() * 3)
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1)
    const ang = lerp(-62, 62, u) + r(-6, 6)
    const len = r(84, 104) * (1 - Math.abs(ang) / 260)
    const a = rad(ang)
    const x0 = BASE_X + Math.sin(a) * 4
    const ex = BASE_X + Math.sin(a) * len * 0.95
    const ey = GROUND - Math.cos(a) * len * 0.82
    const cx = BASE_X + Math.sin(a) * len * 0.3
    const cyy = GROUND - len * 0.95
    // mittlere Wedel zuerst, äußere später
    const order = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2)
    const start = 2.6 + order * r(1.7, 2.2)
    const frond: RawBranch = { pts: [x0, GROUND, cx, cyy, ex, ey], width: 2.6, depth: order < 0.4 ? 0 : 1, start, span: 0.55, tone: 'neon' }
    branches.push(frond)
    // Eingerollter Trieb steht am Boden, bis sich der Wedel entrollt – dann ist er weg
    const tip = pointOn(frond, 1)
    leaves.push({
      x: BASE_X + Math.sin(a) * 12, y: GROUND - 1, angle: ang * 0.4, size: r(13, 16), shade: 0, depth: 2, minAppear: start - 0.45,
      appear: Math.max(2.45, start - 0.45), vanish: start + 0.2, tone: 'glow', droop: 0, shape: fiddlehead, fixed: true,
    })
    tips.push({ x: tip.x, y: tip.y, min: start + frond.span })
    // Fiedern beidseitig, zur Spitze kleiner
    const pairs = 10
    for (let k = 0; k < pairs; k++) {
      const t = lerp(0.2, 0.96, k / (pairs - 1))
      const q = pointOn(frond, t)
      for (const s2 of [-1, 1]) {
        // Fiedern wachsen mit ihrem Wedel, nicht über Wochen verteilt – sonst stünden lange kahle Bögen da
        const at = start + frond.span * t
        leaves.push({
          x: q.x, y: q.y, angle: q.angle + s2 * r(62, 80), size: lerp(16, 6, t) * r(0.9, 1.1), shade: r(-1, 1), depth: 2,
          minAppear: at, appear: at + r(0.02, 0.3), tone: 'frond', droop: 0.7, shape: pinna, fixed: true,
        })
      }
      if (k % 3 === 1) sori.push({ x: q.x, y: q.y + 2, min: start + frond.span * t })
    }
  }

  const f = makeFit(branches, leaves)
  scheduleLeaves(leaves, rnd, 2.85, 6, 1.3)

  const blossoms: Blossom[] = []
  // Sporen leuchten nach und nach auf, zur Blüte strahlen die Wedelspitzen
  shuffle(sori, rnd).forEach((s, k, all) => {
    const appear = Math.max(blossomTime(k, all.length, 6, 4.3, 5.9), s.min + 0.1)
    glowOrb(blossoms, f, s.x, s.y, r(1.5, 2.2), appear, { core: 'core', halo: 2 })
  })
  shuffle(tips, rnd).forEach((t, k, all) => {
    glowOrb(blossoms, f, t.x, t.y, r(2.6, 3.4), Math.max(t.min + 0.3, lerp(6, 6.95, k / Math.max(1, all.length - 1))), { core: 'glow', halo: 2.6, center: 'pale' })
  })

  return {
    branches: finishBranches(branches, f),
    leaves: finishLeaves(leaves, f),
    blossoms: sortByAppear(blossoms),
    stump: { trunk: 0.35, limbs: false },
  }
}

/**
 * Gemeinsames Modell aller Pflanzenarten.
 *
 * Jede Art (species/*.ts) erzeugt aus einem Seed einmalig die *ausgewachsene*
 * Pflanze: Äste/Stängel (Striche), Blätter und Blüten/Früchte. Jedes Element
 * trägt einen Wachstumswert (`appear` bzw. `start` + `span`), ab dem es zu
 * sehen ist. Tree.tsx zeigt nur, was zum aktuellen Wachstum g passt.
 *
 * Koordinaten: viewBox 0 0 200 200, Stammfuß bei (100, GROUND), y wächst
 * nach unten (SVG-Konvention), Winkel 0 = senkrecht nach oben.
 */
import { r1 } from './shapes'

export const VIEW = 200
export const BASE_X = 100
export const GROUND = 178

/** Farbrolle eines Strichs – die Farbe selbst kommt aus palette.ts */
export type BranchTone = 'bark' | 'birch' | 'mark' | 'twig' | 'stem' | 'cactus' | 'rib'
export type LeafTone = 'leaf' | 'needle' | 'spine'
export type BlossomTone = 'accent' | 'green' | 'brown'
export type CenterTone = 'yellow' | 'brown' | 'pale'

export interface Branch {
  id: number
  /** SVG-Pfad (quadratische oder kubische Kurve) */
  d: string
  width: number
  depth: number
  /** ab diesem g beginnt der Strich zu wachsen … */
  start: number
  /** … und ist nach `span` voll ausgewachsen */
  span: number
  tone?: BranchTone
}

export interface Leaf {
  id: number
  x: number
  y: number
  /** Form, Ansatz bei (0, 0) */
  d: string
  /** Grad, 0 = nach oben, positiv = im Uhrzeigersinn */
  angle: number
  size: number
  /** −1 … 1, für leichte Farbvariation */
  shade: number
  appear: number
  /** Jugendblätter verschwinden wieder, wenn die Krone dicht wird */
  vanish?: number
  tone?: LeafTone
  /** wie stark das Blatt beim Welken hängt (Standard 1, Tannen-Etagen 0) */
  droop?: number
}

export interface Blossom {
  id: number
  x: number
  y: number
  d: string
  size: number
  rot: number
  shade: number
  appear: number
  tone?: BlossomTone
  /** Blütenmitte (Radius absolut) – fehlt bei Früchten, Zapfen, Kätzchen */
  center?: { r: number; tone: CenterTone }
  /** heller Glanz (z. B. auf dem Apfel) */
  shine?: string
  /** dunkle Linien (Stiel, Zapfenschuppen) */
  lines?: string
  /** dunkle Punkte (Samen der Sonnenblume) */
  dots?: string
}

export interface PlantModel {
  branches: Branch[]
  leaves: Leaf[]
  blossoms: Blossom[]
  /** verbreiterter Stammfuß (fehlt bei Kaktus und Sonnenblume) */
  flare?: string
  /** Kahl: wie viel vom Stamm stehen bleibt (0 … 1) und ob Aststummel bleiben */
  stump?: { trunk: number; limbs: boolean }
}

// ── Rohdaten während der Erzeugung (noch nicht eingepasst) ──────────────────

export interface RawBranch {
  /** Punkte: [x1,y1, cx,cy, x2,y2] (Q) oder [x1,y1, c1x,c1y, c2x,c2y, x2,y2] (C) */
  pts: number[]
  width: number
  depth: number
  start: number
  span: number
  tone?: BranchTone
}

export interface RawLeaf {
  x: number
  y: number
  angle: number
  size: number
  shade: number
  depth: number
  /** frühestens sichtbar, wenn der tragende Ast bis hierhin gewachsen ist */
  minAppear: number
  appear: number
  vanish?: number
  /** fester Zeitpunkt – wird von scheduleLeaves nicht umverteilt */
  fixed?: boolean
  tone?: LeafTone
  droop?: number
  shape: (s: number) => string
}

/** Punkt auf einer quadratischen Bézierkurve bei t ∈ [0, 1] */
export function quadPoint(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number) {
  const u = 1 - t
  return { x: u * u * x1 + 2 * u * t * cx + t * t * x2, y: u * u * y1 + 2 * u * t * cy + t * t * y2 }
}

/** Punkt und Richtung (Grad) auf einem Roh-Strich bei t */
export function pointOn(b: RawBranch, t: number): { x: number; y: number; angle: number } {
  const q = b.pts
  const u = 1 - t
  if (q.length === 6) {
    const pt = quadPoint(q[0], q[1], q[2], q[3], q[4], q[5], t)
    const dx = 2 * u * (q[2] - q[0]) + 2 * t * (q[4] - q[2])
    const dy = 2 * u * (q[3] - q[1]) + 2 * t * (q[5] - q[3])
    return { ...pt, angle: (Math.atan2(dx, -dy) * 180) / Math.PI }
  }
  const x = u ** 3 * q[0] + 3 * u * u * t * q[2] + 3 * u * t * t * q[4] + t ** 3 * q[6]
  const y = u ** 3 * q[1] + 3 * u * u * t * q[3] + 3 * u * t * t * q[5] + t ** 3 * q[7]
  const dx = 3 * u * u * (q[2] - q[0]) + 6 * u * t * (q[4] - q[2]) + 3 * t * t * (q[6] - q[4])
  const dy = 3 * u * u * (q[3] - q[1]) + 6 * u * t * (q[5] - q[3]) + 3 * t * t * (q[7] - q[5])
  return { x, y, angle: (Math.atan2(dx, -dy) * 180) / Math.PI }
}

export const deg = (rad: number) => (rad * 180) / Math.PI

/**
 * Blätter gleichmäßig über das Wachstum verteilen: Rang i bekommt
 * from + (to − from) · (i/n)^curve, aber nie vor seinem Ast.
 * Ein Exponent > 1 legt mehr Blätter an den Anfang.
 */
export function scheduleLeaves(leaves: RawLeaf[], rnd: () => number, from: number, to: number, curve: number) {
  const sorted = leaves
    .filter((l) => l.vanish === undefined && !l.fixed)
    .map((l) => ({ l, key: l.minAppear + rnd() * 0.15 }))
    .sort((a, b) => a.key - b.key)
  sorted.forEach(({ l }, i) => {
    const u = sorted.length > 1 ? i / (sorted.length - 1) : 0
    l.appear = Math.max(l.minAppear, from + (to - from) * Math.pow(u, curve))
  })
}

/** Zeitplan für Blüten: `early` vereinzelt zwischen earlyFrom/earlyTo, der Rest ab g = 6 bis kurz vor 7. */
export function blossomTime(k: number, total: number, early: number, earlyFrom = 4.1, earlyTo = 5.9): number {
  if (k < early) return early === 1 ? earlyFrom : earlyFrom + (earlyTo - earlyFrom) * (k / (early - 1))
  return 6 + 0.97 * ((k - early) / Math.max(1, total - early - 1))
}

export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Einpassen in die viewBox ─────────────────────────────────────────────────

export interface Fit {
  fit: number
  fx: (x: number) => number
  fy: (y: number) => number
}

/** Skalierung um den Stammfuß, sodass alles in die viewBox passt. */
export function makeFit(branches: RawBranch[], leaves: RawLeaf[], extra: { x: number; y: number }[] = []): Fit {
  let minX = BASE_X, maxX = BASE_X, minY = GROUND
  for (const b of branches) {
    // Für quadratische Kurven: Kontroll- und Endpunkt (wie ursprünglich), sonst alle Punkte
    const idx = b.pts.length === 6 ? [2, 4] : [2, 4, 6]
    for (const i of idx) {
      minX = Math.min(minX, b.pts[i]); maxX = Math.max(maxX, b.pts[i]); minY = Math.min(minY, b.pts[i + 1])
    }
  }
  for (const l of leaves) {
    minX = Math.min(minX, l.x - l.size); maxX = Math.max(maxX, l.x + l.size); minY = Math.min(minY, l.y - l.size)
  }
  for (const e of extra) {
    minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x); minY = Math.min(minY, e.y)
  }
  const fit = Math.min(
    1.4,
    (GROUND - 10) / (GROUND - minY),
    (BASE_X - 8) / Math.max(1, BASE_X - minX),
    (VIEW - 8 - BASE_X) / Math.max(1, maxX - BASE_X),
  )
  return { fit, fx: (x) => BASE_X + (x - BASE_X) * fit, fy: (y) => GROUND + (y - GROUND) * fit }
}

/** Rohdaten → fertige Äste und Blätter (eingepasst, Pfade erzeugt) */
export function finishBranches(branches: RawBranch[], f: Fit): Branch[] {
  return branches.map((b, id) => {
    const q = b.pts
    const P = (i: number) => `${r1(f.fx(q[i]))} ${r1(f.fy(q[i + 1]))}`
    const d = q.length === 6 ? `M${P(0)} Q${P(2)} ${P(4)}` : `M${P(0)} C${P(2)} ${P(4)} ${P(6)}`
    const out: Branch = { id, d, width: r1(b.width * f.fit), depth: b.depth, start: b.start, span: b.span }
    if (b.tone) out.tone = b.tone
    return out
  })
}

export function finishLeaves(leaves: RawLeaf[], f: Fit): Leaf[] {
  return leaves.map((l, id) => {
    const out: Leaf = {
      id,
      x: r1(f.fx(l.x)),
      y: r1(f.fy(l.y)),
      d: l.shape(l.size * f.fit),
      angle: Math.round(l.angle),
      size: r1(l.size * f.fit),
      shade: l.shade,
      appear: l.appear,
      vanish: l.vanish,
    }
    if (l.tone) out.tone = l.tone
    if (l.droop !== undefined) out.droop = l.droop
    return out
  })
}

/** Verbreiterter Stammfuß mit Breite w (bereits eingepasst) */
export function flarePath(w: number): string {
  const G = GROUND
  return (
    `M${r1(BASE_X - w * 1.15)} ${G + 1} Q${r1(BASE_X - w * 0.5)} ${G - 1} ${r1(BASE_X - w * 0.48)} ${G - 9} ` +
    `L${r1(BASE_X + w * 0.48)} ${G - 9} Q${r1(BASE_X + w * 0.5)} ${G - 1} ${r1(BASE_X + w * 1.15)} ${G + 1} Z`
  )
}

/** Ist ein Blatt (oder eine Blüte mit `vanish`) beim Wachstum g zu sehen? */
export const leafVisible = (l: { appear: number; vanish?: number }, g: number) =>
  l.appear <= g && (l.vanish === undefined || g < l.vanish)

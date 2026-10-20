/**
 * Rekursiver Baum: Stamm → Äste → Zweige, Blätter entlang der Äste und an
 * den Spitzen, Blüten/Früchte an äußeren Blattpositionen. Laubbaum, Kirsche,
 * Apfel und Birke sind nur unterschiedliche Parameter dieses Kerns.
 *
 * Wichtig: Die Reihenfolge der Zufallszahlen darf sich für den Laubbaum nicht
 * ändern, sonst sähen bestehende Bäume plötzlich anders aus. Zusätzliche
 * Zufallszahlen (z. B. für Blütenbüschel) werden nur gezogen, wenn eine Art
 * das jeweilige Merkmal auch nutzt. Ein Test (species.test.ts) prüft das.
 */
import { clamp, lerp, mulberry32 } from '../rng'
import {
  BASE_X, GROUND, type Blossom, type BlossomTone, type BranchTone, type CenterTone, type LeafTone, type PlantModel,
  type RawBranch, type RawLeaf, blossomTime, deg, finishBranches, finishLeaves, flarePath, makeFit, quadPoint,
  scheduleLeaves, shuffle,
} from '../model'
import { leafPath, r1 } from '../shapes'

type Range = [number, number]

export interface RecursiveParams {
  spread: Range //       wie weit sich Äste auffächern
  ratio: Range //        Länge Kind-Ast / Eltern-Ast
  upright: Range //      Zug zurück zur Senkrechten (schmale vs. breite Krone)
  lean: Range //         Neigung des Stamms
  trunkLen: Range
  trunkWidth: Range
  leafSize: Range
  leafShape?: (s: number) => string
  leafTone?: LeafTone
  /** Farbe der Striche je Ebene (Birke: weißer Stamm, dunkle Zweige) */
  branchTone?: (depth: number) => BranchTone | undefined
  /** Wahrscheinlichkeit für drei statt zwei Kind-Äste: [am Stamm, sonst] */
  thirdChild?: Range
  /** Wie stark Kind-Äste zur Seite hängen dürfen (Kirsche: weit ausladend) */
  maxAngle?: number
  blossom: {
    count: number
    early: number
    earlyFrom?: number
    earlyTo?: number
    size: Range
    shape: (s: number, rot: number) => string
    tone?: BlossomTone
    center?: { f: number; tone: CenterTone }
    /** weitere Blüten rund um jede Position (Kirschblüten-Büschel) */
    cluster?: number
    /** hängend (Kätzchen): Drehung nahe 0, Position etwas unterhalb */
    hanging?: boolean
    shine?: (s: number) => string
    lines?: (s: number, rot: number) => string
  }
  /** Zusatzteile nach dem Wachsen (z. B. dunkle Streifen der Birke) */
  extras?: (ctx: { branches: RawBranch[]; leaves: RawLeaf[]; r: (a: number, b: number) => number }) => void
  /** Stammfuß verbreitern */
  flare?: boolean
}

// Wachstumsfenster pro Ast-Ebene (0 = Stamm). Der Stamm ist bei g ≈ 2,8
// fertig, damit beim Übergang Keimling → Busch (g = 3) schon etwas steht.
// Das Gerüst ist bis g ≈ 5,3 komplett; danach kommen nur noch Blätter/Blüten.
const WINDOW = [2.5, 2.55, 2.85, 3.1, 3.45, 3.9]
const JITTER = [0, 0.12, 0.3, 0.5, 0.7, 0.9]
const SPAN = [0.25, 0.25, 0.3, 0.4, 0.45, 0.5]
const MAX_DEPTH = 5

// Blätter erscheinen zwischen LEAF_FROM und LEAF_TO. Der Exponent > 1 legt
// mehr Blätter an den Anfang: Ein Busch braucht schnell sichtbares Grün,
// bei großen Bäumen reicht ein Blatt pro Tag.
const LEAF_FROM = 2.85
const LEAF_TO = 6.0
const LEAF_CURVE = 1.5

export function recursiveTree(seed: number, P: RecursiveParams): PlantModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())
  const shape = P.leafShape ?? leafPath
  const [third0, third] = P.thirdChild ?? [0.45, 0.22]
  const maxAngle = P.maxAngle ?? 1.7

  // ── Charakter dieses Baums ────────────────────────────────────────────────
  const spread = r(...P.spread)
  const ratio = r(...P.ratio)
  const upright = r(...P.upright)
  const lean = r(...P.lean)
  const trunkLen = r(...P.trunkLen)
  const trunkWidth = r(...P.trunkWidth)
  const leafSize = r(...P.leafSize)

  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []
  const leaf = (l: Omit<RawLeaf, 'shape' | 'tone'>): RawLeaf => {
    const out: RawLeaf = { ...l, shape }
    if (P.leafTone) out.tone = P.leafTone
    return out
  }

  function grow(x: number, y: number, angle: number, len: number, width: number, depth: number, minStart: number) {
    const start = Math.max(minStart, WINDOW[depth] + rnd() * JITTER[depth])
    const span = SPAN[depth]
    const x2 = x + Math.sin(angle) * len
    const y2 = y - Math.cos(angle) * len
    // leichte Krümmung: Kontrollpunkt seitlich der Mitte
    const bend = (rnd() - 0.5) * len * 0.3
    const cx = (x + x2) / 2 + Math.cos(angle) * bend
    const cy = (y + y2) / 2 + Math.sin(angle) * bend
    const branch: RawBranch = { pts: [x, y, cx, cy, x2, y2], width, depth, start, span }
    const tone = P.branchTone?.(depth)
    if (tone) branch.tone = tone
    branches.push(branch)

    // Blätter entlang des Asts (nicht am Stamm)
    const along = depth === 0 ? 0 : depth <= 3 ? 1 : 2
    let side = rnd() < 0.5 ? 1 : -1
    for (let k = 0; k < along; k++) {
      const t = r(0.45, 0.95)
      const p = quadPoint(x, y, cx, cy, x2, y2, t)
      leaves.push(leaf({
        x: p.x, y: p.y,
        angle: deg(angle) + side * r(35, 75),
        size: leafSize * r(0.8, 1.08),
        shade: r(-1, 1),
        depth,
        minAppear: start + span * t,
        appear: 0,
      }))
      side = -side
    }

    // Jugendblätter an Stamm und unteren Ästen: Sie machen den kleinen Busch
    // grün und verschwinden unauffällig, während sich die Krone füllt.
    const juvenile = depth === 0 ? 4 : depth === 1 ? 3 : depth === 2 ? 2 : 0
    for (let k = 0; k < juvenile; k++) {
      const t = depth === 0 ? lerp(0.5, 0.95, k / (juvenile - 1)) : r(0.3, 0.9)
      const p = quadPoint(x, y, cx, cy, x2, y2, t)
      leaves.push(leaf({
        x: p.x, y: p.y,
        angle: deg(angle) + side * r(45, 80),
        size: leafSize * r(1, 1.2),
        shade: r(-0.5, 1),
        depth,
        minAppear: start + span * t,
        // Stamm-Jugendblätter sind beim Busch (g = 3) alle schon da
        appear: Math.max(start + span * t, depth === 0 ? lerp(2.8, 3, k / (juvenile - 1)) : depth === 1 ? r(2.85, 3.05) : r(3.15, 3.5)),
        vanish: r(4.4, 5.6),
      }))
      side = -side
    }

    if (depth === MAX_DEPTH) {
      // Blattbüschel an der Spitze
      const tip = 2 + (rnd() < 0.33 ? 1 : 0)
      for (let k = 0; k < tip; k++) {
        leaves.push(leaf({
          x: x2, y: y2,
          angle: deg(angle) + (k - (tip - 1) / 2) * r(32, 50),
          size: leafSize * r(0.85, 1.1),
          shade: r(-1, 1),
          depth,
          minAppear: start + span,
          appear: 0,
        }))
      }
      return
    }

    const n = depth === 0 ? (rnd() < third0 ? 3 : 2) : rnd() < third ? 3 : 2
    for (let i = 0; i < n; i++) {
      const off = (i / (n - 1) - 0.5) * 2 // −1 … 1
      let a = angle + off * spread * (n === 3 ? 1.15 : 0.9) + (rnd() - 0.5) * 0.25
      a *= 1 - upright
      a = clamp(a, -maxAngle, maxAngle) // nie deutlich unter die Waagerechte
      const l = len * ratio * r(0.84, 1.08) * (n === 3 && off === 0 ? 0.9 : 1)
      grow(x2, y2, a, l, width * r(0.62, 0.72), depth + 1, start + span * 0.9)
    }
  }

  grow(BASE_X, GROUND, lean, trunkLen, trunkWidth, 0, 0)
  P.extras?.({ branches, leaves, r })

  // ── Einpassen, Blätter zeitlich verteilen ─────────────────────────────────
  const f = makeFit(branches.filter((b) => b.tone !== 'mark'), leaves)
  scheduleLeaves(leaves, rnd, LEAF_FROM, LEAF_TO, LEAF_CURVE)

  // ── Blüten/Früchte an äußeren Blattpositionen ─────────────────────────────
  // Ein paar vereinzelt ab „Junger Baum“ (g ≥ 4), der Rest ab g = 6 (Tag 60).
  const B = P.blossom
  const outer = shuffle(leaves.filter((l) => l.depth >= 4 && l.vanish === undefined), rnd)
  const hosts = outer.slice(0, Math.min(B.count, outer.length))
  const blossoms: Blossom[] = []
  const make = (l: RawLeaf, planned: number, dx: number, dy: number) => {
    const size = r(...B.size) * f.fit
    const rot = B.hanging ? r(-14, 14) : r(0, 72)
    const b: Blossom = {
      id: blossoms.length, // Nummer in Erzeugungsreihenfolge (wie ursprünglich)
      x: r1(f.fx(l.x + r(-4, 4) + dx)),
      y: r1(f.fy(l.y + r(-4, 3) + dy)),
      d: B.shape(size, rot),
      size: r1(size),
      rot: Math.round(rot),
      shade: r(-1, 1),
      appear: Math.max(planned, l.appear + 0.05),
    }
    if (B.tone) b.tone = B.tone
    if (B.center) b.center = { r: r1(size * B.center.f), tone: B.center.tone }
    if (B.shine) b.shine = B.shine(size)
    if (B.lines) b.lines = B.lines(size, rot)
    blossoms.push(b)
  }
  hosts.forEach((l, k) => {
    const planned = blossomTime(k, hosts.length, B.early, B.earlyFrom, B.earlyTo)
    make(l, planned, 0, B.hanging ? 3 : 0)
    // Büschel: weitere Blüten dicht daneben, etwas später
    for (let c = 0; c < (B.cluster ?? 0); c++) {
      make(l, Math.min(6.97, planned + 0.02 * (c + 1)), r(-6, 6), r(-5, 5))
    }
  })
  blossoms.sort((a, b) => a.appear - b.appear)

  return {
    branches: finishBranches(branches, f),
    leaves: finishLeaves(leaves, f),
    blossoms,
    flare: P.flare === false ? undefined : flarePath(trunkWidth * f.fit),
  }
}

/** Grober Helfer für Zusatzteile: Strich entlang eines Astes */
export function segmentOn(b: RawBranch, t: number, len: number, angleOffset: number) {
  const q = b.pts
  const p = quadPoint(q[0], q[1], q[2], q[3], q[4], q[5], t)
  const dx = q[4] - q[0]
  const dy = q[5] - q[1]
  const a = Math.atan2(dy, dx) + (angleOffset * Math.PI) / 180
  return { x: p.x, y: p.y, x2: p.x + Math.cos(a) * len, y2: p.y + Math.sin(a) * len }
}

export { GROUND }

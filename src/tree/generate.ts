/**
 * Prozeduraler Baum-Generator.
 *
 * Aus einem Seed entsteht einmalig der *ausgewachsene* Baum: rekursive Äste,
 * Blätter und Blüten. Jedes Element bekommt einen Wachstumswert `appear`
 * (bzw. `start` + `span` bei Ästen). Die Darstellung zeigt dann nur, was zum
 * aktuellen Wachstum g passt (siehe health.ts → growthOf).
 *
 * Vorteil: Der Baum ist stabil – er sieht morgen genauso aus wie heute, nur
 * mit ein paar Blättern mehr. Und jeder erledigte Tag schaltet sichtbar etwas
 * frei, weil die Blätter gleichmäßig über den Wachstumsbereich verteilt sind.
 *
 * Koordinaten: viewBox 0 0 200 200, Stammfuß bei (100, GROUND), y wächst
 * nach unten (SVG-Konvention), Winkel 0 = senkrecht nach oben.
 */
import { clamp, lerp, mulberry32 } from './rng'

export const VIEW = 200
export const BASE_X = 100
export const GROUND = 178

export interface Branch {
  id: number
  /** SVG-Pfad (quadratische Kurve) */
  d: string
  width: number
  depth: number
  /** ab diesem g beginnt der Ast zu wachsen … */
  start: number
  /** … und ist nach `span` voll ausgewachsen */
  span: number
}

export interface Leaf {
  id: number
  x: number
  y: number
  /** Blattform, Spitze nach oben, Stielansatz bei (0, 0) */
  d: string
  /** Grad, 0 = nach oben, positiv = im Uhrzeigersinn */
  angle: number
  size: number
  /** −1 … 1, für leichte Farbvariation */
  shade: number
  appear: number
  /** Jugendblätter verschwinden wieder, wenn die Krone dicht wird */
  vanish?: number
}

export interface Blossom {
  id: number
  x: number
  y: number
  /** fünf Blütenblätter um (0, 0) */
  d: string
  size: number
  rot: number
  shade: number
  appear: number
}

export interface TreeModel {
  branches: Branch[]
  leaves: Leaf[]
  blossoms: Blossom[]
  /** verbreiterter Stammfuß */
  flare: string
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

interface RawBranch {
  x1: number; y1: number; cx: number; cy: number; x2: number; y2: number
  width: number; depth: number; start: number; span: number
}
interface RawLeaf {
  x: number; y: number; angle: number; size: number; shade: number
  depth: number; minAppear: number; appear: number; vanish?: number
}

/** Punkt auf einer quadratischen Bézierkurve bei t ∈ [0, 1] */
export function quadPoint(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number) {
  const u = 1 - t
  return { x: u * u * x1 + 2 * u * t * cx + t * t * x2, y: u * u * y1 + 2 * u * t * cy + t * t * y2 }
}

const deg = (rad: number) => (rad * 180) / Math.PI
const r1 = (v: number) => Math.round(v * 10) / 10

/** Mandelförmiges Blatt der Länge s, Spitze nach oben */
export function leafPath(s: number): string {
  return `M0 0C${r1(0.4 * s)} ${r1(-0.2 * s)} ${r1(0.44 * s)} ${r1(-0.72 * s)} 0 ${r1(-s)}` +
    `C${r1(-0.44 * s)} ${r1(-0.72 * s)} ${r1(-0.4 * s)} ${r1(-0.2 * s)} 0 0Z`
}

/** Fünf tropfenförmige Blütenblätter mit Radius s, um `rot` Grad gedreht */
function flowerPath(s: number, rot: number): string {
  const pts = [[0.55, -0.3], [0.6, -0.95], [0, -1], [-0.6, -0.95], [-0.55, -0.3]]
  let d = ''
  for (let i = 0; i < 5; i++) {
    const a = ((rot + i * 72) * Math.PI) / 180
    const [c, sn] = [Math.cos(a), Math.sin(a)]
    const p = pts.map(([x, y]) => `${r1((x * c - y * sn) * s)} ${r1((x * sn + y * c) * s)}`)
    d += `M0 0C${p[0]} ${p[1]} ${p[2]}C${p[3]} ${p[4]} 0 0Z`
  }
  return d
}

export function generateTree(seed: number): TreeModel {
  const rnd = mulberry32(seed)
  const r = (a: number, b: number) => lerp(a, b, rnd())

  // ── Charakter dieses Baums ────────────────────────────────────────────────
  const spread = r(0.4, 0.64) //     wie weit sich Äste auffächern
  const ratio = r(0.72, 0.8) //      Länge Kind-Ast / Eltern-Ast
  const upright = r(0.06, 0.2) //    Zug zurück zur Senkrechten (schmale vs. breite Krone)
  const lean = r(-0.12, 0.12) //     Neigung des Stamms
  const trunkLen = r(40, 50)
  const trunkWidth = r(8.5, 11)
  const leafSize = r(12.5, 15)

  const branches: RawBranch[] = []
  const leaves: RawLeaf[] = []

  function grow(x: number, y: number, angle: number, len: number, width: number, depth: number, minStart: number) {
    const start = Math.max(minStart, WINDOW[depth] + rnd() * JITTER[depth])
    const span = SPAN[depth]
    const x2 = x + Math.sin(angle) * len
    const y2 = y - Math.cos(angle) * len
    // leichte Krümmung: Kontrollpunkt seitlich der Mitte
    const bend = (rnd() - 0.5) * len * 0.3
    const cx = (x + x2) / 2 + Math.cos(angle) * bend
    const cy = (y + y2) / 2 + Math.sin(angle) * bend
    branches.push({ x1: x, y1: y, cx, cy, x2, y2, width, depth, start, span })

    // Blätter entlang des Asts (nicht am Stamm)
    const along = depth === 0 ? 0 : depth <= 3 ? 1 : 2
    let side = rnd() < 0.5 ? 1 : -1
    for (let k = 0; k < along; k++) {
      const t = r(0.45, 0.95)
      const p = quadPoint(x, y, cx, cy, x2, y2, t)
      leaves.push({
        x: p.x, y: p.y,
        angle: deg(angle) + side * r(35, 75),
        size: leafSize * r(0.8, 1.08),
        shade: r(-1, 1),
        depth,
        minAppear: start + span * t,
        appear: 0,
      })
      side = -side
    }

    // Jugendblätter an Stamm und unteren Ästen: Sie machen den kleinen Busch
    // grün und verschwinden unauffällig, während sich die Krone füllt.
    const juvenile = depth === 0 ? 4 : depth === 1 ? 3 : depth === 2 ? 2 : 0
    for (let k = 0; k < juvenile; k++) {
      const t = depth === 0 ? lerp(0.5, 0.95, k / (juvenile - 1)) : r(0.3, 0.9)
      const p = quadPoint(x, y, cx, cy, x2, y2, t)
      leaves.push({
        x: p.x, y: p.y,
        angle: deg(angle) + side * r(45, 80),
        size: leafSize * r(1, 1.2),
        shade: r(-0.5, 1),
        depth,
        minAppear: start + span * t,
        // Stamm-Jugendblätter sind beim Busch (g = 3) alle schon da
        appear: Math.max(start + span * t, depth === 0 ? lerp(2.8, 3, k / (juvenile - 1)) : depth === 1 ? r(2.85, 3.05) : r(3.15, 3.5)),
        vanish: r(4.4, 5.6),
      })
      side = -side
    }

    if (depth === MAX_DEPTH) {
      // Blattbüschel an der Spitze
      const tip = 2 + (rnd() < 0.33 ? 1 : 0)
      for (let k = 0; k < tip; k++) {
        leaves.push({
          x: x2, y: y2,
          angle: deg(angle) + (k - (tip - 1) / 2) * r(32, 50),
          size: leafSize * r(0.85, 1.1),
          shade: r(-1, 1),
          depth,
          minAppear: start + span,
          appear: 0,
        })
      }
      return
    }

    const n = depth === 0 ? (rnd() < 0.45 ? 3 : 2) : rnd() < 0.22 ? 3 : 2
    for (let i = 0; i < n; i++) {
      const off = (i / (n - 1) - 0.5) * 2 // −1 … 1
      let a = angle + off * spread * (n === 3 ? 1.15 : 0.9) + (rnd() - 0.5) * 0.25
      a *= 1 - upright
      a = clamp(a, -1.7, 1.7) // nie deutlich unter die Waagerechte
      const l = len * ratio * r(0.84, 1.08) * (n === 3 && off === 0 ? 0.9 : 1)
      grow(x2, y2, a, l, width * r(0.62, 0.72), depth + 1, start + span * 0.9)
    }
  }

  grow(BASE_X, GROUND, lean, trunkLen, trunkWidth, 0, 0)

  // ── In die viewBox einpassen (Skalierung um den Stammfuß) ─────────────────
  let minX = BASE_X, maxX = BASE_X, minY = GROUND
  for (const b of branches) {
    minX = Math.min(minX, b.x2, b.cx); maxX = Math.max(maxX, b.x2, b.cx); minY = Math.min(minY, b.y2, b.cy)
  }
  for (const l of leaves) {
    minX = Math.min(minX, l.x - l.size); maxX = Math.max(maxX, l.x + l.size); minY = Math.min(minY, l.y - l.size)
  }
  const fit = Math.min(
    1.4,
    (GROUND - 10) / (GROUND - minY),
    (BASE_X - 8) / Math.max(1, BASE_X - minX),
    (VIEW - 8 - BASE_X) / Math.max(1, maxX - BASE_X),
  )
  const fx = (x: number) => BASE_X + (x - BASE_X) * fit
  const fy = (y: number) => GROUND + (y - GROUND) * fit
  const n1 = r1

  // ── Erscheinungszeitpunkte der Blätter ────────────────────────────────────
  const sorted = leaves
    .filter((l) => l.vanish === undefined)
    .map((l) => ({ l, key: l.minAppear + rnd() * 0.15 }))
    .sort((a, b) => a.key - b.key)
  sorted.forEach(({ l }, i) => {
    const u = sorted.length > 1 ? i / (sorted.length - 1) : 0
    l.appear = Math.max(l.minAppear, LEAF_FROM + (LEAF_TO - LEAF_FROM) * Math.pow(u, LEAF_CURVE))
  })

  // ── Blüten: an äußeren Blattpositionen ────────────────────────────────────
  // Ein paar vereinzelt ab „Junger Baum“ (g ≥ 4), der Rest ab g = 6
  // (Tag 60) – bis H = 100 füllt sich der Baum damit.
  const outer = leaves.filter((l) => l.depth >= 4 && l.vanish === undefined)
  for (let i = outer.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[outer[i], outer[j]] = [outer[j], outer[i]]
  }
  const hosts = outer.slice(0, Math.min(48, outer.length))
  const EARLY = 6
  const blossoms: Blossom[] = hosts.map((l, k) => {
    const planned = k < EARLY ? lerp(4.1, 5.9, k / (EARLY - 1)) : 6 + 0.97 * ((k - EARLY) / Math.max(1, hosts.length - EARLY - 1))
    const size = r(3.4, 4.6) * fit
    const rot = r(0, 72)
    return {
      id: k,
      x: n1(fx(l.x + r(-4, 4))),
      y: n1(fy(l.y + r(-4, 3))),
      d: flowerPath(size, rot),
      size: n1(size),
      rot: Math.round(rot),
      shade: r(-1, 1),
      appear: Math.max(planned, l.appear + 0.05),
    }
  })
  blossoms.sort((a, b) => a.appear - b.appear)

  const w0 = trunkWidth * fit
  const G = GROUND
  const flare =
    `M${n1(BASE_X - w0 * 1.15)} ${G + 1} Q${n1(BASE_X - w0 * 0.5)} ${G - 1} ${n1(BASE_X - w0 * 0.48)} ${G - 9} ` +
    `L${n1(BASE_X + w0 * 0.48)} ${G - 9} Q${n1(BASE_X + w0 * 0.5)} ${G - 1} ${n1(BASE_X + w0 * 1.15)} ${G + 1} Z`

  return {
    branches: branches.map((b, id) => ({
      id,
      d: `M${n1(fx(b.x1))} ${n1(fy(b.y1))} Q${n1(fx(b.cx))} ${n1(fy(b.cy))} ${n1(fx(b.x2))} ${n1(fy(b.y2))}`,
      width: n1(b.width * fit),
      depth: b.depth,
      start: b.start,
      span: b.span,
    })),
    leaves: leaves.map((l, id) => ({
      id,
      x: n1(fx(l.x)),
      y: n1(fy(l.y)),
      d: leafPath(l.size * fit),
      angle: Math.round(l.angle),
      size: n1(l.size * fit),
      shade: l.shade,
      appear: l.appear,
      vanish: l.vanish,
    })),
    blossoms,
    flare,
  }
}

// Bäume werden oft gezeichnet, aber selten neu erzeugt → zwischenspeichern.
const cache = new Map<number, TreeModel>()
export function treeModel(seed: number): TreeModel {
  let m = cache.get(seed)
  if (!m) cache.set(seed, (m = generateTree(seed)))
  return m
}

/** Ist ein Blatt beim Wachstum g zu sehen? */
export const leafVisible = (l: Leaf, g: number) => l.appear <= g && (l.vanish === undefined || g < l.vanish)

/**
 * Gesamtgröße des Baums: ein junger Busch ist kleiner als der fertige Baum.
 * Zusammen mit den nach und nach erscheinenden Ästen wirkt das wie Wachsen.
 */
export function treeScale(g: number): number {
  return lerp(0.55, 1, clamp((g - 3) / 3, 0, 1))
}

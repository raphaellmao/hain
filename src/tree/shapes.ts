/**
 * Formen für Blätter, Blüten und Früchte als SVG-Pfade.
 *
 * Blätter: Stielansatz bei (0, 0), Spitze zeigt nach oben (−y).
 * Blüten:  Mitte bei (0, 0).
 * Hängende Formen (Kätzchen, Zapfen): Aufhängung bei (0, 0), hängen nach unten.
 */

export const r1 = (v: number) => Math.round(v * 10) / 10
const p = (x: number, y: number) => `${r1(x)} ${r1(y)}`

/** Punkt (x, y) um `deg` Grad drehen (im Uhrzeigersinn, SVG-Koordinaten) */
function rotate(x: number, y: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c - y * s, x * s + y * c]
}

/** Symmetrische Form aus zwei kubischen Kurven: [x1,y1, x2,y2] je Seite, Spitze bei (0, −len) */
function symmetric(len: number, c1: [number, number], c2: [number, number], base = 0): string {
  return (
    `M0 ${r1(-base)}C${p(c1[0], c1[1])} ${p(c2[0], c2[1])} 0 ${r1(-len)}` +
    `C${p(-c2[0], c2[1])} ${p(-c1[0], c1[1])} 0 ${r1(-base)}Z`
  )
}

// ── Blätter ──────────────────────────────────────────────────────────────────

/** Mandelförmig (Laubbaum) – exakt die ursprüngliche Form */
export function leafPath(s: number): string {
  return `M0 0C${r1(0.4 * s)} ${r1(-0.2 * s)} ${r1(0.44 * s)} ${r1(-0.72 * s)} 0 ${r1(-s)}` +
    `C${r1(-0.44 * s)} ${r1(-0.72 * s)} ${r1(-0.4 * s)} ${r1(-0.2 * s)} 0 0Z`
}

/** Rundlich (Apfel) */
export const roundLeaf = (s: number) => symmetric(s, [0.6 * s, -0.12 * s], [0.62 * s, -0.86 * s])

/** Kleines, zugespitztes Birkenblatt mit breiter Basis */
export const birchLeaf = (s: number) => symmetric(s, [0.55 * s, -0.1 * s], [0.36 * s, -0.68 * s])

/** Schmal und lang (Weide) */
export const lanceLeaf = (s: number) => symmetric(s, [0.17 * s, -0.22 * s], [0.13 * s, -0.78 * s])

/** Herzförmig mit kurzem Stiel (Sonnenblume) */
export function heartLeaf(s: number): string {
  const b = 0.14 * s
  return (
    `M0 0L0 ${r1(-b)}C${p(0.66 * s, -0.02 * s)} ${p(0.66 * s, -0.66 * s)} 0 ${r1(-s)}` +
    `C${p(-0.66 * s, -0.66 * s)} ${p(-0.66 * s, -0.02 * s)} 0 ${r1(-b)}Z`
  )
}

/** Fächer aus fünf Nadeln (Tanne) */
export function needleTuft(s: number): string {
  let d = ''
  for (const a of [-40, -20, 0, 20, 40]) {
    const [tx, ty] = rotate(0, -s, a)
    const [lx, ly] = rotate(-0.07 * s, 0, a)
    const [rx, ry] = rotate(0.07 * s, 0, a)
    d += `M${p(lx, ly)}L${p(tx, ty)}L${p(rx, ry)}Z`
  }
  return d
}

/** Kaktusstachel: dünner Keil */
export const spine = (s: number) => `M${p(-0.09 * s, 0)}L0 ${r1(-s)}L${p(0.09 * s, 0)}Z`

/**
 * Tannen-Etage: Spitze oben bei (0, 0), Breite w, Höhe h, unten gezackt.
 * Wird mit Winkel 0 gesetzt (nicht gedreht).
 */
export function firTier(w: number, h: number, teeth = 6): string {
  const hw = w / 2
  let d = `M0 0C${p(hw * 0.25, h * 0.3)} ${p(hw * 0.7, h * 0.72)} ${p(hw, h)}`
  for (let i = 1; i <= teeth; i++) {
    const x = hw - (w * i) / teeth
    const notch = hw - (w * (i - 0.5)) / teeth
    d += `L${p(notch, h * 0.84)}L${p(x, h)}`
  }
  d += `C${p(-hw * 0.7, h * 0.72)} ${p(-hw * 0.25, h * 0.3)} 0 0Z`
  return d
}

// ── Blüten & Früchte (Mitte bei 0, 0) ────────────────────────────────────────

/** Fünf tropfenförmige Blütenblätter (Laubbaum) – exakt die ursprüngliche Form */
export function flowerPath(s: number, rot: number): string {
  const pts = [[0.55, -0.3], [0.6, -0.95], [0, -1], [-0.6, -0.95], [-0.55, -0.3]]
  let d = ''
  for (let i = 0; i < 5; i++) {
    const a = ((rot + i * 72) * Math.PI) / 180
    const [c, sn] = [Math.cos(a), Math.sin(a)]
    const q = pts.map(([x, y]) => `${r1((x * c - y * sn) * s)} ${r1((x * sn + y * c) * s)}`)
    d += `M0 0C${q[0]} ${q[1]} ${q[2]}C${q[3]} ${q[4]} 0 0Z`
  }
  return d
}

/** Kirschblüte: fünf runde Blätter mit Kerbe an der Spitze */
export function cherryFlower(s: number, rot: number): string {
  let d = ''
  for (let i = 0; i < 5; i++) {
    const pts: [number, number][] = [
      [0.46 * s, -0.22 * s], [0.56 * s, -0.92 * s], [0.14 * s, -1.02 * s],
      [0, -0.86 * s],
      [-0.14 * s, -1.02 * s], [-0.56 * s, -0.92 * s], [-0.46 * s, -0.22 * s],
    ].map(([x, y]) => rotate(x, y, rot + i * 72))
    d += `M0 0C${p(...pts[0])} ${p(...pts[1])} ${p(...pts[2])}L${p(...pts[3])}L${p(...pts[4])}C${p(...pts[5])} ${p(...pts[6])} 0 0Z`
  }
  return d
}

/** Kaktusblüte: zehn schmale, spitze Blätter */
export function cactusFlower(s: number, rot: number): string {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const pts = [[0.2 * s, -0.3 * s], [0.18 * s, -0.8 * s], [0, -s], [-0.18 * s, -0.8 * s], [-0.2 * s, -0.3 * s]].map(
      ([x, y]) => rotate(x, y, rot + i * 36),
    )
    d += `M0 0C${p(...pts[0])} ${p(...pts[1])} ${p(...pts[2])}C${p(...pts[3])} ${p(...pts[4])} 0 0Z`
  }
  return d
}

/** Apfel: leicht eingedellt oben */
export function appleFruit(s: number): string {
  return (
    `M0 ${r1(-0.78 * s)}C${p(0.55 * s, -1.08 * s)} ${p(1.02 * s, -0.6 * s)} ${p(0.96 * s, 0.02 * s)}` +
    `C${p(0.92 * s, 0.72 * s)} ${p(0.42 * s, 1.0 * s)} 0 ${r1(0.92 * s)}` +
    `C${p(-0.42 * s, 1.0 * s)} ${p(-0.92 * s, 0.72 * s)} ${p(-0.96 * s, 0.02 * s)}` +
    `C${p(-1.02 * s, -0.6 * s)} ${p(-0.55 * s, -1.08 * s)} 0 ${r1(-0.78 * s)}Z`
  )
}
/** Lichtreflex auf dem Apfel */
export const appleShine = (s: number) =>
  `M${p(-0.5 * s, -0.35 * s)}C${p(-0.42 * s, -0.62 * s)} ${p(-0.12 * s, -0.7 * s)} ${p(-0.08 * s, -0.55 * s)}` +
  `C${p(-0.12 * s, -0.38 * s)} ${p(-0.36 * s, -0.22 * s)} ${p(-0.5 * s, -0.35 * s)}Z`
/** Stiel und kleines Blatt am Apfel (als Linie) */
export const appleStem = (s: number) => `M0 ${r1(-0.75 * s)}L${p(0.12 * s, -1.25 * s)}`

/** Hängendes Kätzchen (Birke, Weide): Aufhängung oben, Länge s */
export const catkin = (s: number, rot: number) => {
  const pts: [number, number][] = [
    [0.22 * s, 0.12 * s], [0.2 * s, 0.82 * s], [0, s], [-0.2 * s, 0.82 * s], [-0.22 * s, 0.12 * s],
  ].map(([x, y]) => rotate(x, y, rot))
  return `M0 0C${p(...pts[0])} ${p(...pts[1])} ${p(...pts[2])}C${p(...pts[3])} ${p(...pts[4])} 0 0Z`
}

/** Hängender Zapfen (Tanne): breiter als ein Kätzchen */
export const cone = (s: number, rot: number) => {
  const pts: [number, number][] = [
    [0.4 * s, 0.1 * s], [0.38 * s, 0.85 * s], [0, s], [-0.38 * s, 0.85 * s], [-0.4 * s, 0.1 * s],
  ].map(([x, y]) => rotate(x, y, rot))
  return `M0 0C${p(...pts[0])} ${p(...pts[1])} ${p(...pts[2])}C${p(...pts[3])} ${p(...pts[4])} 0 0Z`
}
/** Schuppenlinien auf dem Zapfen */
export const coneScales = (s: number, rot: number) =>
  [0.32, 0.52, 0.72]
    .map((t) => {
      const w = 0.3 * s * (1 - t * 0.35)
      const [ax, ay] = rotate(-w, t * s, rot)
      const [mx, my] = rotate(0, t * s + 0.08 * s, rot)
      const [bx, by] = rotate(w, t * s, rot)
      return `M${p(ax, ay)}Q${p(mx, my)} ${p(bx, by)}`
    })
    .join('')

/** Einzelnes Sonnenblumen-Blütenblatt: beginnt am Rand der Scheibe (Radius r0) */
export function sunPetal(r0: number, len: number, rot: number): string {
  const w = len * 0.3
  const pts: [number, number][] = [
    [w, -r0 - len * 0.25], [w * 0.8, -r0 - len * 0.85], [0, -r0 - len],
    [-w * 0.8, -r0 - len * 0.85], [-w, -r0 - len * 0.25],
  ].map(([x, y]) => rotate(x, y, rot))
  const [sx, sy] = rotate(0, -r0 + 1, rot)
  return `M${p(sx, sy)}C${p(...pts[0])} ${p(...pts[1])} ${p(...pts[2])}C${p(...pts[3])} ${p(...pts[4])} ${p(sx, sy)}Z`
}

/** Kreis als Pfad */
export const circle = (r: number) => `M${r1(-r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0Z`

/** Samenmuster der Sonnenblumen-Scheibe (Punkte auf einer Spirale) */
export function seedDots(r: number): string {
  let d = ''
  const n = 26
  for (let i = 1; i <= n; i++) {
    const rr = r * 0.85 * Math.sqrt(i / n)
    const a = i * 137.5 * (Math.PI / 180)
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    const dr = r * 0.07
    d += `M${r1(x - dr)} ${r1(y)}a${r1(dr)} ${r1(dr)} 0 1 0 ${r1(2 * dr)} 0a${r1(dr)} ${r1(dr)} 0 1 0 ${r1(-2 * dr)} 0Z`
  }
  return d
}

/** Geschlossene Knospe: grüne Kelchblätter */
export function budPath(s: number, rot: number): string {
  let d = ''
  for (let i = 0; i < 8; i++) {
    const pts = [[0.3 * s, -0.3 * s], [0.2 * s, -0.85 * s], [0, -s], [-0.2 * s, -0.85 * s], [-0.3 * s, -0.3 * s]].map(
      ([x, y]) => rotate(x, y, rot + i * 45),
    )
    d += `M0 0C${p(...pts[0])} ${p(...pts[1])} ${p(...pts[2])}C${p(...pts[3])} ${p(...pts[4])} 0 0Z`
  }
  return d
}

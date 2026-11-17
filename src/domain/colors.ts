/**
 * Feste Farbpalette für Habits. Feste Schlüssel statt freier Hex-Werte, damit
 * wir später Farben nachjustieren können, ohne gespeicherte Daten anzufassen.
 * Die Töne sind mittelhell gewählt und funktionieren auf hellem wie dunklem
 * Hintergrund. Im Baum färben sie die Blüten und tönen die Blätter leicht.
 */
export interface ColorDef {
  label: string
  /** stellvertretende Farbe (Haken, Ringe, Namensschild) */
  hex: string
  /** Mehrfarbig: Jede Blüte bekommt einen dieser Farbtöne (HSL-Grad) */
  hues?: readonly number[]
  /** Hintergrund für das Farbfeld im Formular */
  swatch?: string
}

export const COLORS = {
  koralle: { label: 'Koralle', hex: '#ef6f53' },
  apricot: { label: 'Apricot', hex: '#f0a540' },
  gold: { label: 'Gold', hex: '#e2bd3a' },
  rosa: { label: 'Rosa', hex: '#ea7fae' },
  weinrot: { label: 'Weinrot', hex: '#c44a6e' },
  flieder: { label: 'Flieder', hex: '#a387e6' },
  blau: { label: 'Blau', hex: '#5a9aef' },
  tuerkis: { label: 'Türkis', hex: '#36b8a8' },
  // seit 11/2026
  rot: { label: 'Rot', hex: '#e0413c' },
  orange: { label: 'Orange', hex: '#f27a36' },
  pfirsich: { label: 'Pfirsich', hex: '#f5a58c' },
  zitrone: { label: 'Zitrone', hex: '#e3d84a' },
  limette: { label: 'Limette', hex: '#9bcf4a' },
  smaragd: { label: 'Smaragd', hex: '#2fa86a' },
  mint: { label: 'Mint', hex: '#6fd4b5' },
  himmel: { label: 'Himmelblau', hex: '#4cc3ef' },
  indigo: { label: 'Indigo', hex: '#5b61d6' },
  violett: { label: 'Violett', hex: '#8a4fd8' },
  magenta: { label: 'Magenta', hex: '#d64bc0' },
  silber: { label: 'Silber', hex: '#c3ccd8' },
  // mehrfarbig
  regenbogen: {
    label: 'Regenbogen', hex: '#a387e6', hues: [0, 32, 52, 120, 190, 230, 280, 320],
    swatch: 'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)',
  },
  feuer: { label: 'Feuer', hex: '#f27a36', hues: [0, 14, 26, 38, 48], swatch: 'linear-gradient(135deg, #e0413c, #f27a36, #f5c542)' },
  polarlicht: { label: 'Polarlicht', hex: '#36b8a8', hues: [150, 170, 190, 265, 290, 315], swatch: 'linear-gradient(135deg, #2fd48a, #36b8c8, #8a4fd8, #d64bc0)' },
} as const satisfies Record<string, ColorDef>

export type ColorKey = keyof typeof COLORS

export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]

/** Definition einer Farbe (mit optionalen Farbtönen für mehrfarbige Pflanzen) */
export const colorDef = (key: ColorKey): ColorDef => (COLORS as Record<string, ColorDef>)[key] ?? COLORS.koralle

export function colorHex(key: ColorKey): string {
  return COLORS[key]?.hex ?? COLORS.koralle.hex
}

// ── kleine Farbhelfer (HSL) für den Baum ────────────────────────────────────

export interface Hsl {
  h: number
  s: number
  l: number
}

export function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: h * 60, s: s * 100, l: l * 100 }
}

export const hsl = ({ h, s, l }: Hsl) => `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`

/** Farbton a Richtung b mischen (kürzester Weg auf dem Farbkreis). */
export function mixHue(a: number, b: number, t: number): number {
  const d = ((b - a + 540) % 360) - 180
  return (a + d * t + 360) % 360
}

// ── Kontrast (WCAG) ─────────────────────────────────────────────────────────

function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const S = s / 100
  const L = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/**
 * Dieselbe Farbe so weit abdunkeln, bis sie auf `surface` mindestens `min`:1
 * Kontrast hat (für Diagramm-Balken im Hellmodus).
 */
export function withContrast(hex: string, surface = '#fdfcf9', min = 3): string {
  const c = hexToHsl(hex)
  const sl = hexToHsl(surface)
  const ls = luminance(hslToRgb(sl))
  let l = c.l
  while (l > 5 && (ls + 0.05) / (luminance(hslToRgb({ ...c, l })) + 0.05) < min) l -= 1
  return hsl({ ...c, l })
}

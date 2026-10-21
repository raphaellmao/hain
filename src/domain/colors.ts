/**
 * Feste Farbpalette für Habits. Feste Schlüssel statt freier Hex-Werte, damit
 * wir später Farben nachjustieren können, ohne gespeicherte Daten anzufassen.
 * Die Töne sind mittelhell gewählt und funktionieren auf hellem wie dunklem
 * Hintergrund. Im Baum färben sie die Blüten und tönen die Blätter leicht.
 */
export const COLORS = {
  koralle: { label: 'Koralle', hex: '#ef6f53' },
  apricot: { label: 'Apricot', hex: '#f0a540' },
  gold: { label: 'Gold', hex: '#e2bd3a' },
  rosa: { label: 'Rosa', hex: '#ea7fae' },
  weinrot: { label: 'Weinrot', hex: '#c44a6e' },
  flieder: { label: 'Flieder', hex: '#a387e6' },
  blau: { label: 'Blau', hex: '#5a9aef' },
  tuerkis: { label: 'Türkis', hex: '#36b8a8' },
} as const

export type ColorKey = keyof typeof COLORS

export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]

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

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

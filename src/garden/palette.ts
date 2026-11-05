/**
 * Farben der Gartenszene. Alles, was auf dem Boden steht, bekommt seine Grundfarbe
 * aus der Jahreszeit und wird dann mit dem Licht der Tageszeit eingefärbt. Dadurch
 * passen Wiese, Hügel und Tiere zueinander, statt einzeln abgestimmt zu sein.
 */
import type { Phase, Season, Weather } from '../lib/sky'

/** feste Pseudo-Zufallszahl 0 … 1 für Element i (stabil zwischen Renderings) */
export const rnd = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

const channels = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`

/** Überblenden: t = 0 → a, t = 1 → b */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [channels(a), channels(b)]
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}

const LIGHT: Record<Phase, { tint: string; amount: number; gain: number }> = {
  tag: { tint: '#fff4d6', amount: 0.06, gain: 1 },
  morgen: { tint: '#ffb48a', amount: 0.2, gain: 0.94 },
  abend: { tint: '#ff8a5c', amount: 0.2, gain: 0.72 },
  nacht: { tint: '#1f3370', amount: 0.58, gain: 0.36 },
}

const SKIES: Record<Phase, string[]> = {
  tag: ['#3b8bdb', '#57a5e7', '#84c3f0', '#b8dff6', '#e8f6fb'],
  morgen: ['#3d4a8d', '#7a6aa8', '#c882a0', '#f5a98f', '#ffdcab'],
  abend: ['#27285f', '#5a3f88', '#b4527b', '#ee7d5f', '#ffb966'],
  nacht: ['#040816', '#0a1229', '#111d40', '#1a2a56', '#2b3d6e'],
}

const GROUND: Record<Season, { meadow: [string, string]; near: string; far: string; forest: string; blade: [string, string]; flowers: string[] }> = {
  fruehling: { meadow: ['#a9dd80', '#84c367'], near: '#8ecd70', far: '#a5cda2', forest: '#5f9a5e', blade: ['#6fb354', '#bfe892'], flowers: ['#fffdf5', '#ffd84d', '#f7a8c9', '#c9a4f2'] },
  sommer: { meadow: ['#9bd06e', '#74ae52'], near: '#80ba62', far: '#99c196', forest: '#4f8350', blade: ['#5d9a45', '#b4e083'], flowers: ['#fffdf5', '#ef4f3f', '#ffd23f', '#6d8bf0'] },
  herbst: { meadow: ['#a9b264', '#7f9450'], near: '#a79a52', far: '#b3a277', forest: '#a4703a', blade: ['#6f7a38', '#d3c477'], flowers: ['#e8843a', '#c9542c', '#e9b53b', '#8d4a2a'] },
  winter: { meadow: ['#f8fbfe', '#e6eef7'], near: '#eef3f9', far: '#dbe5f0', forest: '#6e8399', blade: ['#8d9a8a', '#b9c4b6'], flowers: ['#ffffff', '#e8f0f8', '#d24a4a', '#ffffff'] },
}

export interface ScenePalette {
  phase: Phase
  season: Season
  /** färbt eine Grundfarbe mit dem Licht der Tageszeit ein */
  lit: (hex: string) => string
  sky: string[]
  meadow: [string, string]
  near: string
  far: string
  mountain: [string, string]
  forest: string
  blade: [string, string]
  flowers: string[]
  horizon: string
  cloud: [string, string]
  cloudOpacity: number
  /** Schrift über dem Himmel */
  text: string
  /** Namensschild, Schrift darauf und Schrift daneben */
  labelBg: string
  labelInk: string
  subInk: string
  /** Lichtfleck auf der Wiese */
  pool: string
  /** Pflanzen stehen im selben Licht wie die Landschaft */
  plantFilter: string
}

const PLANT_FILTER: Record<Phase, string> = {
  tag: 'saturate(1.06)',
  morgen: 'brightness(0.97) sepia(0.14) saturate(1.05)',
  abend: 'brightness(0.84) sepia(0.28) saturate(1.1)',
  nacht: 'brightness(0.5) saturate(0.62) hue-rotate(12deg)',
}

export function scenePalette(phase: Phase, season: Season, weather: Weather, dark: boolean): ScenePalette {
  const { tint, amount, gain } = LIGHT[phase]
  // Im Dunkelmodus der App etwas gedämpfter, damit der Wechsel zwischen den Reitern nicht blendet
  const dim = dark && phase !== 'nacht' ? (season === 'winter' ? 0.93 : 0.84) : 1
  const overcast = phase === 'nacht' ? 0 : weather === 'regen' ? 0.28 : weather === 'wolkig' ? 0.08 : 0
  // Schnee schluckt bei bedecktem Himmel kaum Licht, sonst wirkt er grau
  const dull = season === 'winter' ? overcast * 0.15 : overcast * 0.45
  const lit = (hex: string) => mix(mix(hex, tint, amount), '#000000', 1 - gain * dim * (1 - dull))

  const g = GROUND[season]
  const greyed = phase === 'nacht' ? 0 : weather === 'regen' ? 0.55 : weather === 'wolkig' ? 0.18 : 0
  const sky = SKIES[phase].map((c) => mix(mix(c, '#8b97a6', greyed), '#000000', 1 - dim))

  const dayLike = phase === 'tag'
  const snowy = season === 'winter'
  return {
    phase,
    season,
    lit,
    sky,
    meadow: [lit(g.meadow[0]), lit(g.meadow[1])],
    near: lit(g.near),
    far: lit(g.far),
    mountain: [lit(snowy ? '#a9bbd0' : '#8fa5c0'), mix(lit('#b4c4d8'), sky[4], 0.65)],
    forest: lit(g.forest),
    blade: [lit(g.blade[0]), lit(g.blade[1])],
    flowers: g.flowers.map((c) => (phase === 'nacht' ? mix(c, lit(c), 0.7) : mix(c, lit(c), 0.4))),
    horizon: sky[4],
    cloud:
      phase === 'nacht'
        ? ['#3f4c78', '#232d52']
        : phase === 'abend'
          ? ['#ffd2ad', '#a4577a']
          : phase === 'morgen'
            ? ['#ffe6dc', '#c28aa8']
            : weather === 'regen'
              ? ['#bfc7d2', '#7f8a99']
              : ['#ffffff', '#c6d8ea'],
    cloudOpacity: phase === 'nacht' ? 0.4 : 0.92,
    text: dayLike && weather !== 'regen' ? '#12301d' : '#ffffff',
    labelBg: dayLike ? 'rgba(255,255,255,0.78)' : 'rgba(8,14,20,0.5)',
    labelInk: dayLike ? '#16261a' : '#ffffff',
    subInk: dayLike && !snowy ? 'rgba(14,34,18,0.78)' : dayLike ? 'rgba(30,44,60,0.78)' : 'rgba(255,255,255,0.86)',
    pool:
      phase === 'nacht'
        ? 'rgba(120,150,230,0.16)'
        : phase === 'abend'
          ? 'rgba(255,170,100,0.24)'
          : phase === 'morgen'
            ? 'rgba(255,220,180,0.24)'
            : 'rgba(255,250,210,0.28)',
    plantFilter: PLANT_FILTER[phase],
  }
}

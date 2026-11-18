/**
 * Farben der Pflanzen. Blätter bleiben natürlich grün und bekommen nur einen
 * leichten Stich der Habit-Farbe – so bleibt im Garten lesbar:
 * grün = gesund, gelbbraun = welk. Blüten und Früchte tragen die Habit-Farbe.
 */
import { type ColorKey, colorDef, colorHex, hexToHsl, hsl, mixHue } from '../domain/colors'
import type { BlossomTone, BranchTone, CenterTone, LeafTone } from './model'
import type { MutationKey } from '../domain/mutation'

export interface TreePalette {
  leaf: (shade: number, tone?: LeafTone) => string
  branch: (tone?: BranchTone) => string
  blossom: (shade: number, tone?: BlossomTone) => string
  center: (tone: CenterTone) => string
  /** heller Glanz, dunkle Linien/Punkte auf Blüten und Früchten */
  shine: string
  lines: string
  /** Altname für die Mitte der Laubbaum-Blüte */
  blossomCenter: string
  bark: string
  soil: string
  soilShadow: string
  seed: string
  sprout: string
}

const LEAF_HUE = 104

/**
 * @param wilt 0 = gesund … 1 = welk
 * @param dark Dunkelmodus (Grün etwas heller, damit es nicht absäuft)
 */
/** Laubfarbe einer seltenen Mutation (domain/mutation.ts): Farbton, Sättigung, Helligkeit je nach Schattierung */
function mutatedLeaf(m: MutationKey, shade: number, dark: boolean): [number, number, number] {
  switch (m) {
    case 'goldlaub':
      return [46 + shade * 4, 80, (dark ? 58 : 50) + shade * 6]
    case 'silberlaub':
      return [205, 12, (dark ? 80 : 74) + shade * 5]
    case 'nachtlaub':
      return [262 + shade * 10, 48, (dark ? 44 : 32) + shade * 6]
    case 'feuerlaub':
      return [12 + shade * 14, 76, (dark ? 54 : 46) + shade * 5]
    case 'regenbogenlaub':
      return [((shade + 1) * 180 + 360) % 360, 68, (dark ? 56 : 48) + Math.abs(shade) * 4]
  }
}

export function treePalette(color: ColorKey, wilt: number, dark: boolean, mutation: MutationKey | null = null): TreePalette {
  const accent = hexToHsl(colorHex(color))
  // Mehrfarbig (Regenbogen, Feuer, Polarlicht): Jede Blüte zieht ihren Ton aus ihrer Schattierung
  const hues = colorDef(color).hues
  const hueOf = (shade: number) => (hues ? hues[Math.min(hues.length - 1, Math.floor(((shade + 1) / 2) * hues.length))] : accent.h)
  const satOf = hues ? 82 : accent.s
  const litOf = hues ? 60 : accent.l
  const leafHue = mixHue(LEAF_HUE, accent.h, 0.14)
  const baseL = dark ? 47 : 39
  const baseS = dark ? 40 : 44

  /** Grünton welken lassen: Richtung Gelbbraun, weniger Sättigung */
  const wiltGreen = (h: number, s: number, l: number) =>
    hsl({ h: mixHue(h, 40, 0.78 * wilt), s: s * (1 - 0.42 * wilt), l: l + 5 * wilt })

  /** Leuchtfarbe: welk verliert sie Sättigung und Helligkeit wie ein schwacher Akku */
  const energy = (h: number, s: number, l: number, a = 1) =>
    `hsl(${h.toFixed(1)} ${(s * (1 - 0.65 * wilt)).toFixed(1)}% ${(l - 14 * wilt).toFixed(1)}% / ${a})`

  const bark = dark ? 'hsl(25 22% 46%)' : 'hsl(24 26% 34%)'
  const branchColors: Record<BranchTone, string> = {
    bark,
    birch: dark ? 'hsl(40 14% 82%)' : 'hsl(40 18% 90%)',
    mark: dark ? 'hsl(25 10% 22%)' : 'hsl(25 12% 24%)',
    twig: dark ? 'hsl(28 20% 50%)' : 'hsl(26 22% 38%)',
    stem: wiltGreen(96, 42, dark ? 44 : 36),
    cactus: wiltGreen(138, 30, dark ? 42 : 36),
    rib: wiltGreen(130, 30, dark ? 54 : 48),
    // Futuristisch: leuchtet in einem Ton nahe der Habit-Farbe, welk verliert es Energie
    neon: energy(mixHue(170, accent.h, 0.45), 72, dark ? 60 : 46),
    crystal: energy(mixHue(195, accent.h, 0.3), 45, dark ? 80 : 70, 0.92),
    metal: dark ? 'hsl(220 14% 58%)' : 'hsl(222 14% 38%)',
    ring: energy(accent.h, 88, dark ? 70 : 56),
  }

  return {
    leaf: (shade, tone) => {
      if (tone === 'spine') return dark ? 'hsl(45 30% 80%)' : 'hsl(45 35% 88%)'
      // Seltene Mutation: färbt alles Laub (nicht Stacheln und Solarzellen)
      if (mutation && tone !== 'panel') {
        const [h, s, l] = mutatedLeaf(mutation, shade, dark)
        return tone === 'crystal' ? energy(h, s, l + 8, 0.85) : wiltGreen(h, s, l)
      }
      if (tone === 'needle') return wiltGreen(152 + shade * 6, 34 + shade * 4, (dark ? 38 : 27) + shade * 5)
      if (tone === 'ember') return energy(hueOf(shade) + (hues ? 0 : shade * 8), 90, (dark ? 62 : 54) + shade * 5)
      if (tone === 'panel') return energy(mixHue(222, accent.h, 0.25) + shade * 6, 55, (dark ? 40 : 30) + shade * 7)
      if (tone === 'silver') return wiltGreen(88 + shade * 6, 16 + shade * 3, (dark ? 56 : 48) + shade * 5)
      if (tone === 'glow') return energy(mixHue(165, accent.h, 0.4) + shade * 8, 78, (dark ? 60 : 48) + shade * 6)
      if (tone === 'frond') return energy(mixHue(140, accent.h, 0.3) + shade * 8, 70, (dark ? 52 : 40) + shade * 6)
      if (tone === 'crystal') return energy(mixHue(192, accent.h, 0.35) + shade * 10, 60, (dark ? 76 : 66) + shade * 6, 0.8)
      return wiltGreen(leafHue + shade * 7, baseS + shade * 5, baseL + shade * 6)
    },
    branch: (tone) => branchColors[tone ?? 'bark'],
    blossom: (shade, tone) => {
      if (tone === 'green') return wiltGreen(98, 40, dark ? 44 : 36)
      if (tone === 'brown') return hsl({ h: 26, s: 42 - 10 * wilt, l: (dark ? 26 : 22) + shade * 3 })
      if (tone === 'glow') return energy(hueOf(shade) + (hues ? 0 : shade * 6), 92, (dark ? 64 : 56) + shade * 4)
      if (tone === 'core') return energy(hueOf(shade), 70, dark ? 93 : 90)
      if (tone === 'halo') return energy(hueOf(shade), 95, dark ? 66 : 60, 0.3 * (1 - 0.7 * wilt))
      const s = satOf * (1 - 0.6 * wilt)
      const l = litOf + (hues ? 0 : shade * 5) + (dark ? 4 : 0) - 10 * wilt
      return hsl({ h: mixHue(hueOf(shade), 30, 0.4 * wilt), s, l })
    },
    center: (tone) =>
      tone === 'brown' ? 'hsl(26 45% 24%)' : tone === 'pale' ? 'hsl(45 70% 88%)' : wilt > 0.5 ? 'hsl(35 30% 45%)' : 'hsl(46 90% 70%)',
    shine: 'rgba(255,255,255,0.38)',
    lines: 'rgba(40,24,12,0.55)',
    blossomCenter: wilt > 0.5 ? 'hsl(35 30% 45%)' : 'hsl(46 90% 70%)',
    bark,
    soil: dark ? 'hsl(28 16% 26%)' : 'hsl(30 22% 66%)',
    soilShadow: dark ? 'hsl(28 14% 18%)' : 'hsl(32 20% 82%)',
    seed: dark ? 'hsl(27 38% 48%)' : 'hsl(26 40% 38%)',
    sprout: hsl({ h: mixHue(LEAF_HUE + 8, 40, 0.7 * wilt), s: 48 * (1 - 0.4 * wilt), l: (dark ? 52 : 44) + 4 * wilt }),
  }
}

export const DORMANT_BARK = (dark: boolean) => (dark ? 'hsl(30 6% 42%)' : 'hsl(30 6% 58%)')

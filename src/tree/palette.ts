/**
 * Farben der Pflanzen. Blätter bleiben natürlich grün und bekommen nur einen
 * leichten Stich der Habit-Farbe – so bleibt im Garten lesbar:
 * grün = gesund, gelbbraun = welk. Blüten und Früchte tragen die Habit-Farbe.
 */
import { type ColorKey, colorHex, hexToHsl, hsl, mixHue } from '../domain/colors'
import type { BlossomTone, BranchTone, CenterTone, LeafTone } from './model'

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
export function treePalette(color: ColorKey, wilt: number, dark: boolean): TreePalette {
  const accent = hexToHsl(colorHex(color))
  const leafHue = mixHue(LEAF_HUE, accent.h, 0.14)
  const baseL = dark ? 47 : 39
  const baseS = dark ? 40 : 44

  /** Grünton welken lassen: Richtung Gelbbraun, weniger Sättigung */
  const wiltGreen = (h: number, s: number, l: number) =>
    hsl({ h: mixHue(h, 40, 0.78 * wilt), s: s * (1 - 0.42 * wilt), l: l + 5 * wilt })

  const bark = dark ? 'hsl(25 22% 46%)' : 'hsl(24 26% 34%)'
  const branchColors: Record<BranchTone, string> = {
    bark,
    birch: dark ? 'hsl(40 14% 82%)' : 'hsl(40 18% 90%)',
    mark: dark ? 'hsl(25 10% 22%)' : 'hsl(25 12% 24%)',
    twig: dark ? 'hsl(28 20% 50%)' : 'hsl(26 22% 38%)',
    stem: wiltGreen(96, 42, dark ? 44 : 36),
    cactus: wiltGreen(138, 30, dark ? 42 : 36),
    rib: wiltGreen(130, 30, dark ? 54 : 48),
  }

  return {
    leaf: (shade, tone) => {
      if (tone === 'spine') return dark ? 'hsl(45 30% 80%)' : 'hsl(45 35% 88%)'
      if (tone === 'needle') return wiltGreen(152 + shade * 6, 34 + shade * 4, (dark ? 38 : 27) + shade * 5)
      return wiltGreen(leafHue + shade * 7, baseS + shade * 5, baseL + shade * 6)
    },
    branch: (tone) => branchColors[tone ?? 'bark'],
    blossom: (shade, tone) => {
      if (tone === 'green') return wiltGreen(98, 40, dark ? 44 : 36)
      if (tone === 'brown') return hsl({ h: 26, s: 42 - 10 * wilt, l: (dark ? 26 : 22) + shade * 3 })
      const s = accent.s * (1 - 0.6 * wilt)
      const l = accent.l + shade * 5 + (dark ? 4 : 0) - 10 * wilt
      return hsl({ h: mixHue(accent.h, 30, 0.4 * wilt), s, l })
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

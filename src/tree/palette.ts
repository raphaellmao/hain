/**
 * Farben des Baums. Blätter bleiben natürlich grün und bekommen nur einen
 * leichten Stich der Habit-Farbe – so bleibt im Garten lesbar:
 * grün = gesund, gelbbraun = welk. Die Blüten tragen die Habit-Farbe.
 */
import { type ColorKey, colorHex, hexToHsl, hsl, mixHue } from '../domain/colors'

export interface TreePalette {
  leaf: (shade: number) => string
  blossom: (shade: number) => string
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

  return {
    leaf: (shade) => {
      const h = mixHue(leafHue + shade * 7, 40, 0.78 * wilt)
      const s = (baseS + shade * 5) * (1 - 0.42 * wilt)
      const l = baseL + shade * 6 + 5 * wilt
      return hsl({ h, s, l })
    },
    blossom: (shade) => {
      const s = accent.s * (1 - 0.6 * wilt)
      const l = accent.l + shade * 5 + (dark ? 4 : 0) - 10 * wilt
      return hsl({ h: mixHue(accent.h, 30, 0.4 * wilt), s, l })
    },
    blossomCenter: wilt > 0.5 ? 'hsl(35 30% 45%)' : 'hsl(46 90% 70%)',
    bark: dark ? 'hsl(25 22% 46%)' : 'hsl(24 26% 34%)',
    soil: dark ? 'hsl(28 16% 26%)' : 'hsl(30 22% 66%)',
    soilShadow: dark ? 'hsl(28 14% 18%)' : 'hsl(32 20% 82%)',
    seed: dark ? 'hsl(27 38% 48%)' : 'hsl(26 40% 38%)',
    sprout: hsl({ h: mixHue(LEAF_HUE + 8, 40, 0.7 * wilt), s: 48 * (1 - 0.4 * wilt), l: (dark ? 52 : 44) + 4 * wilt }),
  }
}

export const DORMANT_BARK = (dark: boolean) => (dark ? 'hsl(30 6% 42%)' : 'hsl(30 6% 58%)')

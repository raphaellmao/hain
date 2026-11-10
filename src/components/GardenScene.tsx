/**
 * Lebendiger Garten: Himmel, Licht, Wetter und Tiere folgen der echten Tageszeit,
 * Jahreszeit und Mondphase (lib/sky.ts), ohne dass man etwas tun muss.
 *
 *   Morgen  – Morgenrot, Nebel in den Tälern, grasende Rehe
 *   Tag     – Sonne im Bogen, ziehende Wolken, Vogelzüge, Enten auf dem See
 *   Abend   – Abendrot, lange Strahlen, Fledermäuse
 *   Nacht   – Sterne, Milchstraße, Mond in der echten Phase, Eule, Glühwürmchen
 *
 * Zusammengesetzt aus garden/: SkyScene (hinten), Wiese als Kachelbild,
 * die Pflanzen als children, Wildlife (vorn).
 */
import type { CSSProperties, ReactNode } from 'react'
import { meadowBackground } from '../garden/meadow'
import type { ScenePalette } from '../garden/palette'
import { SkyScene } from '../garden/SkyScene'
import { Wildlife } from '../garden/Wildlife'
import type { Sky } from '../lib/sky'

export function GardenScene({ sky, p, perfect = false, children }: { sky: Sky; p: ScenePalette; perfect?: boolean; children: ReactNode }) {
  const meadow = meadowBackground(p, `${sky.phase}|${sky.season}|${sky.weather}|${p.meadow[0]}`)

  return (
    <div
      className="garden-scene relative min-h-dvh overflow-hidden"
      style={
        {
          backgroundImage: meadow.image,
          backgroundSize: meadow.size,
          color: p.text,
          '--plant-filter': p.plantFilter,
        } as CSSProperties & { '--plant-filter': string }
      }
      data-phase={sky.phase}
      data-season={sky.season}
      data-weather={sky.weather}
    >
      <SkyScene sky={sky} p={p} perfect={perfect} />
      {sky.phase === 'nacht' && <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_40%,transparent_40%,rgba(3,6,20,0.5))]" />}
      <div className="relative z-[2]">{children}</div>
      <Wildlife sky={sky} p={p} perfect={perfect} />
    </div>
  )
}

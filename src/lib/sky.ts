/**
 * Tageszeit und Jahreszeit für den lebendigen Garten.
 *
 * Sonnenauf- und -untergang werden grob für Deutschland (≈ 51° N) geschätzt:
 * Tageslänge schwankt übers Jahr zwischen knapp 8 und gut 16 Stunden, der
 * Mittag liegt bei ≈ 12:20 Uhr (Winterzeit) bzw. 13:20 Uhr (Sommerzeit).
 * Für die Stimmung im Bild reicht das völlig.
 */
import { useEffect, useState } from 'react'

export type Phase = 'nacht' | 'morgen' | 'tag' | 'abend'
export type Season = 'fruehling' | 'sommer' | 'herbst' | 'winter'

export interface Sky {
  phase: Phase
  season: Season
  /** Stand der Sonne über den Tag: 0 = Aufgang, 1 = Untergang (außerhalb geklemmt) */
  sun: number
  /** Stand des Mondes über die Nacht: 0 = Abend, 1 = Morgen */
  moon: number
}

export function skyAt(now: Date): Sky {
  const start = new Date(now.getFullYear(), 0, 1)
  const doy = Math.floor((now.getTime() - start.getTime()) / 86_400_000)
  const dayLength = 12 + 4.3 * Math.sin((2 * Math.PI * (doy - 80)) / 365.25)
  const dst = new Date(now.getFullYear(), 0, 1).getTimezoneOffset() !== now.getTimezoneOffset()
  const noon = dst ? 13.33 : 12.33
  const rise = noon - dayLength / 2
  const set = noon + dayLength / 2
  const h = now.getHours() + now.getMinutes() / 60

  let phase: Phase
  if (h < rise - 0.75 || h > set + 0.75) phase = 'nacht'
  else if (h < rise + 1) phase = 'morgen'
  else if (h > set - 1) phase = 'abend'
  else phase = 'tag'

  const m = now.getMonth()
  const season: Season = m >= 2 && m <= 4 ? 'fruehling' : m >= 5 && m <= 7 ? 'sommer' : m >= 8 && m <= 10 ? 'herbst' : 'winter'

  const nightLen = 24 - (set - rise)
  const sinceSet = (h - set + 24) % 24

  return {
    phase,
    season,
    sun: Math.max(0, Math.min(1, (h - rise) / (set - rise))),
    moon: Math.max(0, Math.min(1, sinceSet / nightLen)),
  }
}

/** Nur Entwicklung: ?zeit=nacht|morgen|tag|abend&saison=winter|… zum Ausprobieren */
function devOverride(sky: Sky): Sky {
  if (!import.meta.env.DEV) return sky
  const q = new URLSearchParams(location.search)
  const phase = q.get('zeit') as Phase | null
  const season = q.get('saison') as Season | null
  const sun = { morgen: 0.05, tag: 0.45, abend: 0.93, nacht: 0 }
  return {
    ...sky,
    ...(phase ? { phase, sun: sun[phase], moon: 0.4 } : {}),
    ...(season ? { season } : {}),
  }
}

/** Aktueller Himmel, aktualisiert jede Minute (und beim Zurückkehren in die App). */
export function useSky(): Sky {
  const [sky, setSky] = useState(() => devOverride(skyAt(new Date())))
  useEffect(() => {
    const update = () => setSky(devOverride(skyAt(new Date())))
    const t = window.setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return sky
}

export const GREETING: Record<Phase, string> = {
  morgen: 'Guten Morgen',
  tag: 'Guten Tag',
  abend: 'Guten Abend',
  nacht: 'Gute Nacht',
}

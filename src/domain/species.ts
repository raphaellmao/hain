/**
 * Pflanzenarten: Namen und Stufenbezeichnungen. Die Formen selbst erzeugt
 * tree/species/ – hier steht nur, was auch Logik und Texte brauchen.
 */

export const SPECIES_KEYS = ['laubbaum', 'kirsche', 'apfel', 'birke', 'weide', 'tanne', 'kaktus', 'sonnenblume'] as const
export type SpeciesKey = (typeof SPECIES_KEYS)[number]

/** Ältere Habits ohne Art bleiben Laubbäume – sie sehen dadurch unverändert aus. */
export const DEFAULT_SPECIES: SpeciesKey = 'laubbaum'

const COMMON = ['Erde', 'Samen', 'Keimling'] as const

/** Name + Stufen 3 … 9 (3–6: die Pflanze selbst, 7–9: der Hain wächst) */
export const SPECIES_INFO: Record<SpeciesKey, { label: string; stages: string[] }> = {
  laubbaum: { label: 'Laubbaum', stages: ['Kleiner Busch', 'Junger Baum', 'Großer Baum', 'Blühender Baum', 'Kleiner Hain', 'Hain', 'Alter Hain'] },
  kirsche: { label: 'Kirschbaum', stages: ['Kleiner Busch', 'Junger Kirschbaum', 'Großer Kirschbaum', 'Kirschblüte', 'Kleiner Kirschhain', 'Kirschhain', 'Kirschgarten'] },
  apfel: { label: 'Apfelbaum', stages: ['Kleiner Busch', 'Junger Apfelbaum', 'Großer Apfelbaum', 'Apfelbaum mit Früchten', 'Kleine Obstwiese', 'Streuobstwiese', 'Alter Obstgarten'] },
  birke: { label: 'Birke', stages: ['Kleiner Busch', 'Junge Birke', 'Große Birke', 'Birke mit Kätzchen', 'Birkengruppe', 'Birkenhain', 'Birkenwald'] },
  weide: { label: 'Trauerweide', stages: ['Kleiner Busch', 'Junge Weide', 'Große Weide', 'Blühende Weide', 'Weidengruppe', 'Weidenhain', 'Alter Weidenhain'] },
  tanne: { label: 'Tanne', stages: ['Kleines Bäumchen', 'Junge Tanne', 'Große Tanne', 'Tanne mit Zapfen', 'Kleine Schonung', 'Tannenhain', 'Tannenwald'] },
  kaktus: { label: 'Kaktus', stages: ['Kleiner Kaktus', 'Junger Kaktus', 'Großer Kaktus', 'Blühender Kaktus', 'Kakteengruppe', 'Kakteengarten', 'Kakteenwüste'] },
  sonnenblume: { label: 'Sonnenblume', stages: ['Jungpflanze', 'Hohe Pflanze', 'Knospe', 'Blühende Sonnenblume', 'Sonnenblumenbeet', 'Sonnenblumenfeld', 'Goldenes Feld'] },
}

export function isSpecies(v: unknown): v is SpeciesKey {
  return typeof v === 'string' && (SPECIES_KEYS as readonly string[]).includes(v)
}

export const speciesOf = (h: { species?: SpeciesKey }): SpeciesKey => h.species ?? DEFAULT_SPECIES

/** Bezeichnung der Stufe 0 … 9 für eine Art */
export function stageName(species: SpeciesKey | undefined, stage: number): string {
  if (stage < 3) return COMMON[Math.max(0, stage)]
  const s = SPECIES_INFO[species ?? DEFAULT_SPECIES].stages
  return s[Math.min(s.length - 1, stage - 3)]
}

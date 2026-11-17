/**
 * Pflanzenarten: Namen und Stufenbezeichnungen. Die Formen selbst erzeugt
 * tree/species/ – hier steht nur, was auch Logik und Texte brauchen.
 */

export const SPECIES_KEYS = [
  'laubbaum', 'kirsche', 'apfel', 'birke', 'weide', 'tanne', 'kaktus', 'sonnenblume', 'olive', 'ahorn', 'palme',
  // erfunden, futuristisch
  'kristall', 'lumenpilz', 'orbital', 'neonfarn',
] as const
export type SpeciesKey = (typeof SPECIES_KEYS)[number]

/** Ältere Habits ohne Art bleiben Laubbäume – sie sehen dadurch unverändert aus. */
export const DEFAULT_SPECIES: SpeciesKey = 'laubbaum'

const COMMON = ['Erde', 'Samen', 'Keimling'] as const

/** Name + Stufen 3 … 9 (3–6: die Pflanze selbst, 7–9: der Hain wächst) */
export const SPECIES_INFO: Record<SpeciesKey, { label: string; stages: string[]; future?: true }> = {
  laubbaum: { label: 'Laubbaum', stages: ['Kleiner Busch', 'Junger Baum', 'Großer Baum', 'Blühender Baum', 'Kleiner Hain', 'Hain', 'Alter Hain'] },
  kirsche: { label: 'Kirschbaum', stages: ['Kleiner Busch', 'Junger Kirschbaum', 'Großer Kirschbaum', 'Kirschblüte', 'Kleiner Kirschhain', 'Kirschhain', 'Kirschgarten'] },
  apfel: { label: 'Apfelbaum', stages: ['Kleiner Busch', 'Junger Apfelbaum', 'Großer Apfelbaum', 'Apfelbaum mit Früchten', 'Kleine Obstwiese', 'Streuobstwiese', 'Alter Obstgarten'] },
  birke: { label: 'Birke', stages: ['Kleiner Busch', 'Junge Birke', 'Große Birke', 'Birke mit Kätzchen', 'Birkengruppe', 'Birkenhain', 'Birkenwald'] },
  weide: { label: 'Trauerweide', stages: ['Kleiner Busch', 'Junge Weide', 'Große Weide', 'Blühende Weide', 'Weidengruppe', 'Weidenhain', 'Alter Weidenhain'] },
  tanne: { label: 'Tanne', stages: ['Kleines Bäumchen', 'Junge Tanne', 'Große Tanne', 'Tanne mit Zapfen', 'Kleine Schonung', 'Tannenhain', 'Tannenwald'] },
  kaktus: { label: 'Kaktus', stages: ['Kleiner Kaktus', 'Junger Kaktus', 'Großer Kaktus', 'Blühender Kaktus', 'Kakteengruppe', 'Kakteengarten', 'Kakteenwüste'] },
  sonnenblume: { label: 'Sonnenblume', stages: ['Jungpflanze', 'Hohe Pflanze', 'Knospe', 'Blühende Sonnenblume', 'Sonnenblumenbeet', 'Sonnenblumenfeld', 'Goldenes Feld'] },
  olive: { label: 'Olivenbaum', stages: ['Kleiner Busch', 'Junger Olivenbaum', 'Knorriger Olivenbaum', 'Olivenbaum mit Früchten', 'Kleiner Olivenhain', 'Olivenhain', 'Alter Olivenhain'] },
  ahorn: { label: 'Ahorn', stages: ['Kleiner Busch', 'Junger Ahorn', 'Großer Ahorn', 'Ahorn mit Flügelsamen', 'Ahorngruppe', 'Ahornhain', 'Ahornwald'] },
  palme: { label: 'Palme', stages: ['Jungpalme', 'Junge Palme', 'Hohe Palme', 'Palme mit Früchten', 'Palmengruppe', 'Palmenhain', 'Oase'] },
  kristall: { label: 'Kristallbaum', future: true, stages: ['Kristallspross', 'Junger Kristallbaum', 'Kristallbaum', 'Leuchtender Kristallbaum', 'Kristallgruppe', 'Kristallhain', 'Kristallwald'] },
  lumenpilz: { label: 'Lumenpilz', future: true, stages: ['Pilzknospe', 'Junger Lumenpilz', 'Schirmturm', 'Leuchtender Schirmturm', 'Pilzkolonie', 'Lumenwald', 'Leuchtendes Myzel'] },
  orbital: { label: 'Orbitalblume', future: true, stages: ['Energieknospe', 'Erster Ring', 'Doppelring', 'Orbit in Blüte', 'Kleines System', 'Sternsystem', 'Galaxie'] },
  neonfarn: { label: 'Neonfarn', future: true, stages: ['Eingerollter Wedel', 'Junger Farn', 'Fraktalfarn', 'Leuchtender Farn', 'Farninsel', 'Farnwald', 'Urzeitwald'] },
}

export const isFutureSpecies = (k: SpeciesKey) => SPECIES_INFO[k].future === true

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

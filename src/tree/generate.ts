/**
 * Zugang zu den Pflanzenmodellen (mit Zwischenspeicher) und gemeinsame
 * Größenregeln. Die Arten selbst stehen in species/, das Modell in model.ts.
 */
import { clamp, lerp } from './rng'
import { DEFAULT_SPECIES, type SpeciesKey } from '../domain/species'
import { GENERATORS } from './species'
import type { PlantModel } from './model'

export { BASE_X, GROUND, VIEW, leafVisible, quadPoint } from './model'
export type { Blossom, Branch, Leaf, PlantModel } from './model'
export { leafPath } from './shapes'

// Pflanzen werden oft gezeichnet, aber selten neu erzeugt → zwischenspeichern.
const cache = new Map<string, PlantModel>()

export function plantModel(species: SpeciesKey | undefined, seed: number): PlantModel {
  const key = `${species ?? DEFAULT_SPECIES}:${seed}`
  let m = cache.get(key)
  if (!m) cache.set(key, (m = GENERATORS[species ?? DEFAULT_SPECIES](seed)))
  return m
}

/** Der ursprüngliche Laubbaum (für Tests und Altbestand) */
export const generateTree = (seed: number) => GENERATORS.laubbaum(seed)

/**
 * Gesamtgröße der Pflanze: ein junger Busch ist kleiner als der fertige Baum.
 * Zusammen mit den nach und nach erscheinenden Ästen wirkt das wie Wachsen.
 */
export function treeScale(g: number): number {
  return lerp(0.55, 1, clamp((g - 3) / 3, 0, 1))
}

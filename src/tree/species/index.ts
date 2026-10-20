import type { SpeciesKey } from '../../domain/species'
import type { PlantModel } from '../model'
import { apfel, birke, kirsche, laubbaum } from './trees'
import { weide } from './weide'
import { tanne } from './tanne'
import { kaktus } from './kaktus'
import { sonnenblume } from './sonnenblume'

/** Erzeuger je Art: Seed → ausgewachsene Pflanze */
export const GENERATORS: Record<SpeciesKey, (seed: number) => PlantModel> = {
  laubbaum,
  kirsche,
  apfel,
  birke,
  weide,
  tanne,
  kaktus,
  sonnenblume,
}

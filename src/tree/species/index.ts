import type { SpeciesKey } from '../../domain/species'
import type { PlantModel } from '../model'
import { ahorn, apfel, birke, kirsche, laubbaum, olive } from './trees'
import { palme } from './palme'
import { kristall, lumenpilz, neonfarn, orbital } from './futur'
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
  olive,
  ahorn,
  palme,
  kristall,
  lumenpilz,
  orbital,
  neonfarn,
}

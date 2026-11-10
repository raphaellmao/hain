import { useMemo } from 'react'
import { motion } from 'motion/react'
import { colorHex } from '../domain/colors'
import { stageLabel } from '../domain/summary'
import { navigate, paths } from '../app/router'
import { HabitVisual } from '../components/HabitVisual'
import { TERRITORY_STATUS } from '../domain/shadow'
import { Fab } from '../components/Fab'
import { GardenScene } from '../components/GardenScene'
import { scenePalette, rnd } from '../garden/palette'
import { PlantGround, PlantLife } from '../garden/PlantSpot'
import { useSky } from '../lib/sky'
import { useDarkMode } from '../lib/useDarkMode'
import { useGardenItems } from '../garden/useGardenItems'
import { useToday } from '../db/hooks'
import { dayStatus } from '../domain/perfect'
import { openShareSheet } from '../lib/shareSheet'
import { IconShare } from '../components/icons'

/**
 * Alle Bäume auf einen Blick, mitten in der Landschaft. Bewusst ohne Animationen
 * pro Blatt – hier stehen viele Bäume gleichzeitig, das soll auch auf älteren
 * Handys flüssig scrollen. Die Pflanzen stehen nicht in Reih und Glied: Die mittlere
 * Spalte ist versetzt, und jede bekommt aus ihrem Seed eine kleine eigene Abweichung.
 */
export function GardenScreen() {
  const loaded = useGardenItems()
  const today = useToday()
  const sky = useSky()
  const dark = useDarkMode()
  const p = useMemo(() => scenePalette(sky.phase, sky.season, sky.weather, dark), [sky.phase, sky.season, sky.weather, dark])

  if (!loaded) return null
  const items = loaded
  // Heute alles erledigt: Der Garten feiert bis zum Tageswechsel mit
  const perfect = dayStatus(items, today).complete

  const isBare = (s: (typeof items)[number]['summary']) => s.health.dormant && s.stage === 0
  const bare = items.filter((i) => isBare(i.summary)).length
  const wilting = items.filter((i) => i.summary.health.wilted && !isBare(i.summary)).length
  const thriving = items.length - wilting - bare
  const summaryLine = [
    thriving && `${thriving} gedeih${thriving === 1 ? 't' : 'en'}`,
    wilting && `${wilting} welk${wilting === 1 ? 't' : 'en'}`,
    bare && `${bare} kahl`,
  ]
    .filter(Boolean)
    .concat(perfect ? ['✨ Perfekter Tag'] : [])
    .join(' · ')

  return (
    <GardenScene sky={sky} p={p} perfect={perfect}>
      {/* pb: Gras und Tiere im Vordergrund sollen die letzte Reihe nicht verdecken */}
      <div className="pb-nav">
        <header className="px-safe pt-safe">
          <div className="flex items-end justify-between gap-3 pt-2 pb-4">
            <div className="min-w-0 [text-shadow:0_1px_10px_rgba(0,0,0,0.22)]">
              <p className="text-[13px] font-semibold tracking-wide uppercase opacity-90">{items.length === 0 ? 'Noch leer' : summaryLine}</p>
              <h1 className="text-[32px] font-bold leading-tight">Garten</h1>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => openShareSheet('garten')}
                aria-label="Garten als Bild teilen"
                className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full backdrop-blur-sm"
                style={{ background: p.labelBg, color: p.labelInk }}
              >
                <IconShare width={21} height={21} />
              </button>
            )}
          </div>
        </header>

        <main className="px-safe pt-10 pb-16">
          {items.length === 0 ? (
            <p className="mx-auto mt-24 max-w-xs rounded-2xl bg-surface/85 p-4 text-center text-[15px] text-ink">
              Hier wachsen deine Bäume, sobald du eine Gewohnheit anlegst.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-x-1 gap-y-5">
              {items.map(({ habit, summary }, idx) => {
                const wilted = summary.health.wilted && !isBare(summary)
                const shadow = habit.metaphor === 'schatten'
                const status = shadow ? TERRITORY_STATUS[summary.shadow.status].label : wilted ? 'welkt' : stageLabel(summary, habit.species)
                const warn = shadow ? summary.shadow.status <= 1 : wilted
                const seed = habit.seed % 997
                return (
                  <motion.li
                    key={habit.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx, 12) * 0.03 }}
                    style={{ marginTop: idx % 3 === 1 ? 22 : idx % 3 === 2 ? 6 : 0 }}
                  >
                    <button
                      type="button"
                      onClick={() => navigate(paths.habit(habit.id))}
                      className="flex w-full flex-col items-center rounded-3xl pb-1 active:opacity-75"
                    >
                      <span className="relative block aspect-square w-full" style={{ scale: String(0.95 + rnd(seed, 3) * 0.1) }}>
                        {!shadow && <PlantGround seed={habit.seed} spread={summary.g >= 7 ? 1.3 : summary.g >= 3 ? 1 : 0.7} p={p} />}
                        {/* jede Pflanze wiegt sich in ihrem eigenen Takt */}
                        <span className="sway plant-lit absolute inset-0 block" style={{ animationDuration: `${8 + (idx % 5) * 1.3}s`, animationDelay: `${-idx * 1.7}s` }}>
                          <HabitVisual habit={habit} summary={summary} ground={false} className="size-full" />
                        </span>
                        {!shadow && idx < 12 && <PlantLife index={idx} g={summary.g} wilted={wilted} color={colorHex(habit.color)} phase={p.phase} />}
                      </span>
                      <span
                        className="relative mt-1 flex max-w-full items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[13px] leading-tight font-semibold"
                        style={{ background: p.labelBg, color: p.labelInk }}
                      >
                        <span aria-hidden>{habit.emoji}</span>
                        <span className="truncate">{habit.name}</span>
                      </span>
                      <span
                        className={`relative mt-0.5 max-w-full text-center text-[11px] leading-tight ${warn ? 'rounded-full bg-warn px-1.5 font-semibold text-white' : ''}`}
                        style={warn ? undefined : { color: p.subInk, textShadow: p.phase === 'tag' ? undefined : '0 1px 3px rgba(0,0,0,0.55)' }}
                      >
                        {status}
                      </span>
                    </button>
                  </motion.li>
                )
              })}
            </ul>
          )}
        </main>

        <Fab onClick={() => navigate(paths.new)} />
      </div>
    </GardenScene>
  )
}

import { useSettings } from '../db/hooks'
import { saveSettings } from '../db/repo'
import { DENSITIES, type Density } from '../domain/types'
import { tick } from '../lib/haptics'

/** Zwei Knöpfe „kleiner“/„größer“ für die Anzeigegröße der Listen (gleiche Einstellung wie unter Darstellung) */
export function DensitySwitch() {
  const { density } = useSettings()
  const index = DENSITIES.findIndex((d) => d.value === density)
  const set = (d: Density) => {
    tick()
    void saveSettings({ density: d })
  }
  const label = DENSITIES[index]?.label ?? 'Normal'
  return (
    <div className="mb-1 flex shrink-0 items-center rounded-full bg-surface p-0.5" role="group" aria-label={`Anzeigegröße: ${label}`}>
      <button
        type="button"
        aria-label="Kleiner anzeigen – mehr auf einmal"
        disabled={index <= 0}
        onClick={() => set(DENSITIES[index - 1].value)}
        className="flex size-10 items-center justify-center rounded-full text-[13px] font-bold disabled:opacity-30"
      >
        A<span className="text-[10px]">−</span>
      </button>
      <span className="w-px self-stretch bg-line" aria-hidden />
      <button
        type="button"
        aria-label="Größer anzeigen"
        disabled={index >= DENSITIES.length - 1}
        onClick={() => set(DENSITIES[index + 1].value)}
        className="flex size-10 items-center justify-center rounded-full text-[17px] font-bold disabled:opacity-30"
      >
        A<span className="text-[11px]">+</span>
      </button>
    </div>
  )
}

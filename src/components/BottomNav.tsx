import { navigate, paths, type Route } from '../app/router'
import { IconGarden, IconSettings, IconToday } from './icons'

const items = [
  { key: 'today', label: 'Heute', path: paths.today, Icon: IconToday },
  { key: 'garden', label: 'Garten', path: paths.garden, Icon: IconGarden },
  { key: 'settings', label: 'Einstellungen', path: paths.settings, Icon: IconSettings },
] as const

/** Untere Navigationsleiste – im Daumenbereich, über dem Home-Indicator. */
export function BottomNav({ route }: { route: Route }) {
  // Detailansicht gehört optisch zum Garten
  const active = route.name === 'habit' ? 'garden' : route.name

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 pb-safe backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-md">
        {items.map(({ key, label, path, Icon }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => !isActive && navigate(path, { replace: true })}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-accent' : 'text-muted'
              }`}
            >
              <Icon width={24} height={24} />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

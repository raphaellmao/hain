import { navigate, paths, type Route } from '../app/router'
import { useToday, useTodos } from '../db/hooks'
import { urgentTodos } from '../domain/todos'
import { IconGarden, IconList, IconSettings, IconToday, IconTrophy } from './icons'

/** Die Hauptansichten, in der Reihenfolge der Leiste – dazwischen lässt sich auch wischen. */
export const TABS = [
  { key: 'today', label: 'Heute', path: paths.today, Icon: IconToday },
  { key: 'todos', label: 'To-dos', path: paths.todos, Icon: IconList },
  { key: 'garden', label: 'Garten', path: paths.garden, Icon: IconGarden },
  { key: 'erfolge', label: 'Erfolge', path: paths.erfolge, Icon: IconTrophy },
  { key: 'settings', label: 'Einstellungen', path: paths.settings, Icon: IconSettings },
] as const

/** Untere Navigationsleiste – im Daumenbereich, über dem Home-Indicator. */
export function BottomNav({ route }: { route: Route }) {
  // Detailansicht gehört optisch zum Garten, der Rückblick zu den Erfolgen
  const active = route.name === 'habit' ? 'garden' : route.name === 'review' ? 'erfolge' : route.name === 'habits' ? 'settings' : route.name
  const todos = useTodos()
  const today = useToday()
  const urgent = todos ? urgentTodos(todos, today).length : 0

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 pb-safe backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-md">
        {TABS.map(({ key, label, path, Icon }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => !isActive && navigate(path, { replace: true })}
              aria-current={isActive ? 'page' : undefined}
              aria-label={key === 'todos' && urgent > 0 ? `To-dos, ${urgent} offen` : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors max-[340px]:text-[10px] ${
                isActive ? 'text-accent' : 'text-muted'
              }`}
            >
              <span className="relative">
                <Icon width={24} height={24} />
                {key === 'todos' && urgent > 0 && (
                  <span
                    className="absolute -top-1 -right-2.5 h-4 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white tabular-nums"
                    aria-hidden
                  >
                    {urgent > 9 ? '9+' : urgent}
                  </span>
                )}
              </span>
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

import { useRoute } from './app/router'
import { BottomNav } from './components/BottomNav'
import { ConfirmHost } from './components/ConfirmHost'
import { ExcuseHost } from './components/ExcuseHost'
import { Toaster } from './components/Toaster'
import { UpdateToast } from './components/UpdateToast'
import { GardenScreen } from './screens/GardenScreen'
import { HabitDetailScreen } from './screens/HabitDetailScreen'
import { HabitFormScreen } from './screens/HabitFormScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TodayScreen } from './screens/TodayScreen'
import { AchievementsScreen } from './screens/AchievementsScreen'
import { AchievementWatcher } from './app/achievements'

export default function App() {
  const route = useRoute()

  let screen
  switch (route.name) {
    case 'today':
      screen = <TodayScreen />
      break
    case 'garden':
      screen = <GardenScreen />
      break
    case 'settings':
      screen = <SettingsScreen />
      break
    case 'erfolge':
      screen = <AchievementsScreen />
      break
    case 'habit':
      screen = <HabitDetailScreen key={route.id} id={route.id} />
      break
    case 'new':
      screen = <HabitFormScreen key="new" />
      break
    case 'edit':
      screen = <HabitFormScreen key={route.id} id={route.id} />
      break
  }

  // Im Formular gibt es unten den Speichern-Knopf statt der Navigation
  const showNav = route.name !== 'new' && route.name !== 'edit'

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      {screen}
      {showNav && <BottomNav route={route} />}
      <Toaster />
      <UpdateToast />
      <ExcuseHost />
      <AchievementWatcher />
      <ConfirmHost />
    </div>
  )
}

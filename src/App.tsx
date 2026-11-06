import { useRoute } from './app/router'
import { BottomNav } from './components/BottomNav'
import { ConfirmHost } from './components/ConfirmHost'
import { ShareHost } from './components/ShareHost'
import { ExcuseHost } from './components/ExcuseHost'
import { ReminderHost } from './components/ReminderHost'
import { AbsenceHost } from './components/AbsenceHost'
import { SwipePager } from './components/SwipePager'
import { Toaster } from './components/Toaster'
import { TodoSheetHost } from './components/TodoSheetHost'
import { UpdateToast } from './components/UpdateToast'
import { GardenScreen } from './screens/GardenScreen'
import { HabitDetailScreen } from './screens/HabitDetailScreen'
import { HabitFormScreen } from './screens/HabitFormScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { HabitsScreen } from './screens/HabitsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TodayScreen } from './screens/TodayScreen'
import { TodosScreen } from './screens/TodosScreen'
import { AchievementsScreen } from './screens/AchievementsScreen'
import { AchievementWatcher } from './app/achievements'

export default function App() {
  const route = useRoute()

  let screen
  switch (route.name) {
    case 'today':
      screen = <TodayScreen />
      break
    case 'todos':
      screen = <TodosScreen />
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
    case 'review':
      screen = <ReviewScreen week={route.week} />
      break
    case 'habits':
      screen = <HabitsScreen />
      break
    case 'habit':
      screen = <HabitDetailScreen key={route.id} id={route.id} />
      break
    case 'new':
      screen = <HabitFormScreen key={`new-${route.template ?? ''}`} template={route.template} />
      break
    case 'edit':
      screen = <HabitFormScreen key={route.id} id={route.id} />
      break
  }

  // Im Formular gibt es unten den Speichern-Knopf statt der Navigation
  const showNav = route.name !== 'new' && route.name !== 'edit'

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <SwipePager route={route}>{screen}</SwipePager>
      {showNav && <BottomNav route={route} />}
      <Toaster />
      <UpdateToast />
      <ExcuseHost />
      <TodoSheetHost />
      <AbsenceHost />
      <ReminderHost />
      <AchievementWatcher />
      <ShareHost />
      <ConfirmHost />
    </div>
  )
}

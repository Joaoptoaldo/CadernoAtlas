import '../App.css'
import AppLayout from './AppLayout'
import DashboardPage from '../pages/DashboardPage'
import DemandsPage from '../pages/DemandsPage'
import PlanningPage from '../pages/PlanningPage'
import StudySessionsPage from '../pages/StudySessionsPage'
import { useAppController } from './useAppController'

function App() {
  const controller = useAppController()

  return (
    <AppLayout {...controller.navigation}>
      <PlanningPage {...controller.planningPage} />
      <DemandsPage {...controller.demandsPage} />
      {controller.navigation.activeSection === 'dashboard' && <DashboardPage {...controller.dashboardPage} />}
      {controller.navigation.activeSection === 'study-sessions' && <StudySessionsPage {...controller.studySessionsPage} />}
    </AppLayout>
  )
}

export default App

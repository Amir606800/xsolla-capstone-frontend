import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import ProtectedRoute from './components/ProtectedRoute'
import { Allow, ByRole, StudentOnly } from './components/RoleRoutes'
import { canAuthor, canMentor } from './utils/roles'

// Route-level code splitting: each screen is downloaded only when visited.
const AuthPage = lazy(() => import('./pages/AuthPage'))
const AppLayout = lazy(() => import('./components/layout/AppLayout'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const ModulePage = lazy(() => import('./pages/ModulePage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const GradesPage = lazy(() => import('./pages/GradesPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
// staff: one dashboard for everyone, its sections depend on the roles
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'))
// lecturer role
const ContentPage = lazy(() => import('./pages/lecturer/ContentPage'))
const ModuleEditorPage = lazy(() => import('./pages/lecturer/ModuleEditorPage'))
// mentor role
const MentorTeamPage = lazy(() => import('./pages/mentor/MentorTeamPage'))
const GradingPage = lazy(() => import('./pages/mentor/GradingPage'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<ByRole student={<DashboardPage />} staff={<StaffDashboard />} />} />
            <Route
              path="/courses"
              element={<ByRole student={<CoursesPage />} staff={<Allow when={canAuthor}><ContentPage /></Allow>} />}
            />
            <Route
              path="/courses/:moduleId"
              element={<ByRole student={<ModulePage />} staff={<Allow when={canAuthor}><ModuleEditorPage /></Allow>} />}
            />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route
              path="/team"
              element={<ByRole student={<TeamPage />} staff={<Allow when={canMentor}><MentorTeamPage /></Allow>} />}
            />
            <Route
              path="/grading"
              element={<Allow when={canMentor}><GradingPage /></Allow>}
            />
            <Route element={<StudentOnly />}>
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/grades" element={<GradesPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

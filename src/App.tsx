import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import ProtectedRoute from './components/ProtectedRoute'
import { ByRole, StudentOnly } from './components/RoleRoutes'

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
// lecturer side
const LecturerDashboard = lazy(() => import('./pages/lecturer/LecturerDashboard'))
const ContentPage = lazy(() => import('./pages/lecturer/ContentPage'))
const ModuleEditorPage = lazy(() => import('./pages/lecturer/ModuleEditorPage'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<ByRole student={<DashboardPage />} staff={<LecturerDashboard />} />} />
            <Route path="/courses" element={<ByRole student={<CoursesPage />} staff={<ContentPage />} />} />
            <Route
              path="/courses/:moduleId"
              element={<ByRole student={<ModulePage />} staff={<ModuleEditorPage />} />}
            />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route element={<StudentOnly />}>
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/grades" element={<GradesPage />} />
              <Route path="/team" element={<TeamPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

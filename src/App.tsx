import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import ProtectedRoute from './components/ProtectedRoute'

// Route-level code splitting: each screen is downloaded only when visited.
const AuthPage = lazy(() => import('./pages/AuthPage'))
const AppLayout = lazy(() => import('./components/layout/AppLayout'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const ModulePage = lazy(() => import('./pages/ModulePage'))
const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            {/* Not built yet - replace one by one as modules arrive */}
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:moduleId" element={<ModulePage />} />
            <Route path="/tasks" element={<ComingSoonPage />} />
            <Route path="/calendar" element={<ComingSoonPage />} />
            <Route path="/grades" element={<ComingSoonPage />} />
            <Route path="/team" element={<ComingSoonPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

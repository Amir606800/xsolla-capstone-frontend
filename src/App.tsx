import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import AdminRoute from './components/AdminRoute'
import ProtectedRoute from './components/ProtectedRoute'
import { Allow, ByRole, StudentOnly } from './components/RoleRoutes'
import { ADMIN_SECTIONS } from './config/adminNav'
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
// everyone
const OfficeTourPage = lazy(() => import('./pages/OfficeTourPage'))
// admin section: separate sign-in and pages
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminHomePage = lazy(() => import('./pages/admin/AdminHomePage'))
const AdminSectionPage = lazy(() => import('./pages/admin/AdminSectionPage'))
const AdminCoursesLayout = lazy(() => import('./pages/admin/modules/AdminCoursesLayout'))
const AdminModulesPage = lazy(() => import('./pages/admin/modules/AdminModulesPage'))
const AdminModulePage = lazy(() => import('./pages/admin/modules/AdminModulePage'))
const AdminCalendarPage = lazy(() => import('./pages/admin/calendar/AdminCalendarPage'))
const AdminStudentsPage = lazy(() => import('./pages/admin/people/AdminStudentsPage'))
const AdminMentorsPage = lazy(() => import('./pages/admin/people/AdminMentorsPage'))
/** Admin sections with their own pages; the rest show a placeholder until they are built. */
const BUILT_ADMIN: string[] = ['modules', 'calendar', 'students', 'mentors']

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminHomePage />} />
            <Route path="/admin/modules" element={<AdminCoursesLayout />}>
              <Route index element={<AdminModulesPage />} />
              <Route path=":moduleId" element={<AdminModulePage />} />
            </Route>
            <Route path="/admin/calendar" element={<AdminCoursesLayout />}>
              <Route index element={<AdminCalendarPage />} />
            </Route>
            <Route path="/admin/students" element={<AdminStudentsPage />} />
            <Route path="/admin/mentors" element={<AdminMentorsPage />} />
            {/* sections that are not built yet */}
            {ADMIN_SECTIONS.filter((s) => !BUILT_ADMIN.includes(s.key)).map((s) => (
              <Route key={s.key} path={s.path} element={<AdminSectionPage section={s} />} />
            ))}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>

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
            <Route path="/office-tour" element={<OfficeTourPage />} />
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

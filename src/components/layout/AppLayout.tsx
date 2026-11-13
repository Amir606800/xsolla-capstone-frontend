import { Suspense, useCallback, useState } from 'react'
import { Outlet } from 'react-router'
import { CoursesProvider } from '../../context/CoursesProvider'
import { DashboardLayoutProvider } from '../../context/DashboardLayoutProvider'
import { MentorReviewProvider } from '../../context/MentorReviewProvider'
import { NotificationsProvider } from '../../context/NotificationsProvider'
import { StandingsProvider } from '../../context/StandingsProvider'
import { usePersistedState } from '../../hooks/usePersistedState'
import { ReviewGate } from '../review/ReviewGate'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import './AppLayout.css'
import { PageLoader } from '../loading/PageLoader'

type SidebarMode = 'expanded' | 'collapsed'
const SIDEBAR_MODES = ['expanded', 'collapsed'] as const

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const [sidebarMode, setSidebarMode] = usePersistedState<SidebarMode>('sidebar', 'expanded', SIDEBAR_MODES)
  // Stable callbacks so the memoised Header/Sidebar don't re-render needlessly
  const openNav = useCallback(() => setNavOpen(true), [])
  const closeNav = useCallback(() => setNavOpen(false), [])
  const toggleCollapsed = useCallback(
    () => setSidebarMode(sidebarMode === 'collapsed' ? 'expanded' : 'collapsed'),
    [sidebarMode, setSidebarMode],
  )

  return (
    <CoursesProvider>
      <NotificationsProvider>
      <DashboardLayoutProvider>
      <StandingsProvider>
      <MentorReviewProvider>
      <div className="shell">
        <Header onMenuClick={openNav} />
        <div className="shell__body">
          <Sidebar
            open={navOpen}
            onClose={closeNav}
            collapsed={sidebarMode === 'collapsed'}
            onToggleCollapsed={toggleCollapsed}
          />
          <main className="shell__main">
            <Suspense fallback={<PageLoader />}>
              {/* a student who owes last week's mentor review is sent to the form from every page */}
              <ReviewGate>
                <Outlet />
              </ReviewGate>
            </Suspense>
          </main>
        </div>
      </div>
      </MentorReviewProvider>
      </StandingsProvider>
      </DashboardLayoutProvider>
      </NotificationsProvider>
    </CoursesProvider>
  )
}

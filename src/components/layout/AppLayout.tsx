import { Suspense, useCallback, useState } from 'react'
import { Outlet } from 'react-router'
import { CoursesProvider } from '../../context/CoursesProvider'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import './AppLayout.css'

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  // Stable callbacks so the memoised Header/Sidebar don't re-render needlessly
  const openNav = useCallback(() => setNavOpen(true), [])
  const closeNav = useCallback(() => setNavOpen(false), [])

  return (
    <CoursesProvider>
      <div className="shell">
        <Header onMenuClick={openNav} />
        <div className="shell__body">
          <Sidebar open={navOpen} onClose={closeNav} />
          <main className="shell__main">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </CoursesProvider>
  )
}

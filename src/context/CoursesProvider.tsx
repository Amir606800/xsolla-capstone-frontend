import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchModules } from '../api/courses'
import type { CourseModule } from '../types/course'
import { CoursesContext } from './courses'
import type { LoadStatus } from './courses'

/**
 * Loads the course once for the signed-in shell, so the Dashboard, Courses,
 * Tasks and Grades pages share one fetch instead of each refetching.
 */
export function CoursesProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [modules, setModules] = useState<CourseModule[]>([])
  const [now, setNow] = useState(() => new Date())
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchModules()
      .then((data) => {
        if (cancelled) return
        setModules(data)
        setNow(new Date())
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  const value = useMemo(() => ({ status, modules, now, reload }), [status, modules, now, reload])

  return <CoursesContext.Provider value={value}>{children}</CoursesContext.Provider>
}

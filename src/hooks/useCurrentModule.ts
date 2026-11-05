import { useMemo } from 'react'
import type { CourseModule } from '../types/course'
import { isActiveModule } from '../utils/progress'
import { useCourses } from './useCourses'
import { useModuleAccess } from './useModuleAccess'

/** The module that is running right now (and open to this user), once the course has loaded. */
export function useCurrentModule(): { current: CourseModule | null; now: Date } {
  const { status, modules, now } = useCourses()
  const isLocked = useModuleAccess()
  const current = useMemo(
    () => (status === 'ready' ? (modules.find((m) => isActiveModule(m, now) && !isLocked(m)) ?? null) : null),
    [status, modules, now, isLocked],
  )
  return { current, now }
}

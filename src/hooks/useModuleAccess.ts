import { useCallback } from 'react'
import type { CourseModule } from '../types/course'
import { isModuleLocked } from '../utils/progress'
import { isStudent } from '../utils/roles'
import { useAuth } from './useAuth'
import { useCourses } from './useCourses'

/**
 * Returns `isLocked(module)`: true when a STUDENT tries to reach a module that
 * has not opened yet. Teachers and admins are never locked out.
 * (The backend must enforce this too, e.g. by not returning hidden items.)
 */
export function useModuleAccess() {
  const { user } = useAuth()
  const { now } = useCourses()
  const student = isStudent(user)

  return useCallback(
    (module: CourseModule) => student && isModuleLocked(module, now),
    [student, now],
  )
}

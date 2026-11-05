import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchModules, submitWork } from '../api/courses'
import type { SubmitPayload } from '../api/courses'
import { useAuth } from '../hooks/useAuth'
import type { CourseModule, Submission } from '../types/course'
import { isModuleLocked } from '../utils/progress'
import { CoursesContext } from './courses'
import type { LoadStatus } from './courses'

function withSubmission(modules: CourseModule[], assignmentId: string, result: Submission): CourseModule[] {
  return modules.map((m) =>
    m.items.some((i) => i.id === assignmentId)
      ? {
          ...m,
          items: m.items.map((i) =>
            i.id === assignmentId && i.type === 'assignment'
              // resubmitting updates the work but keeps an existing grade/feedback
              ? { ...i, submission: { ...i.submission, ...result } }
              : i,
          ),
        }
      : m,
  )
}

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

  const role = useAuth().user?.role

  const submitAssignment = useCallback(
    async (assignmentId: string, payload: SubmitPayload) => {
      // Defence in depth: the UI hides locked modules, but never accept work for one.
      const owner = modules.find((m) => m.items.some((i) => i.id === assignmentId))
      if (role === 'student' && owner && isModuleLocked(owner, new Date())) {
        throw new Error('This module is not open yet')
      }
      // Graded work is final. The backend must refuse it too.
      const target = owner?.items.find((i) => i.id === assignmentId)
      if (target?.type === 'assignment' && target.submission?.gradedAt !== undefined) {
        throw new Error('This task has already been graded')
      }
      const result = await submitWork(assignmentId, payload)
      setModules((prev) => withSubmission(prev, assignmentId, result))
      setNow(new Date())
    },
    [modules, role],
  )

  const value = useMemo(
    () => ({ status, modules, now, reload, submitAssignment }),
    [status, modules, now, reload, submitAssignment],
  )

  return <CoursesContext.Provider value={value}>{children}</CoursesContext.Provider>
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { assignLecturer as apiAssignLecturer, createModule as apiCreateModule, deleteItem as apiDeleteItem, deleteModule as apiDeleteModule, fetchModules, saveItem as apiSaveItem, saveModule as apiSaveModule, submitWork } from '../api/courses'
import type { ModulePatch, SubmitPayload } from '../api/courses'
import { useAuth } from '../hooks/useAuth'
import type { ContentItem, CourseModule, Submission, SubmissionVersion } from '../types/course'
import { datesNotKept } from '../utils/moduleDates'
import { DEADLINE_PASSED, isModuleLocked, isPastDue } from '../utils/progress'
import { canAuthor, isStudent } from '../utils/roles'
import { CoursesContext } from './courses'
import type { LoadStatus } from './courses'

function withSubmission(modules: CourseModule[], assignmentId: string, result: Submission): CourseModule[] {
  return modules.map((m) =>
    m.items.some((i) => i.id === assignmentId)
      ? {
          ...m,
          items: m.items.map((i) =>
            i.id === assignmentId && i.type === 'assignment'
              // resubmitting updates the work but keeps an existing grade/feedback; the version it
              // replaces goes to the top of the history (unless the server already sent the history)
              ? { ...i, submission: { ...i.submission, ...result, history: result.history ?? historyAfter(i.submission) } }
              : i,
          ),
        }
      : m,
  )
}

/** The earlier versions once a new one is handed in: the current one first, then the ones before it. */
function historyAfter(current: Submission | undefined): SubmissionVersion[] | undefined {
  if (!current) return undefined
  const { submittedAt, textBody, files } = current
  return [{ submittedAt, ...(textBody !== undefined ? { textBody } : {}), ...(files !== undefined ? { files } : {}) }, ...(current.history ?? [])]
}

/** Students never get quiz answers (the backend must strip them too). */
function forRole(modules: CourseModule[], student: boolean): CourseModule[] {
  if (!student) return modules
  return modules.map((m) =>
    m.items.some((i) => i.type === 'quiz')
      ? {
          ...m,
          items: m.items.map((i) =>
            i.type === 'quiz' && i.questions ? { ...i, questions: i.questions.map((q) => ({ ...q, correct: undefined })) } : i,
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
  const { user } = useAuth()
  const student = isStudent(user)
  const mayAuthor = canAuthor(user)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [modules, setModules] = useState<CourseModule[]>([])
  const [now, setNow] = useState(() => new Date())
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchModules({ student, userId: user?.id })
      .then((data) => {
        if (cancelled) return
        setModules(forRole(data, student))
        setNow(new Date())
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt, student, user?.id])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  const submitAssignment = useCallback(
    async (assignmentId: string, payload: SubmitPayload) => {
      // Defence in depth: the UI hides locked modules, but never accept work for one.
      const owner = modules.find((m) => m.items.some((i) => i.id === assignmentId))
      if (student && owner && isModuleLocked(owner, new Date())) {
        throw new Error('This module is not open yet')
      }
      // Graded work is final. The backend must refuse it too.
      const target = owner?.items.find((i) => i.id === assignmentId)
      if (target?.type === 'assignment' && target.submission?.gradedAt !== undefined) {
        throw new Error('This task has already been graded')
      }
      // Work is handed in until the deadline; after it the task is closed. The backend must refuse it too.
      if (student && target?.type === 'assignment' && isPastDue(target, new Date())) {
        throw new Error(DEADLINE_PASSED)
      }
      const result = await submitWork(assignmentId, payload, { studentId: user?.id, moduleId: owner?.id })
      setModules((prev) => withSubmission(prev, assignmentId, result))
      setNow(new Date())
    },
    [modules, student, user?.id],
  )

  // Lecturer authoring: the server has the final say (and checks the role); the screen shows what it returns.
  const author = useCallback(
    async (run: () => Promise<CourseModule[]>) => {
      if (!mayAuthor) throw new Error('Only lecturers can change the course')
      const next = await run()
      setModules(forRole(next, student))
      setNow(new Date())
    },
    [mayAuthor, student],
  )
  const saveModule = useCallback(
    async (id: string, patch: ModulePatch) => {
      let warning: string | undefined
      await author(async () => {
        const next = await apiSaveModule(id, patch)
        warning = datesNotKept(patch, next.find((m) => m.id === id))
        return next
      })
      return warning
    },
    [author],
  )
  const saveItem = useCallback((item: ContentItem) => author(() => apiSaveItem(item)), [author])
  const deleteItem = useCallback((id: string) => author(() => apiDeleteItem(id)), [author])
  const assignLecturer = useCallback((moduleId: string, lecturerId: number | null) => author(() => apiAssignLecturer(moduleId, lecturerId)), [author])
  const deleteModule = useCallback((id: string) => author(() => apiDeleteModule(id)), [author])
  const createModule = useCallback(
    async (patch: ModulePatch & { title: string }) => {
      let id = ''
      let warning: string | undefined
      await author(async () => {
        const res = await apiCreateModule(patch, { createdBy: user?.id })
        id = res.id
        warning = datesNotKept(patch, res.modules.find((m) => m.id === res.id))
        return res.modules
      })
      return { id, warning }
    },
    [author, user?.id],
  )

  const value = useMemo(
    () => ({ status, modules, now, reload, submitAssignment, saveModule, saveItem, deleteItem, deleteModule, createModule, assignLecturer }),
    [status, modules, now, reload, submitAssignment, saveModule, saveItem, deleteItem, deleteModule, createModule, assignLecturer],
  )

  return <CoursesContext.Provider value={value}>{children}</CoursesContext.Provider>
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  assignLecturer as apiAssignLecturer,
  createModule as apiCreateModule,
  deleteItem as apiDeleteItem,
  deleteModule as apiDeleteModule,
  fetchModules,
  generateAiQuiz as apiGenerateAiQuiz,
  saveItem as apiSaveItem,
  saveModule as apiSaveModule,
  submitQuizAttempt as apiSubmitQuizAttempt,
  submitWork,
} from '../api/courses'
import type { ModulePatch, SubmitPayload } from '../api/courses'
import { useAuth } from '../hooks/useAuth'
import type { ContentItem, CourseModule, Submission, SubmissionVersion } from '../types/course'
import { datesNotKept } from '../utils/moduleDates'
import { DEADLINE_PASSED, isModuleLocked, isPastDue } from '../utils/progress'
import { canAuthor, hasRole, isStudent } from '../utils/roles'
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
            i.type === 'quiz' && i.questions && !i.attempt
              ? { ...i, questions: i.questions.map((q) => ({ ...q, correct: undefined })) }
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

  const hasGeneratingQuiz = useMemo(
    () => modules.some((m) => m.items.some((i) => i.type === 'quiz' && i.status === 'generating')),
    [modules],
  )

  useEffect(() => {
    if (!hasGeneratingQuiz) return
    let active = true
    const timer = setInterval(() => {
      fetchModules({ student, userId: user?.id })
        .then((data) => {
          if (!active) return
          setModules(forRole(data, student))
          setNow(new Date())
        })
        .catch(() => {})
    }, 2500)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [hasGeneratingQuiz, student, user?.id])

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
      // Work is handed in until the deadline or the module's closing date; after it the task is only for reading. The backend must refuse it too.
      if (student && target?.type === 'assignment' && isPastDue(target, new Date(), owner?.closesAt)) {
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
  const assignLecturer = useCallback((moduleId: string, lecturerId: number, assigned = true) => author(() => apiAssignLecturer(moduleId, lecturerId, assigned)), [author])
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
  const generateAiQuiz = useCallback(
    async (input: { moduleId: string; contentItemId: string; title?: string; dueAt?: string }) => {
      if (!hasRole(user, 'lecturer')) throw new Error('Only lecturers can create AI quizzes')
      let quizId = ''
      await author(async () => {
        const res = await apiGenerateAiQuiz(input, { createdBy: user?.id })
        quizId = res.quizId
        return res.modules
      })
      return { quizId }
    },
    [author, user],
  )
  const submitQuizAttempt = useCallback(
    async (quizId: string, answers: number[]) => {
      const next = await apiSubmitQuizAttempt(quizId, answers, { studentId: user?.id })
      setModules(forRole(next, student))
      setNow(new Date())
    },
    [student, user?.id],
  )

  const value = useMemo(
    () => ({
      status,
      modules,
      now,
      reload,
      submitAssignment,
      saveModule,
      saveItem,
      deleteItem,
      deleteModule,
      createModule,
      assignLecturer,
      generateAiQuiz,
      submitQuizAttempt,
    }),
    [
      status,
      modules,
      now,
      reload,
      submitAssignment,
      saveModule,
      saveItem,
      deleteItem,
      deleteModule,
      createModule,
      assignLecturer,
      generateAiQuiz,
      submitQuizAttempt,
    ],
  )

  return <CoursesContext.Provider value={value}>{children}</CoursesContext.Provider>
}

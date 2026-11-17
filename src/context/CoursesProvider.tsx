import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { fetchSlots } from '../api/slots'
import { useAuth } from '../hooks/useAuth'
import { useLive } from '../hooks/useLive'
import type { ContentItem, CourseModule, Submission, SubmissionVersion } from '../types/course'
import type { User } from '../types/user'
import { withoutTaskDeadlines, withStudentDeadlines } from '../utils/deadline'
import { datesNotKept } from '../utils/moduleDates'
import { sameData } from '../utils/same'
import { isModuleLocked, orderByOpening } from '../utils/progress'
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

/**
 * The course as this person sees it. A student gets their own task deadlines (08:00 on the day of their booked 1:1, or
 * Monday 08:00) and never the quiz answers (the backend must strip them too); staff see tasks without a deadline, since
 * a task has none of its own.
 */
function forRole(modules: CourseModule[], student: boolean, booked: string[] = []): CourseModule[] {
  if (!student) return withoutTaskDeadlines(modules)
  return withStudentDeadlines(modules, booked).map((m) =>
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

/** The start times of the 1:1s this student booked (their deadlines follow them). None when they cannot be loaded. */
async function bookedOneOnOnes(user: User | null, student: boolean): Promise<string[]> {
  if (!student || !user) return []
  try {
    const slots = await fetchSlots({ id: user.id, name: user.name, roles: user.roles })
    return slots.filter((s) => s.bookedBy?.id === user.id).map((s) => s.startsAt)
  } catch {
    return []
  }
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
  // the course with the student's 1:1s, which their deadlines follow
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])
  const load = useCallback(
    () => Promise.all([fetchModules({ student, userId: user?.id }), bookedOneOnOnes(userRef.current, student)]).then(([data, booked]) => forRole(data, student, booked)),
    [student, user?.id],
  )

  useEffect(() => {
    let cancelled = false
    load()
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
  }, [attempt, load])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  // Quiet refresh: what a lecturer changes, a mentor grades or a student hands in reaches every open screen without a reload. An answer
  // that was still on its way when this person did something is older than what that action returned, so it is dropped; and a
  // reload that finds nothing new changes nothing on screen.
  const version = useRef(0)
  const shown = useRef(modules)
  useEffect(() => {
    shown.current = modules
  }, [modules])
  const refresh = useCallback(() => {
    const started = version.current
    load().then(
      (next) => {
        if (version.current !== started) return
        if (sameData(shown.current, next)) return
        setModules(next)
        setNow(new Date())
      },
      () => undefined,
    )
  }, [load])
  // a 1:1 booked, moved or cancelled moves the student's deadlines
  useLive(['courses', 'directory', 'slots'], refresh, { enabled: status === 'ready' })

  const hasGeneratingQuiz = useMemo(
    () => modules.some((m) => m.items.some((i) => i.type === 'quiz' && i.status === 'generating')),
    [modules],
  )

  useEffect(() => {
    if (!hasGeneratingQuiz) return
    let active = true
    const timer = setInterval(() => {
      load()
        .then((data) => {
          if (!active) return
          setModules(data)
          setNow(new Date())
        })
        .catch(() => {})
    }, 2500)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [hasGeneratingQuiz, load])

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
      // Handing in stays open after the deadline (and after the module closes): late work is accepted, marked as a late
      // submission, and the server turns the week grade red.
      const result = await submitWork(assignmentId, payload, { studentId: user?.id, moduleId: owner?.id })
      version.current += 1
      // the deadlines are kept, so whether this hand-in was late is worked out at once (unless the server said)
      setModules((prev) => withStudentDeadlines(withSubmission(prev, assignmentId, { ...result, late: result.late }), []))
      setNow(new Date())
    },
    [modules, student, user?.id],
  )

  // Lecturer authoring: the server has the final say (and checks the role); the screen shows what it returns.
  const author = useCallback(
    async (run: () => Promise<CourseModule[]>) => {
      if (!mayAuthor) throw new Error('Only lecturers can change the course')
      const next = await run()
      version.current += 1
      setModules(forRole(next, student, await bookedOneOnOnes(userRef.current, student)))
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
      if (!mayAuthor) throw new Error('Only lecturers can change the course')
      const { id, module } = await apiCreateModule(patch, { createdBy: user?.id })
      version.current += 1
      // The new module is shown at once (so the caller can open it without waiting for the whole course to load again),
      // in its place among the weeks; the quiet refresh then brings in anything else that changed.
      setModules((prev) => orderByOpening([...prev.filter((m) => m.id !== id), module]).map((m, i) => ({ ...m, position: i + 1 })))
      setNow(new Date())
      refresh()
      return { id, warning: datesNotKept(patch, module) }
    },
    [mayAuthor, user?.id, refresh],
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
      version.current += 1
      setModules(forRole(next, student, await bookedOneOnOnes(userRef.current, student)))
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

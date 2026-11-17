import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { restoreFakes } from './realApi'
import { restoreHttp } from './stubHttp'

/** Every function of a fake as a vi.fn (with the fake as its implementation), so a test can steer it with vi.mocked(...). */
const { spied } = vi.hoisted(() => ({
  spied: <T extends object>(fake: T): T =>
    Object.fromEntries(Object.entries(fake).map(([k, v]) => [k, typeof v === 'function' ? vi.fn(v as (...a: unknown[]) => unknown) : v])) as T,
}))

// pages load several mock APIs at once; on a busy machine 1 s (the default) is sometimes too short
configure({ asyncUtilTimeout: 4000 })

// jsdom does not implement matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

/*
 * The app only ever talks to the server. In the tests a made-up school (./fixtures, kept in localStorage and cleared after
 * each test) stands in for it: every API module that reaches the server is replaced by a fake (./fakes, or inline below)
 * with the same functions, answering at once. A test of a module's real HTTP calls uses vi.unmock (or importActual).
 */
vi.mock('../api/auth', async () => {
  const { DEMO_ACCOUNTS, DEMO_ADMIN } = await import('./fixtures/auth')
  return {
  login: vi.fn(async (email: string, password: string) => {
    if (!password) throw new Error('Invalid email or password')
    if (email.toLowerCase() === DEMO_ADMIN.email) return DEMO_ADMIN
    return DEMO_ACCOUNTS[email.toLowerCase()] ?? { id: 1, name: 'Tester', email, roles: ['student'] }
  }),
  signup: vi.fn(async (email: string, name: string) => ({ id: 1, name, email, roles: ['student'] })),
  logout: vi.fn(async () => undefined),
  // who the server says is signed in: nobody to ask offline
  fetchMe: vi.fn(async () => null),
  }
})

// lecturer edits live in localStorage, which is cleared after each test
vi.mock('../api/courses', async () => {
  const store = await import('./fixtures/contentEdits')
  return {
    fetchModules: vi.fn(async (opts?: { student?: boolean; userId?: number }) => {
      let modules = store.listModules(new Date())
      // like the server: a student's tasks carry their own deadline (08:00 on the day of their 1:1) and their hand-ins say if late
      if (opts?.student && opts.userId !== undefined) {
        const { withStudentDeadlines } = await import('./fixtures/studentDeadlines')
        const { listSlots } = await import('./fixtures/slots')
        const booked = listSlots({ id: opts.userId, name: '', roles: ['student'] }, new Date())
          .filter((s) => s.bookedBy?.id === opts.userId)
          .map((s) => s.startsAt)
        modules = withStudentDeadlines(modules, booked)
      }
      if (opts?.userId === undefined) return modules
      const attempts = store.quizAttemptsOf(opts.userId)
      return modules.map((m) => ({
        ...m,
        items: m.items.map((i) => (i.type === 'quiz' && attempts[i.id] ? { ...i, attempt: attempts[i.id] } : i)),
      }))
    }),
    submitWork: vi.fn(async (id: string, p: import('../api/courses').SubmitPayload, ctx?: { studentId?: number }) => {
      const sub = {
        submittedAt: new Date().toISOString(),
        textBody: p.textBody || undefined,
        files: [...(p.keep ?? []), ...p.files.map((f) => ({ name: f.name, sizeBytes: f.size }))],
      }
      // like the offline API: a late hand-in is accepted, marked, and turns the week grade red
      return ctx?.studentId === undefined ? sub : (await import('./fixtures/lateWork')).checkLateHandIn(ctx.studentId, id, sub)
    }),
    saveModule: vi.fn(async (id: string, patch: import('./fixtures/contentEdits').ModulePatch) => store.putModule(id, patch)),
    saveItem: vi.fn(async (item: import('../types/course').ContentItem) => store.putItem(item)),
    deleteItem: vi.fn(async (id: string) => store.removeItem(id)),
    deleteModule: vi.fn(async (id: string) => store.removeModule(id)),
    assignLecturer: vi.fn(async (id: string, lecturerId: number, assigned = true) => store.setLecturer(id, lecturerId, assigned)),
    createModule: vi.fn(async (patch: Parameters<typeof store.addModule>[0], ctx?: { createdBy?: number }) => {
      const { id, modules } = store.addModule(patch, ctx?.createdBy)
      return { id, module: modules.find((m) => m.id === id)! }
    }),
    generateAiQuiz: vi.fn(
      async (
        input: { moduleId: string; contentItemId: string; title?: string; dueAt?: string },
        ctx?: { createdBy?: number },
      ) => {
        const mod = store.listModules().find((m) => m.id === input.moduleId)
        const mat = mod?.items.find((i) => i.type === 'resource' && i.id === input.contentItemId)
        if (!mat) throw new Error('Lesson material not found')
        const quizId = `ai-quiz-${Date.now()}`
        const modules = store.putItem({
          id: quizId,
          moduleId: input.moduleId,
          type: 'quiz',
          title: input.title?.trim() || `AI Quiz: ${mat.title}`,
          description: 'Generating 10 multiple-choice questions from lesson material...',
          dueAt: input.dueAt,
          status: 'generating',
          isAiGenerated: true,
          sourceContentItemId: mat.id,
          createdBy: ctx?.createdBy,
          questions: [],
        })
        return { quizId, modules }
      },
    ),
    submitQuizAttempt: vi.fn(async (quizId: string, answers: number[], ctx?: { studentId?: number }) => {
      const userId = ctx?.studentId ?? 0
      store.saveQuizAttempt(userId, quizId, answers)
      const attempts = store.quizAttemptsOf(userId)
      return store.listModules(new Date()).map((m) => ({
        ...m,
        items: m.items.map((i) => (i.type === 'quiz' && attempts[i.id] ? { ...i, attempt: attempts[i.id] } : i)),
      }))
    }),
    createModuleQuiet: vi.fn(async (patch: Parameters<typeof store.addModule>[0], ctx?: { createdBy?: number }) => store.addModule(patch, ctx?.createdBy).id),
    writeItemQuiet: vi.fn(async (item: import('../types/course').ContentItem) => void store.putItem(item)),
  }
})

vi.mock('../api/events', async () => {
  const store = await import('./fixtures/contentEdits')
  return {
    fetchEvents: vi.fn(async () => store.listEvents(new Date())),
    saveEvent: vi.fn(async (e: import('../types/calendar').CalendarEvent, options: import('../types/google').SaveOptions = {}) => {
      const before = store.listEvents().find((x) => x.id === e.id)
      // the same rules as the offline API: only a new event can go to Google, and only when connected
      const asked = !!options.syncToGoogle && !before
      const synced = asked && (await import('./fixtures/google')).mockGoogleIsReady()
      const googleEventId = synced ? `mock-${e.id}` : before?.googleEventId
      const events = store.putEvent(googleEventId ? { ...e, googleEventId } : e)
      ;(await import('./fixtures/broadcasts')).noticeForSavedEvent(before, e)
      return { events, google: asked ? (synced ? 'synced' : 'failed') : 'not-asked' }
    }),
    deleteEvent: vi.fn(async (id: string) => store.removeEvent(id)),
  }
})

vi.mock('../api/standings', async () => {
  const m = await import('./fixtures/standings')
  type M = import('./fixtures/standings').Mentor
  return {
    fetchStandings: vi.fn(async (id = 1) => m.standingsOf(id)),
    fetchTeamStandings: vi.fn(async (g: M) => m.teamStandings(g)),
    saveWeekGrade: vi.fn(async (g: M, id: number, week: number, level: 'green' | 'yellow' | 'red', note: string) =>
      m.gradeWeek(g, id, week, level, note),
    ),
  }
})

vi.mock('../api/teams', async () => {
  const { buildMentorTeam, buildMockTeam } = await import('./fixtures/teams')
  type P = { id: number; name: string; email: string }
  return {
    fetchMyTeam: vi.fn(async (user: P) => buildMockTeam(user)),
    fetchMentorTeam: vi.fn(async (user: P) => buildMentorTeam(user)),
  }
})

// weekly mentor reviews: the demo store without the latency (nothing is due unless a test sets the demo flag)
vi.mock('../api/mentorReviews', async () => {
  const m = await import('./fixtures/mentorReviews')
  type R = import('../types/mentorReview').MentorReview
  return {
    fetchReviewedWeeks: vi.fn(async (studentId: number) => m.reviewedWeeks(studentId)),
    submitReview: vi.fn(async (studentId: number, mentorId: number | undefined, review: R) => m.addReview(studentId, mentorId, review)),
  }
})

// lecture feedback: the demo store without the latency (the form is the built-in copy of the server's)
vi.mock('../api/lectureFeedback', async () => {
  const m = await import('./fixtures/lectureFeedback')
  const { LECTURE_FORM } = await import('../utils/lectureFeedback')
  type Answers = import('../types/lectureFeedback').LectureAnswers
  return {
    fetchLectureForm: vi.fn(async () => LECTURE_FORM),
    fetchPendingLectures: vi.fn(async (studentId: number) => m.pendingLectures(studentId)),
    sendLectureFeedback: vi.fn(async (studentId: number, eventId: string, _form: unknown, answers: Answers) => m.addFeedback(studentId, eventId, answers)),
  }
})

// the slot store lives in localStorage, which is cleared after each test
type Actor = import('./fixtures/slots').Actor
type Win = import('../types/slots').AvailabilityWindow
vi.mock('../api/slots', async () => {
  const m = await import('./fixtures/slots')
  return {
    fetchSlots: vi.fn(async (a: Actor) => m.listSlots(a)),
    createAvailability: vi.fn(async (a: Actor, w: Win) => m.addWindow(a, w)),
    removeSlot: vi.fn(async (a: Actor, id: string) => m.deleteSlot(a, id)),
    bookSlot: vi.fn(async (a: Actor, id: string) => m.reserve(a, id)),
    cancelBooking: vi.fn(async (a: Actor, id: string) => m.release(a, id)),
  }
})

// every student's work lives in localStorage, which is cleared after each test
vi.mock('../api/reviews', async () => {
  const m = await import('./fixtures/submissions')
  type G = import('./fixtures/submissions').Grader
  return {
    fetchTeamSubmissions: vi.fn(async (g: G) => m.teamSubmissions(g)),
    commentOnSubmission: vi.fn(async (g: G, studentId: number, assignmentId: string, text: string) =>
      m.comment(g, studentId, assignmentId, text),
    ),
  }
})

vi.mock('../api/notifications', async () => {
  const { isStaff, normalizeUser } = await import('../utils/roles')
  const isStaffSignedIn = () => isStaff(normalizeUser(JSON.parse(localStorage.getItem('auth_user') ?? 'null')))
  const { buildMockNotifications } = await import('./fixtures/notifications')
  const store = await import('./fixtures/broadcasts')
  const { listUsers } = await import('./fixtures/directory')
  const { inAudience } = await import('../utils/adminNotifications')
  return {
    // the fixture notifications are a student's; staff have none of their own in the fixture school
    fetchNotifications: vi.fn(async () => (isStaffSignedIn() ? [] : buildMockNotifications(new Date()))),
    markNotificationRead: vi.fn(async () => undefined),
    markAllNotificationsRead: vi.fn(async () => undefined),
    // announcements from the admin: the real offline store, without the simulated delay
    fetchAnnouncements: vi.fn(async (user: Parameters<typeof store.announcementsFor>[0]) => store.announcementsFor(user)),
    markAnnouncementsAsRead: vi.fn(async (userId: number, ids: string[]) => store.markAnnouncementsRead(userId, ids)),
    isAnnouncementId: store.isAnnouncementId,
    fetchBroadcasts: vi.fn(async () => store.listBroadcasts()),
    sendBroadcast: vi.fn(async (input: { message: string; link: string; audience: import('../utils/adminNotifications').Audience }, sentBy: string) =>
      store.addBroadcast(input, listUsers().filter((u) => !u.leftAt && inAudience(u, input.audience)).length, sentBy),
    ),
  }
})

// people and teams, the person's own account, the admin's read-side pages, reports and quiz results
vi.mock('../api/directory', async (importOriginal) => ({ ...(await importOriginal<object>()), ...spied(await import('./fakes/directory')) }))
vi.mock('../api/password', async (importOriginal) => ({ ...(await importOriginal<object>()), ...spied({ changeOwnPassword: (await import('./fakes/account')).changeOwnPassword }) }))
vi.mock('../api/profile', async (importOriginal) => {
  const f = await import('./fakes/account')
  return {
    ...(await importOriginal<object>()),
    ...spied({
      fetchProfile: f.fetchProfile,
      saveProfile: f.saveProfile,
      uploadAvatar: f.uploadAvatar,
      removeAvatar: f.removeAvatar,
      fetchPreferences: f.fetchPreferences,
      savePreferences: f.savePreferences,
    }),
  }
})
vi.mock('../api/google', async () => {
  const f = await import('./fakes/account')
  return spied({
    fetchGoogleStatus: f.fetchGoogleStatus,
    disconnectGoogle: f.disconnectGoogle,
    revokeGoogle: f.revokeGoogle,
    connectGoogle: f.connectGoogle,
    fetchGoogleCalendar: f.fetchGoogleCalendar,
  })
})
vi.mock('../api/adminReviews', async (importOriginal) => {
  const f = await import('./fakes/admin')
  return { ...(await importOriginal<object>()), ...spied({ fetchAllReviews: f.fetchAllReviews, fetchMissingReviews: f.fetchMissingReviews }) }
})
vi.mock('../api/adminLectureReviews', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...spied({ fetchLectureReviews: (await import('./fakes/admin')).fetchLectureReviews }),
}))
vi.mock('../api/studentReviews', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api/studentReviews')>()
  const f = await import('./fakes/admin')
  // the fixture grades, named by the real module (from the faked people and teams)
  return { ...real, ...spied({ fetchStudentReviews: async () => real.withNames(f.fixtureGrades()) }) }
})
vi.mock('../api/analytics', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api/analytics')>()
  const f = await import('./fakes/admin')
  return {
    ...real,
    ...spied({
      fetchOverview: f.fetchOverview,
      fetchStudent: f.fetchStudent,
      fetchMentor: f.fetchMentor,
      fetchAiSummary: f.fetchAiSummary,
      fetchLectureExpected: f.fetchLectureExpected,
      // lecturers come from the (faked) people list, as in the real module
      fetchPeople: (role: import('../types/analytics').AnalyticsRole, q: string, limit: number, offset: number) =>
        role === 'lecturers' ? real.fetchPeople(role, q, limit, offset) : f.fetchStaffPeople(role, q, limit, offset),
    }),
  }
})
vi.mock('../api/reports', async (importOriginal) => {
  const f = await import('./fakes/admin')
  return {
    ...(await importOriginal<object>()),
    ...spied({
      sendReport: f.sendReport,
      fetchReports: f.fetchReports,
      fetchOpenReportCount: f.fetchOpenReportCount,
      updateReport: f.updateReport,
      deleteReport: f.deleteReport,
    }),
  }
})
vi.mock('../api/quizResults', async () => spied({ fetchTeamQuizResults: (await import('./fakes/admin')).fetchTeamQuizResults }))

afterEach(() => {
  cleanup()
  restoreHttp()
  restoreFakes()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

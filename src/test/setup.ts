import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { restoreHttp } from './stubHttp'

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

// Make the mock API instant so tests don't wait on simulated latency
vi.mock('../api/auth', async () => {
  const { DEMO_ACCOUNTS, DEMO_ADMIN } = await import('../api/auth.mock')
  return {
  login: vi.fn(async (email: string, password: string) => {
    if (!password) throw new Error('Invalid email or password')
    if (email.toLowerCase() === DEMO_ADMIN.email) return DEMO_ADMIN
    return DEMO_ACCOUNTS[email.toLowerCase()] ?? { id: 1, name: 'Tester', email, roles: ['student'] }
  }),
  signup: vi.fn(async (email: string, name: string) => ({ id: 1, name, email, roles: ['student'] })),
  logout: vi.fn(async () => undefined),
  }
})

// lecturer edits live in localStorage, which is cleared after each test
vi.mock('../api/courses', async () => {
  const store = await import('../mocks/contentEdits')
  return {
    fetchModules: vi.fn(async () => store.listModules(new Date())),
    submitWork: vi.fn(async (_id: string, p: import('../api/courses').SubmitPayload) => ({
      submittedAt: new Date().toISOString(),
      textBody: p.textBody || undefined,
      files: [...(p.keep ?? []), ...p.files.map((f) => ({ name: f.name, sizeBytes: f.size }))],
    })),
    saveModule: vi.fn(async (id: string, patch: import('../mocks/contentEdits').ModulePatch) => store.putModule(id, patch)),
    saveItem: vi.fn(async (item: import('../types/course').ContentItem) => store.putItem(item)),
    deleteItem: vi.fn(async (id: string) => store.removeItem(id)),
    deleteModule: vi.fn(async (id: string) => store.removeModule(id)),
    assignLecturer: vi.fn(async (id: string, lecturerId: number | null) => store.putModule(id, { createdBy: lecturerId })),
    createModule: vi.fn(async (patch: Parameters<typeof store.addModule>[0], ctx?: { createdBy?: number }) => store.addModule(patch, ctx?.createdBy)),
  }
})

vi.mock('../api/events', async () => {
  const store = await import('../mocks/contentEdits')
  return {
    fetchEvents: vi.fn(async () => store.listEvents(new Date())),
    saveEvent: vi.fn(async (e: import('../types/calendar').CalendarEvent) => store.putEvent(e)),
    deleteEvent: vi.fn(async (id: string) => store.removeEvent(id)),
  }
})

vi.mock('../api/standings', async () => {
  const m = await import('../mocks/standings')
  type M = import('../mocks/standings').Mentor
  return {
    fetchStandings: vi.fn(async (id = 1) => m.standingsOf(id)),
    fetchTeamStandings: vi.fn(async (g: M) => m.teamStandings(g)),
    saveWeekGrade: vi.fn(async (g: M, id: number, week: number, level: 'green' | 'yellow' | 'red', note: string) =>
      m.gradeWeek(g, id, week, level, note),
    ),
  }
})

vi.mock('../api/teams', async () => {
  const { buildMentorTeam, buildMockTeam } = await import('../mocks/teams')
  type P = { id: number; name: string; email: string }
  return {
    fetchMyTeam: vi.fn(async (user: P) => buildMockTeam(user)),
    fetchMentorTeam: vi.fn(async (user: P) => buildMentorTeam(user)),
  }
})

// the slot store lives in localStorage, which is cleared after each test
type Actor = import('../mocks/slots').Actor
type Win = import('../types/slots').AvailabilityWindow
vi.mock('../api/slots', async () => {
  const m = await import('../mocks/slots')
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
  const m = await import('../mocks/submissions')
  type G = import('../mocks/submissions').Grader
  return {
    fetchTeamSubmissions: vi.fn(async (g: G) => m.teamSubmissions(g)),
    commentOnSubmission: vi.fn(async (g: G, studentId: number, assignmentId: string, text: string) =>
      m.comment(g, studentId, assignmentId, text),
    ),
  }
})

vi.mock('../api/notifications', async () => {
  const { buildMockNotifications } = await import('../mocks/notifications')
  const store = await import('../mocks/broadcasts')
  const { listUsers } = await import('../mocks/directory')
  const { inAudience } = await import('../utils/adminNotifications')
  return {
    fetchNotifications: vi.fn(async () => buildMockNotifications(new Date())),
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

afterEach(() => {
  cleanup()
  restoreHttp()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

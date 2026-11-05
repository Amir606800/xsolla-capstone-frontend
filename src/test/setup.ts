import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

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
vi.mock('../api/auth', () => ({
  login: vi.fn(async (email: string, password: string) => {
    if (!password) throw new Error('Invalid email or password')
    return { id: 1, name: 'Tester', email, role: 'student' }
  }),
  signup: vi.fn(async (email: string, name: string) => ({ id: 1, name, email, role: 'student' })),
  logout: vi.fn(async () => undefined),
}))

vi.mock('../api/courses', async () => {
  const { buildMockModules } = await import('../mocks/courses')
  return {
    fetchModules: vi.fn(async () => buildMockModules(new Date())),
    submitWork: vi.fn(async (_id: string, p: { textBody: string; files: File[] }) => ({
      submittedAt: new Date().toISOString(),
      textBody: p.textBody || undefined,
      files: p.files.map((f) => ({ name: f.name, sizeBytes: f.size })),
    })),
  }
})

vi.mock('../api/events', async () => {
  const { buildMockEvents } = await import('../mocks/events')
  return { fetchEvents: vi.fn(async () => buildMockEvents(new Date())) }
})

vi.mock('../api/standings', async () => {
  const { buildMockStandings } = await import('../mocks/standings')
  return { fetchStandings: vi.fn(async () => buildMockStandings(new Date())) }
})

vi.mock('../api/teams', async () => {
  const { buildMockTeam } = await import('../mocks/teams')
  return { fetchMyTeam: vi.fn(async (user: { id: number; name: string; email: string }) => buildMockTeam(user)) }
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

vi.mock('../api/notifications', async () => {
  const { buildMockNotifications } = await import('../mocks/notifications')
  return {
    fetchNotifications: vi.fn(async () => buildMockNotifications(new Date())),
    markNotificationRead: vi.fn(async () => undefined),
    markAllNotificationsRead: vi.fn(async () => undefined),
  }
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

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

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

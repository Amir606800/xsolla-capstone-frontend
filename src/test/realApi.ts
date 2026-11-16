import { vi } from 'vitest'

/**
 * For one test: the faked functions of an API module (test/setup.ts) run the module's real code, so the test can answer
 * its HTTP requests itself (stubHttp). Undone after the test by `restoreFakes` (called from test/setup.ts).
 *
 *   import * as profileApi from '../api/profile'
 *   const real = await vi.importActual<typeof profileApi>('../api/profile')
 *   useRealApi(profileApi, real)
 */
const undo: (() => void)[] = []

export function useRealApi<M extends object>(faked: M, real: M): void {
  for (const [key, value] of Object.entries(faked)) {
    if (!vi.isMockFunction(value)) continue
    const before = value.getMockImplementation()
    value.mockImplementation((real as Record<string, (...a: unknown[]) => unknown>)[key])
    undo.push(() => value.mockImplementation(before ?? (() => undefined)))
  }
}

export function restoreFakes(): void {
  while (undo.length) undo.pop()!()
}

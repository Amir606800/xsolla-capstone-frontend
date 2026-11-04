import { buildMockModules } from '../mocks/courses'
import type { CourseModule } from '../types/course'

/**
 * MOCK implementation - no backend yet.
 * Real version: GET /courses/:id/content-items (tree) merged with
 * GET /content-items/:id/submissions/me for each assignment.
 */
const MOCK_LATENCY_MS = 300

export async function fetchModules(): Promise<CourseModule[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
  return buildMockModules()
}

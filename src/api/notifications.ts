import { buildMockNotifications } from '../mocks/notifications'
import type { AppNotification } from '../types/notification'

/**
 * MOCK implementation - no backend yet (the design doc has no notifications endpoints).
 * Expected real shape: GET /notifications (newest first), POST /notifications/:id/read,
 * POST /notifications/read-all. Reminders ("deadline in 24 hours") are created by a
 * scheduled backend job; the client only reads and marks them.
 */
const MOCK_LATENCY_MS = 300
const wait = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export async function fetchNotifications(): Promise<AppNotification[]> {
  await wait()
  return buildMockNotifications()
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!id) throw new Error('Missing notification id')
  await wait()
}

export async function markAllNotificationsRead(): Promise<void> {
  await wait()
}

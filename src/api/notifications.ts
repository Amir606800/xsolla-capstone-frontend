import { addBroadcast, announcementsFor, type Broadcast, isAnnouncementId, listBroadcasts, markAnnouncementsRead } from '../mocks/broadcasts'
import { listUsers } from '../mocks/directory'
import { buildMockNotifications } from '../mocks/notifications'
import type { AppNotification } from '../types/notification'
import type { User } from '../types/user'
import { type Audience, inAudience } from '../utils/adminNotifications'
import { authedRequest } from './authed'
import { hasBackend } from './http'

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

// ---------- announcements from the admin ----------

/**
 * Announcements the admin sent that are meant for this person. With a backend they come in the normal
 * GET /notifications list (type "announcement"), so nothing extra is fetched here.
 */
export async function fetchAnnouncements(user: Pick<User, 'id' | 'roles' | 'roleUntil'>): Promise<AppNotification[]> {
  if (hasBackend()) return []
  await wait()
  return announcementsFor(user)
}

/** Remembers which announcements this person has read (offline only; the server tracks `read_at` itself). */
export async function markAnnouncementsAsRead(userId: number, ids: string[]): Promise<void> {
  if (!hasBackend()) markAnnouncementsRead(userId, ids)
}

export { isAnnouncementId }

export interface NewBroadcast {
  message: string
  link: string
  audience: Audience
}

/** Backend row of GET /notifications/broadcasts (proposed, see BACKEND_REQUIREMENTS.md 4.5). */
interface BroadcastDto {
  id: number | string
  message: string
  link?: string | null
  audience: Audience
  sent_at: string
  sent_by?: string | null
  recipients: number
}

const toBroadcast = (d: BroadcastDto): Broadcast => ({
  id: String(d.id),
  message: d.message,
  link: d.link ?? '',
  audience: d.audience,
  sentAt: d.sent_at,
  sentBy: d.sent_by ?? '',
  recipients: d.recipients,
})

/** Everything the admin sent, newest first. */
export async function fetchBroadcasts(): Promise<Broadcast[]> {
  if (hasBackend()) {
    const rows = await authedRequest<BroadcastDto[] | null>('/notifications/broadcasts')
    return (rows ?? []).map(toBroadcast).sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  }
  await wait()
  return listBroadcasts()
}

/** Sends an announcement. The server (or, offline, the demo directory) works out who it reaches. */
export async function sendBroadcast(input: NewBroadcast, sentBy: string): Promise<Broadcast> {
  const body = { message: input.message.trim(), link: input.link, audience: input.audience }
  if (hasBackend()) return toBroadcast(await authedRequest<BroadcastDto>('/notifications/broadcast', { method: 'POST', body }))
  await wait()
  const recipients = listUsers().filter((u) => !u.leftAt && inAudience(u, input.audience)).length
  return addBroadcast(body, recipients, sentBy)
}

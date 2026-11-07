/** Mirrors the product doc: notifications(user_id, type, message, link, read_at, created_at). */
export type NotificationType =
  | 'task' // new task assigned
  | 'deadline' // deadline coming soon
  | 'graded' // graded / feedback added
  | 'material' // new material uploaded
  | 'meeting' // 1:1 scheduled, changed or starting soon
  | 'event' // calendar event added (off-campus day, ...)
  | 'submission' // lecturer: new submission received
  | 'announcement' // a message the admin sent to everyone (or to one group)

export interface AppNotification {
  id: string
  type: NotificationType
  message: string
  /** In-app route of the related task, lecture or event. */
  link: string
  createdAt: string // ISO
  /** null / undefined = unread */
  readAt?: string | null
}

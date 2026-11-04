import { createContext } from 'react'
import type { AppNotification } from '../types/notification'
import type { LoadStatus } from './courses'

export interface NotificationsContextValue {
  status: LoadStatus
  /** Newest first. */
  notifications: AppNotification[]
  unreadCount: number
  reload: () => void
  /** Optimistic: updates the UI at once and rolls back if the request fails. */
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null)

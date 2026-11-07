import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  fetchAnnouncements,
  fetchNotifications,
  isAnnouncementId,
  markAllNotificationsRead,
  markAnnouncementsAsRead,
  markNotificationRead,
} from '../api/notifications'
import { isStaff } from '../utils/roles'
import { useAuth } from '../hooks/useAuth'
import type { AppNotification } from '../types/notification'
import type { LoadStatus } from './courses'
import { NotificationsContext } from './notifications'

const byNewest = (a: AppNotification, b: AppNotification) => b.createdAt.localeCompare(a.createdAt)

/**
 * Notifications are needed by the header bell (unread count) and its modal, so
 * they are loaded once for the signed-in shell.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [attempt, setAttempt] = useState(0)

  // the demo notifications are a student's ("your task was graded"); staff get only the admin's announcements
  const { user } = useAuth()
  const staff = isStaff(user)
  const userId = user?.id
  const roles = user?.roles
  const roleUntil = user?.roleUntil

  useEffect(() => {
    let cancelled = false
    // announcements are optional: if they cannot be loaded the rest of the bell still works
    const announcements =
      userId === undefined || !roles ? Promise.resolve([]) : fetchAnnouncements({ id: userId, roles, roleUntil }).catch(() => [])
    Promise.all([staff ? Promise.resolve([]) : fetchNotifications(), announcements])
      .then(([own, announced]) => {
        if (cancelled) return
        setNotifications([...own, ...announced].sort(byNewest))
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt, staff, userId, roles, roleUntil])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  const markRead = useCallback(
    async (id: string) => {
      const target = notifications.find((n) => n.id === id)
      if (!target || target.readAt) return // unknown or already read: nothing to do
      const readAt = new Date().toISOString()
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt } : n)))
      try {
        if (isAnnouncementId(id)) {
          if (userId !== undefined) await markAnnouncementsAsRead(userId, [id])
        } else await markNotificationRead(id)
      } catch (err) {
        // roll back just this notification
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: null } : n)))
        throw err
      }
    },
    [notifications, userId],
  )

  const markAllRead = useCallback(async () => {
    const before = notifications
    if (!before.some((n) => !n.readAt)) return
    const readAt = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt })))
    try {
      if (userId !== undefined) await markAnnouncementsAsRead(userId, before.map((n) => n.id))
      if (!staff) await markAllNotificationsRead()
    } catch (err) {
      setNotifications(before)
      throw err
    }
  }, [notifications, userId, staff])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications])

  const value = useMemo(
    () => ({ status, notifications, unreadCount, reload, markRead, markAllRead }),
    [status, notifications, unreadCount, reload, markRead, markAllRead],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

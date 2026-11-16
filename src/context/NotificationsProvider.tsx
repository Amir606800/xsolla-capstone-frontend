import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  fetchAnnouncements,
  fetchNotifications,
  isAnnouncementId,
  markAllNotificationsRead,
  markAnnouncementsAsRead,
  markNotificationRead,
} from '../api/notifications'
import { sameData } from '../utils/same'
import { isStaff } from '../utils/roles'
import { useAuth } from '../hooks/useAuth'
import { useLive } from '../hooks/useLive'
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

  const load = useCallback(() => {
    // announcements are optional: if they cannot be loaded the rest of the bell still works
    const announcements =
      userId === undefined || !roles ? Promise.resolve([]) : fetchAnnouncements({ id: userId, roles, roleUntil }).catch(() => [])
    return Promise.all([staff ? Promise.resolve([]) : fetchNotifications(), announcements]).then(([own, announced]) =>
      [...own, ...announced].sort(byNewest),
    )
  }, [staff, userId, roles, roleUntil])

  useEffect(() => {
    let cancelled = false
    load()
      .then((list) => {
        if (cancelled) return
        setNotifications(list)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt, load])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  // Quiet refresh: a grade, a new task, a lecture link or an announcement rings the bell without a reload. The server creates most
  // notifications itself as a result of what other people save, so any change in the app is a reason to look again.
  const version = useRef(0)
  const shown = useRef(notifications)
  useEffect(() => {
    shown.current = notifications
  }, [notifications])
  const refresh = useCallback(() => {
    const started = version.current
    load().then(
      (fresh) => {
        if (version.current !== started) return
        // what this person already read stays read, even where the source does not remember it (the offline demo)
        const read = new Map(shown.current.filter((n) => n.readAt).map((n) => [n.id, n.readAt]))
        const list = fresh.map((n) => (!n.readAt && read.has(n.id) ? { ...n, readAt: read.get(n.id)! } : n))
        if (!sameData(shown.current, list)) setNotifications(list)
      },
      () => undefined,
    )
  }, [load])
  useLive(['notifications', 'courses', 'events', 'standings', 'slots', 'directory'], refresh, { enabled: status === 'ready' })

  const markRead = useCallback(
    async (id: string) => {
      const target = notifications.find((n) => n.id === id)
      if (!target || target.readAt) return // unknown or already read: nothing to do
      const readAt = new Date().toISOString()
      version.current += 1
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
    version.current += 1
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt })))
    try {
      // the server first: when it refuses, nothing was marked, here or there
      if (!staff) await markAllNotificationsRead()
      if (userId !== undefined) await markAnnouncementsAsRead(userId, before.map((n) => n.id))
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

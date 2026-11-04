import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications'
import { useNotifications } from '../hooks/useNotifications'
import { buildMockNotifications } from '../mocks/notifications'
import { NotificationsProvider } from './NotificationsProvider'

const wrapper = ({ children }: { children: ReactNode }) => <NotificationsProvider>{children}</NotificationsProvider>

async function loaded() {
  const hook = renderHook(() => useNotifications(), { wrapper })
  await waitFor(() => expect(hook.result.current.status).toBe('ready'))
  return hook
}

describe('NotificationsProvider', () => {
  it('starts loading, then exposes the notifications newest first', async () => {
    const hook = renderHook(() => useNotifications(), { wrapper })
    expect(hook.result.current.status).toBe('loading')
    await waitFor(() => expect(hook.result.current.status).toBe('ready'))

    const dates = hook.result.current.notifications.map((n) => n.createdAt)
    expect(dates).toEqual([...dates].sort().reverse())
    expect(hook.result.current.notifications).toHaveLength(8)
  })

  it('sorts even when the API returns them in another order', async () => {
    vi.mocked(fetchNotifications).mockResolvedValueOnce([...buildMockNotifications()].reverse())
    const { result } = await loaded()
    expect(result.current.notifications[0].id).toBe('n1')
  })

  it('counts unread notifications', async () => {
    const { result } = await loaded()
    expect(result.current.unreadCount).toBe(4)
  })

  it('markRead updates the UI immediately and tells the API once', async () => {
    vi.mocked(markNotificationRead).mockClear()
    const { result } = await loaded()

    await act(() => result.current.markRead('n1'))
    expect(result.current.unreadCount).toBe(3)
    expect(result.current.notifications.find((n) => n.id === 'n1')?.readAt).toBeTruthy()
    expect(markNotificationRead).toHaveBeenCalledWith('n1')
  })

  it('markRead ignores already-read and unknown notifications (no request)', async () => {
    vi.mocked(markNotificationRead).mockClear()
    const { result } = await loaded()
    await act(() => result.current.markRead('n5')) // already read
    await act(() => result.current.markRead('nope'))
    expect(markNotificationRead).not.toHaveBeenCalled()
    expect(result.current.unreadCount).toBe(4)
  })

  it('markRead rolls back (only that item) when the request fails', async () => {
    vi.mocked(markNotificationRead).mockRejectedValueOnce(new Error('offline'))
    const { result } = await loaded()

    await act(async () => {
      await expect(result.current.markRead('n2')).rejects.toThrow('offline')
    })
    expect(result.current.notifications.find((n) => n.id === 'n2')?.readAt).toBeFalsy()
    expect(result.current.unreadCount).toBe(4)
  })

  it('markAllRead clears every unread notification with one request', async () => {
    vi.mocked(markAllNotificationsRead).mockClear()
    const { result } = await loaded()
    await act(() => result.current.markAllRead())
    expect(result.current.unreadCount).toBe(0)
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1)
  })

  it('markAllRead does nothing when everything is already read', async () => {
    vi.mocked(markAllNotificationsRead).mockClear()
    const { result } = await loaded()
    await act(() => result.current.markAllRead())
    await act(() => result.current.markAllRead())
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1)
  })

  it('markAllRead restores the previous state when the request fails', async () => {
    vi.mocked(markAllNotificationsRead).mockRejectedValueOnce(new Error('offline'))
    const { result } = await loaded()
    await act(async () => {
      await expect(result.current.markAllRead()).rejects.toThrow('offline')
    })
    expect(result.current.unreadCount).toBe(4)
  })

  it('reports an error and recovers with reload', async () => {
    vi.mocked(fetchNotifications).mockRejectedValueOnce(new Error('network'))
    const hook = renderHook(() => useNotifications(), { wrapper })
    await waitFor(() => expect(hook.result.current.status).toBe('error'))

    act(() => hook.result.current.reload())
    expect(hook.result.current.status).toBe('loading')
    await waitFor(() => expect(hook.result.current.status).toBe('ready'))
    expect(hook.result.current.notifications).toHaveLength(8)
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useNotifications())).toThrow('NotificationsProvider')
  })
})

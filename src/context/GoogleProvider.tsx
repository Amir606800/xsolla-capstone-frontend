import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { connectGoogle, disconnectGoogle, fetchGoogleStatus, revokeGoogle } from '../api/google'
import { useAuth } from '../hooks/useAuth'
import type { GoogleStatus } from '../types/google'
import { GoogleContext } from './google'

/**
 * The signed-in person's Google Calendar connection, shared by Settings, the event form and the calendar.
 * The server is asked lazily (the status costs two calls to Google) and only once per sign-in. What was
 * learned belongs to one person: for anyone else (after a sign-out) it simply does not count.
 */
export function GoogleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [known, setKnown] = useState<{ userId: number; status: GoogleStatus } | null>(null)
  const [pending, setPending] = useState(0)
  const [connecting, setConnecting] = useState(false)
  // who is signed in now, for answers that arrive later
  const current = useRef<number | null>(userId)
  useEffect(() => {
    current.current = userId
  }, [userId])
  // the person the server was last asked about (so a re-render, or StrictMode's second effect, does not ask again)
  const askedFor = useRef<number | null>(null)

  const status = known && known.userId === userId ? known.status : null

  const ask = useCallback(async (forUser: number) => {
    setPending((n) => n + 1)
    let next: GoogleStatus
    try {
      next = await fetchGoogleStatus()
    } catch {
      next = { connection: 'unavailable' }
    }
    setPending((n) => n - 1)
    if (current.current === forUser) setKnown({ userId: forUser, status: next })
  }, [])

  const load = useCallback(() => {
    if (userId === null || askedFor.current === userId) return
    askedFor.current = userId
    void ask(userId)
  }, [userId, ask])

  const reload = useCallback(async () => {
    if (userId === null) return
    askedFor.current = userId
    await ask(userId)
  }, [userId, ask])

  const markReconnect = useCallback(() => {
    if (userId === null) return
    setKnown((k) => (k && k.userId === userId && k.status.connection === 'connected' ? { userId, status: { ...k.status, connection: 'reconnect' } } : k))
  }, [userId])

  const disconnect = useCallback(async () => {
    if (!user) return
    const next = await disconnectGoogle()
    if (current.current === user.id) setKnown({ userId: user.id, status: next })
  }, [user])

  const revoke = useCallback(async () => {
    if (!user) return
    const next = await revokeGoogle()
    if (current.current === user.id) setKnown({ userId: user.id, status: next })
  }, [user])

  const connect = useCallback(async () => {
    if (!user) return
    setConnecting(true)
    try {
      const result = await connectGoogle({ name: user.name, email: user.email })
      // 'redirecting': the page is leaving, so keep showing the busy state until it has
      if (result !== 'redirecting') {
        if (current.current === user.id) setKnown({ userId: user.id, status: result })
        setConnecting(false)
      }
    } catch {
      setConnecting(false)
      throw new Error('Could not start the connection. Try again in a moment.')
    }
  }, [user])

  const value = useMemo(
    () => ({ status, loading: pending > 0, connecting, load, reload, markReconnect, disconnect, revoke, connect }),
    [status, pending, connecting, load, reload, markReconnect, disconnect, revoke, connect],
  )
  return <GoogleContext.Provider value={value}>{children}</GoogleContext.Provider>
}

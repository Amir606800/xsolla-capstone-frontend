import { createContext } from 'react'
import type { GoogleStatus } from '../types/google'

export interface GoogleContextValue {
  /** null until the server has been asked (the first screen that needs it asks). */
  status: GoogleStatus | null
  loading: boolean
  /** A "Connect" is under way (the browser may be on its way to Google). */
  connecting: boolean
  /** Asks the server once per sign-in; later calls do nothing. */
  load: () => void
  /** Asks again, e.g. after coming back from Google or after a sync failed. */
  reload: () => Promise<void>
  /** The server said the Google token is no longer good (e.g. while reading the calendar): show "reconnect". */
  markReconnect: () => void
  /** Starts the connection: the browser leaves for Google, or (offline) it is connected at once. */
  connect: () => Promise<void>
}

export const GoogleContext = createContext<GoogleContextValue | null>(null)

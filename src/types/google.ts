/** The Google account a user connected to the LMS (GET /auth/google/me). */
export interface GoogleAccount {
  email: string
  name: string
  picture?: string
}

/**
 * Where the connection stands:
 *  - connected     the server holds a working refresh token
 *  - disconnected  the user never connected (404 google_not_connected)
 *  - reconnect     the token was revoked or expired (401 google_token_expired): connect again
 *  - unavailable   Google or the server could not be reached; try again later
 *  - unsupported   this server has no Google routes yet
 */
export type GoogleConnection = 'connected' | 'disconnected' | 'reconnect' | 'unavailable' | 'unsupported'

export interface GoogleStatus {
  connection: GoogleConnection
  account?: GoogleAccount
}

/**
 * What happened to the Google copy of a saved event:
 *  - synced     it is on the creator's Google Calendar
 *  - failed     it was asked for, but the server did not put it there (the event itself is saved)
 *  - not-asked  the person did not ask for it
 */
export type GoogleOutcome = 'synced' | 'failed' | 'not-asked'

/** What saving an event returns: the whole updated list, and what happened to its Google copy. */
export interface SaveResult {
  events: import('./calendar').CalendarEvent[]
  google: GoogleOutcome
}

export interface SaveOptions {
  /** New events only: also create it on the creator's Google Calendar. The server cannot add one later. */
  syncToGoogle?: boolean
}

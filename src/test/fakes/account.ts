import { ApiError } from '../../api/http'
import { mapGoogleEvent } from '../../api/mappers'
import type { GoogleEventsResult } from '../../api/google.http'
import type { GoogleStatus } from '../../types/google'
import type { Preferences, PreferencesPatch, Profile, ProfilePatch } from '../../types/profile'
import { listUsers, passwordMatches, setPassword } from '../fixtures/directory'
import { mockGoogleCalendar, mockGoogleConnect, mockGoogleDisconnect, mockGoogleStatus } from '../fixtures/google'
import { mockPreferences, mockProfile, mockSavePreferences, mockSaveProfile, mockSetAvatar } from '../fixtures/profile'

/**
 * Test fakes of the person's own account APIs (password, profile, Google), backed by the fixture stores in localStorage.
 * The tests use these instead of a server (src/test/setup.ts); the app never does.
 */
// (the same words as api/password; that module is the one these stand in for, so it is not imported here)
const WRONG_CURRENT = 'Your current password is not right.'

// ---------- api/password ----------
export async function changeOwnPassword(userId: number, current: string, next: string): Promise<void> {
  // the demo admin is not in the directory: nothing to check or keep
  if (!listUsers().some((u) => u.id === userId)) return
  if (!passwordMatches(userId, current)) throw new ApiError(400, 'wrong_password', WRONG_CURRENT)
  setPassword(userId, next)
}

// ---------- api/profile ----------
export const fetchProfile = async (userId: number): Promise<Profile> => mockProfile(userId)
export const saveProfile = async (userId: number, patch: ProfilePatch): Promise<Profile> => mockSaveProfile(userId, patch)
export async function uploadAvatar(userId: number, picture: Blob): Promise<string | null> {
  return mockSetAvatar(userId, await toDataUrl(picture)).avatarUrl
}
export async function removeAvatar(userId: number): Promise<void> {
  mockSetAvatar(userId, null)
}
export const fetchPreferences = async (userId: number): Promise<Preferences> => mockPreferences(userId)
export const savePreferences = async (userId: number, patch: PreferencesPatch): Promise<Preferences> =>
  mockSavePreferences(userId, patch)

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the picture.'))
    reader.readAsDataURL(blob)
  })
}

// ---------- api/google ----------
export const fetchGoogleStatus = async (): Promise<GoogleStatus> => mockGoogleStatus()
export const disconnectGoogle = async (): Promise<GoogleStatus> => mockGoogleDisconnect()
export const revokeGoogle = async (): Promise<GoogleStatus> => mockGoogleDisconnect()
export const connectGoogle = async (user: { name: string; email: string }): Promise<'redirecting' | GoogleStatus> =>
  mockGoogleConnect(user)
export async function fetchGoogleCalendar(now: Date = new Date()): Promise<GoogleEventsResult> {
  const rows = mockGoogleCalendar(now)
  if (rows === 'reconnect') return { state: 'reconnect' }
  if (rows === 'disconnected') return { state: 'ok', events: [] }
  return { state: 'ok', events: rows.map(mapGoogleEvent) }
}

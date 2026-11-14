import { mockPreferences, mockProfile, mockSavePreferences, mockSaveProfile, mockSetAvatar } from '../mocks/profile'
import type { Preferences, PreferencesPatch, Profile, ProfilePatch } from '../types/profile'
import { ApiError, hasBackend } from './http'
import * as http from './profile.http'

/**
 * The signed-in person's profile (About me) and look settings. With a server these are its routes
 * (see profile.http.ts); without one they live in this browser. A server that does not have the routes yet
 * answers 404, 405 or 501: that becomes one "not supported" error the screen can explain.
 */
export const NOT_SUPPORTED = 'The server cannot save this yet.'

export const isNotSupported = (e: unknown) => e instanceof ApiError && e.code === 'not_supported'

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501)) {
      throw new ApiError(501, 'not_supported', NOT_SUPPORTED)
    }
    throw e
  }
}

export const fetchProfile = (userId: number): Promise<Profile> => (hasBackend() ? call(http.getProfile) : Promise.resolve(mockProfile(userId)))

export const saveProfile = (userId: number, patch: ProfilePatch): Promise<Profile> =>
  hasBackend() ? call(() => http.patchProfile(patch)) : Promise.resolve(mockSaveProfile(userId, patch))

/** The picture was already cropped and shrunk by the screen. Answers the new picture address. */
export async function uploadAvatar(userId: number, picture: Blob): Promise<string | null> {
  if (hasBackend()) return call(() => http.putAvatar(picture))
  return mockSetAvatar(userId, await toDataUrl(picture)).avatarUrl
}

export async function removeAvatar(userId: number): Promise<void> {
  if (hasBackend()) return call(http.deleteAvatar)
  mockSetAvatar(userId, null)
}

export const fetchPreferences = (userId: number): Promise<Preferences> =>
  hasBackend() ? call(http.getPreferences) : Promise.resolve(mockPreferences(userId))

export const savePreferences = (userId: number, patch: PreferencesPatch): Promise<Preferences> =>
  hasBackend() ? call(() => http.patchPreferences(patch)) : Promise.resolve(mockSavePreferences(userId, patch))

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the picture.'))
    reader.readAsDataURL(blob)
  })
}

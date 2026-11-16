import type { Preferences, PreferencesPatch, Profile, ProfilePatch } from '../types/profile'
import { ApiError } from './http'
import * as http from './profile.http'

/**
 * The signed-in person's profile (About me) and look settings: the server's routes (see profile.http.ts).
 * The user argument says whose (the server knows it from the session). A server that does not have the routes yet
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

export const fetchProfile = (userId: number): Promise<Profile> => (void userId, call(http.getProfile))

export const saveProfile = (userId: number, patch: ProfilePatch): Promise<Profile> => (void userId, call(() => http.patchProfile(patch)))

/** The picture was already cropped and shrunk by the screen. Answers the new picture address. */
export const uploadAvatar = (userId: number, picture: Blob): Promise<string | null> => (void userId, call(() => http.putAvatar(picture)))

export const removeAvatar = (userId: number): Promise<void> => (void userId, call(http.deleteAvatar))

export const fetchPreferences = (userId: number): Promise<Preferences> => (void userId, call(http.getPreferences))

export const savePreferences = (userId: number, patch: PreferencesPatch): Promise<Preferences> =>
  (void userId, call(() => http.patchPreferences(patch)))

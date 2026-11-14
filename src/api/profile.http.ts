import { DEFAULT_PREFERENCES, EMPTY_PROFILE, readPreferences } from '../types/profile'
import type { Preferences, PreferencesPatch, Profile, ProfilePatch, Visibility } from '../types/profile'
import { authedRequest } from './authed'

/**
 * The real server's profile routes (backend_requirements/BACKEND_REQ_PROFILE.md). The server speaks snake_case,
 * the app camelCase; this file is the only place that knows both.
 */
interface WireProfile {
  avatar_url?: string | null
  bio?: string
  slack_handle?: string
  gitlab_handle?: string
  visibility?: string
}

const toProfile = (w: WireProfile | null | undefined): Profile => ({
  avatarUrl: w?.avatar_url || null,
  bio: w?.bio ?? EMPTY_PROFILE.bio,
  slackHandle: w?.slack_handle ?? EMPTY_PROFILE.slackHandle,
  gitlabHandle: w?.gitlab_handle ?? EMPTY_PROFILE.gitlabHandle,
  visibility: (w?.visibility === 'staff_only' ? 'staff_only' : 'everyone') satisfies Visibility,
})

/** GET /users/me/profile */
export async function getProfile(): Promise<Profile> {
  return toProfile(await authedRequest<WireProfile>('/users/me/profile'))
}

/** PATCH /users/me/profile: only the sent fields change; the answer is the whole profile. */
export async function patchProfile(patch: ProfilePatch): Promise<Profile> {
  const body: WireProfile = {}
  if (patch.bio !== undefined) body.bio = patch.bio
  if (patch.slackHandle !== undefined) body.slack_handle = patch.slackHandle
  if (patch.gitlabHandle !== undefined) body.gitlab_handle = patch.gitlabHandle
  if (patch.visibility !== undefined) body.visibility = patch.visibility
  return toProfile(await authedRequest<WireProfile>('/users/me/profile', { method: 'PATCH', body }))
}

/** PUT /users/me/avatar: multipart, one `file` field. Answers the new address. */
export async function putAvatar(file: Blob): Promise<string | null> {
  const form = new FormData()
  form.append('file', file, file.type === 'image/png' ? 'avatar.png' : file.type === 'image/jpeg' ? 'avatar.jpg' : 'avatar.webp')
  const res = await authedRequest<{ avatar_url?: string | null }>('/users/me/avatar', { method: 'PUT', body: form })
  return res?.avatar_url || null
}

/** DELETE /users/me/avatar: 204, also when there is none. */
export async function deleteAvatar(): Promise<void> {
  await authedRequest<void>('/users/me/avatar', { method: 'DELETE' })
}

const WIRE_KEYS: Record<keyof Preferences, string> = {
  textSize: 'text_size',
  theme: 'theme',
  font: 'font',
  spacing: 'spacing',
  density: 'density',
  highContrast: 'high_contrast',
  colorblindSafe: 'colorblind_safe',
  reduceMotion: 'reduce_motion',
  strongFocus: 'strong_focus',
}

const fromWire = (raw: unknown): Preferences => {
  const source = (raw ?? {}) as Record<string, unknown>
  const camel: Record<string, unknown> = {}
  for (const [key, wire] of Object.entries(WIRE_KEYS)) camel[key] = source[wire]
  // unknown keys and values the app does not know are dropped; the rest falls back to the defaults
  return readPreferences(camel, DEFAULT_PREFERENCES)
}

/** GET /users/me/preferences: a person who never saved anything gets every default. */
export async function getPreferences(): Promise<Preferences> {
  return fromWire(await authedRequest<unknown>('/users/me/preferences'))
}

/** PATCH /users/me/preferences: only the sent keys change; the answer is the whole object. */
export async function patchPreferences(patch: PreferencesPatch): Promise<Preferences> {
  const body: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) body[WIRE_KEYS[key as keyof Preferences]] = value
  return fromWire(await authedRequest<unknown>('/users/me/preferences', { method: 'PATCH', body }))
}

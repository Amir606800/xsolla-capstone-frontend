import { DEFAULT_PREFERENCES, EMPTY_PROFILE, readPreferences } from '../types/profile'
import type { Preferences, PreferencesPatch, Profile, ProfilePatch } from '../types/profile'

/**
 * Offline demo of the profile routes: one profile and one set of look settings per person, kept in this browser.
 * (The picture is stored as a small data address; the real server answers with a file address.)
 */
const profileKey = (userId: number) => `profile:${userId}`
const prefsKey = (userId: number) => `preferences:${userId}`

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable or full: the change lasts until the page is closed
  }
}

export function mockProfile(userId: number): Profile {
  const stored = (read(profileKey(userId)) ?? {}) as Partial<Profile>
  return {
    avatarUrl: typeof stored.avatarUrl === 'string' ? stored.avatarUrl : null,
    bio: typeof stored.bio === 'string' ? stored.bio : EMPTY_PROFILE.bio,
    slackHandle: typeof stored.slackHandle === 'string' ? stored.slackHandle : EMPTY_PROFILE.slackHandle,
    gitlabHandle: typeof stored.gitlabHandle === 'string' ? stored.gitlabHandle : EMPTY_PROFILE.gitlabHandle,
    visibility: stored.visibility === 'staff_only' ? 'staff_only' : 'everyone',
  }
}

export function mockSaveProfile(userId: number, patch: ProfilePatch): Profile {
  const next = { ...mockProfile(userId), ...patch }
  write(profileKey(userId), next)
  return next
}

export function mockSetAvatar(userId: number, url: string | null): Profile {
  const next = { ...mockProfile(userId), avatarUrl: url }
  write(profileKey(userId), next)
  return next
}

export function mockPreferences(userId: number): Preferences {
  return readPreferences(read(prefsKey(userId)), DEFAULT_PREFERENCES)
}

export function mockSavePreferences(userId: number, patch: PreferencesPatch): Preferences {
  const next = readPreferences({ ...mockPreferences(userId), ...patch })
  write(prefsKey(userId), next)
  return next
}

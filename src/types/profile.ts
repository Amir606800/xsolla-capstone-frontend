/** About me: what a person shows to others (backend_requirements/BACKEND_REQ_PROFILE.md). */
export type Visibility = 'everyone' | 'staff_only'

export interface Profile {
  /** A picture the browser can open in an <img>; null = none, the app shows initials. */
  avatarUrl: string | null
  bio: string
  slackHandle: string
  gitlabHandle: string
  visibility: Visibility
}

/** The fields the person edits as text. The picture has its own routes. */
export type ProfilePatch = Partial<Pick<Profile, 'bio' | 'slackHandle' | 'gitlabHandle' | 'visibility'>>

export const BIO_MAX = 300
export const HANDLE_MAX = 40

export const EMPTY_PROFILE: Profile = { avatarUrl: null, bio: '', slackHandle: '', gitlabHandle: '', visibility: 'everyone' }

/** Look and accessibility: only the person sees these, and they follow them to any device. */
export interface Preferences {
  textSize: 'normal' | 'large' | 'xlarge'
  theme: 'light' | 'dark' | 'system'
  font: 'default' | 'dyslexia'
  spacing: 'normal' | 'relaxed'
  density: 'comfortable' | 'compact'
  highContrast: boolean
  colorblindSafe: boolean
  reduceMotion: boolean
  strongFocus: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  textSize: 'normal',
  theme: 'system',
  font: 'default',
  spacing: 'normal',
  density: 'comfortable',
  highContrast: false,
  colorblindSafe: false,
  reduceMotion: false,
  strongFocus: false,
}

export type PreferencesPatch = Partial<Preferences>

/** What every preference may be, for reading back anything stored or sent by a server (unknown values are dropped). */
export const PREFERENCE_VALUES: { [K in keyof Preferences]: readonly Preferences[K][] } = {
  textSize: ['normal', 'large', 'xlarge'],
  theme: ['light', 'dark', 'system'],
  font: ['default', 'dyslexia'],
  spacing: ['normal', 'relaxed'],
  density: ['comfortable', 'compact'],
  highContrast: [true, false],
  colorblindSafe: [true, false],
  reduceMotion: [true, false],
  strongFocus: [true, false],
}

/** Keeps only the known keys with allowed values; everything else falls back to `base`. */
export function readPreferences(raw: unknown, base: Preferences = DEFAULT_PREFERENCES): Preferences {
  const out: Record<string, unknown> = { ...base }
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(PREFERENCE_VALUES) as (keyof Preferences)[]) {
      const value = (raw as Record<string, unknown>)[key]
      if ((PREFERENCE_VALUES[key] as readonly unknown[]).includes(value)) out[key] = value
    }
  }
  return out as unknown as Preferences
}

import { createContext } from 'react'
import type { Preferences, PreferencesPatch, Profile, ProfilePatch } from '../types/profile'

export interface ProfileContextValue {
  /** About me. Empty until it is loaded (and for anyone not signed in). */
  profile: Profile
  /** 'unsupported': the server has no profile routes yet. */
  status: 'idle' | 'loading' | 'ready' | 'unsupported' | 'error'
  /** Look and accessibility, as applied to the page right now. */
  prefs: Preferences
  /** Saves the text fields. Throws with a message the screen can show. */
  saveProfile: (patch: ProfilePatch) => Promise<void>
  /** The picture, already cropped and shrunk. */
  setAvatar: (picture: Blob) => Promise<void>
  clearAvatar: () => Promise<void>
  /**
   * Applies the change to the page at once and keeps it in this browser, then tells the server. When the server
   * cannot take it the page keeps the change anyway and this throws, so the screen can say so.
   */
  savePrefs: (patch: PreferencesPatch) => Promise<void>
}

export const ProfileContext = createContext<ProfileContextValue | null>(null)

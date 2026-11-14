import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchPreferences, fetchProfile, isNotSupported, removeAvatar, savePreferences, saveProfile as sendProfile, uploadAvatar } from '../api/profile'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { DEFAULT_PREFERENCES, EMPTY_PROFILE, readPreferences } from '../types/profile'
import type { Preferences, PreferencesPatch, Profile, ProfilePatch } from '../types/profile'
import { ProfileContext } from './profile'
import type { ProfileContextValue } from './profile'

const LOOK_KEY = 'look'

/** Every preference except the theme: that one belongs to the ThemeProvider, which already remembers it. */
type Look = Omit<Preferences, 'theme'>
function lookOf(all: Preferences): Look {
  const { theme, ...look } = all
  void theme
  return look
}
const DEFAULT_LOOK = lookOf(DEFAULT_PREFERENCES)

function readLocalLook(): Look {
  try {
    const raw = localStorage.getItem(LOOK_KEY)
    if (raw) return lookOf(readPreferences(JSON.parse(raw)))
  } catch {
    // storage unavailable or not readable: the defaults
  }
  return DEFAULT_LOOK
}

function writeLocalLook(look: Look) {
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify(look))
  } catch {
    // storage unavailable
  }
}

/** The look settings become attributes on <html>; src/styles/preferences.css reads them. Defaults leave no trace. */
function applyLook(look: Look) {
  const set = (name: string, value: string | null) => {
    if (value === null) delete document.documentElement.dataset[name]
    else document.documentElement.dataset[name] = value
  }
  set('text', look.textSize === 'normal' ? null : look.textSize)
  set('font', look.font === 'default' ? null : look.font)
  set('spacing', look.spacing === 'normal' ? null : look.spacing)
  set('density', look.density === 'comfortable' ? null : look.density)
  set('contrast', look.highContrast ? 'high' : null)
  set('colorblind', look.colorblindSafe ? 'on' : null)
  set('motion', look.reduceMotion ? 'reduce' : null)
  set('focus', look.strongFocus ? 'strong' : null)
}

const ATTRIBUTES = ['text', 'font', 'spacing', 'density', 'contrast', 'colorblind', 'motion', 'focus']

interface Known {
  userId: number
  profile: Profile | null
  outcome: 'ready' | 'unsupported' | 'error'
}

/**
 * The signed-in person's profile (About me) and look settings. The look is applied from this browser's copy as
 * soon as the page opens, so large text or high contrast never flash; once the server has answered, its copy wins.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { preference: theme, setPreference: setTheme } = useTheme()
  const [look, setLook] = useState<Look>(readLocalLook)
  const [known, setKnown] = useState<Known | null>(null)
  const lookRef = useRef(look)
  useEffect(() => {
    lookRef.current = look
  }, [look])
  // who is signed in now, for answers that arrive later
  const current = useRef<number | null>(userId)
  useEffect(() => {
    current.current = userId
  }, [userId])

  useLayoutEffect(() => {
    applyLook(look)
  }, [look])
  useEffect(
    () => () => {
      for (const name of ATTRIBUTES) delete document.documentElement.dataset[name]
    },
    [],
  )

  // the server's copy wins after sign-in; a server without the routes (or an error) leaves this browser's copy
  useEffect(() => {
    if (userId === null) return
    let stale = false
    fetchProfile(userId).then(
      (profile) => !stale && setKnown({ userId, profile, outcome: 'ready' }),
      (e) => !stale && setKnown({ userId, profile: null, outcome: isNotSupported(e) ? 'unsupported' : 'error' }),
    )
    fetchPreferences(userId).then(
      (saved) => {
        if (stale) return
        const nextLook = lookOf(saved)
        setLook(nextLook)
        writeLocalLook(nextLook)
        setTheme(saved.theme)
      },
      () => undefined,
    )
    return () => {
      stale = true
    }
  }, [userId, setTheme])

  const mine = known && known.userId === userId ? known : null
  const profile = mine?.profile ?? EMPTY_PROFILE
  const status: ProfileContextValue['status'] = userId === null ? 'idle' : (mine?.outcome ?? 'loading')

  const saveProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (userId === null) return
      const saved = await sendProfile(userId, patch)
      if (current.current === userId) setKnown({ userId, profile: saved, outcome: 'ready' })
    },
    [userId],
  )

  const setAvatar = useCallback(
    async (picture: Blob) => {
      if (userId === null) return
      const avatarUrl = await uploadAvatar(userId, picture)
      if (current.current === userId) setKnown((k) => ({ userId, profile: { ...(k?.userId === userId && k.profile ? k.profile : EMPTY_PROFILE), avatarUrl }, outcome: 'ready' }))
    },
    [userId],
  )

  const clearAvatar = useCallback(async () => {
    if (userId === null) return
    await removeAvatar(userId)
    if (current.current === userId) setKnown((k) => ({ userId, profile: { ...(k?.userId === userId && k.profile ? k.profile : EMPTY_PROFILE), avatarUrl: null }, outcome: 'ready' }))
  }, [userId])

  const savePrefs = useCallback(
    async (patch: PreferencesPatch) => {
      const { theme: nextTheme, ...lookPatch } = patch
      if (nextTheme !== undefined) setTheme(nextTheme)
      if (Object.keys(lookPatch).length > 0) {
        const next = { ...lookRef.current, ...lookPatch }
        lookRef.current = next
        setLook(next)
        writeLocalLook(next)
      }
      if (userId !== null) await savePreferences(userId, patch)
    },
    [userId, setTheme],
  )

  const prefs = useMemo<Preferences>(() => ({ ...look, theme }), [look, theme])
  const value = useMemo<ProfileContextValue>(
    () => ({ profile, status, prefs, saveProfile, setAvatar, clearAvatar, savePrefs }),
    [profile, status, prefs, saveProfile, setAvatar, clearAvatar, savePrefs],
  )
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

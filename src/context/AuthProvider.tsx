import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../api/auth'
import type { User } from '../types/user'
import { normalizeUser } from '../utils/roles'
import { AuthContext } from './auth'

const STORAGE_KEY = 'auth_user'

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // older sessions stored a single `role`: turn it into the role set
    return raw ? normalizeUser(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function saveUser(user: User | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser)

  const applyUser = useCallback((raw: User | null) => {
    const u = normalizeUser(raw)
    setUser(u)
    saveUser(u)
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => applyUser(await authApi.login(email, password)),
    [applyUser],
  )
  const signUp = useCallback(
    async (email: string, name: string, password: string) =>
      applyUser(await authApi.signup(email, name, password)),
    [applyUser],
  )
  const signOut = useCallback(async () => {
    await authApi.logout()
    applyUser(null)
  }, [applyUser])

  const value = useMemo(
    () => ({ user, isAuthenticated: user !== null, signIn, signUp, signOut }),
    [user, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

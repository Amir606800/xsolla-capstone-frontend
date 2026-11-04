import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useAuth } from '../hooks/useAuth'
import { AuthProvider } from './AuthProvider'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

describe('AuthProvider', () => {
  it('starts signed out', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('signIn stores the user and persists it', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(() => result.current.signIn('a@b.co', 'pw'))
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.email).toBe('a@b.co')
    expect(localStorage.getItem('auth_user')).toContain('a@b.co')
  })

  it('signIn failure leaves the user signed out', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await expect(act(() => result.current.signIn('a@b.co', ''))).rejects.toThrow('Invalid')
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('signUp uses the provided name', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(() => result.current.signUp('a@b.co', 'Sam', 'longenough1'))
    expect(result.current.user?.name).toBe('Sam')
  })

  it('signOut clears state and storage', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(() => result.current.signIn('a@b.co', 'pw'))
    await act(() => result.current.signOut())
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('auth_user')).toBeNull()
  })

  it('restores the session from storage and survives corrupt data', () => {
    localStorage.setItem('auth_user', 'not-json')
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.user).toBeNull()
  })

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow('AuthProvider')
  })
})

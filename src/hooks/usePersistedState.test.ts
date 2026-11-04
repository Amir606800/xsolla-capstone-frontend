import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePersistedState } from './usePersistedState'

const MODES = ['grid', 'list'] as const
type Mode = (typeof MODES)[number]

describe('usePersistedState', () => {
  it('starts with the initial value when nothing is stored', () => {
    const { result } = renderHook(() => usePersistedState<Mode>('k', 'grid', MODES))
    expect(result.current[0]).toBe('grid')
  })

  it('restores a stored allowed value', () => {
    localStorage.setItem('k', 'list')
    const { result } = renderHook(() => usePersistedState<Mode>('k', 'grid', MODES))
    expect(result.current[0]).toBe('list')
  })

  it('ignores a stored value that is not allowed', () => {
    localStorage.setItem('k', 'carousel')
    const { result } = renderHook(() => usePersistedState<Mode>('k', 'grid', MODES))
    expect(result.current[0]).toBe('grid')
  })

  it('updates state and persists it', () => {
    const { result } = renderHook(() => usePersistedState<Mode>('k', 'grid', MODES))
    act(() => result.current[1]('list'))
    expect(result.current[0]).toBe('list')
    expect(localStorage.getItem('k')).toBe('list')
  })

  it('keeps working when storage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => usePersistedState<Mode>('k', 'grid', MODES))
    expect(result.current[0]).toBe('grid')
    act(() => result.current[1]('list'))
    expect(result.current[0]).toBe('list')
    getItem.mockRestore()
    setItem.mockRestore()
  })
})

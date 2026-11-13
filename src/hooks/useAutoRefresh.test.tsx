import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoRefresh } from './useAutoRefresh'

const visibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility('visible')
})
afterEach(() => {
  vi.useRealTimers()
  visibility('visible')
})

describe('useAutoRefresh', () => {
  it('asks again every interval while the tab is in front', () => {
    const refresh = vi.fn()
    renderHook(() => useAutoRefresh(refresh, { everyMs: 1000 }))
    expect(refresh).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(3000))
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('does not ask while the tab is hidden, and asks as soon as it is back in front', () => {
    const refresh = vi.fn()
    renderHook(() => useAutoRefresh(refresh, { everyMs: 1000 }))
    visibility('hidden')
    act(() => void vi.advanceTimersByTime(5000))
    expect(refresh).not.toHaveBeenCalled()
    visibility('visible')
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('asks when the window gets focus again', () => {
    const refresh = vi.fn()
    renderHook(() => useAutoRefresh(refresh, { everyMs: 60_000 }))
    act(() => void window.dispatchEvent(new Event('focus')))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled, and stops after the screen is left', () => {
    const refresh = vi.fn()
    const off = renderHook(() => useAutoRefresh(refresh, { everyMs: 1000, enabled: false }))
    act(() => void vi.advanceTimersByTime(3000))
    expect(refresh).not.toHaveBeenCalled()
    off.unmount()

    const on = renderHook(() => useAutoRefresh(refresh, { everyMs: 1000 }))
    on.unmount()
    act(() => void vi.advanceTimersByTime(3000))
    expect(refresh).not.toHaveBeenCalled()
  })
})

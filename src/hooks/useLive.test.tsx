import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publish } from '../sync/bus'
import { useLive } from './useLive'

const visibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}
const flush = () => act(async () => void (await Promise.resolve()))

beforeEach(() => visibility('visible'))
afterEach(() => visibility('visible'))

describe('useLive', () => {
  it('refreshes at once when something of its topics is saved, and not for other topics', async () => {
    const refresh = vi.fn()
    renderHook(() => useLive(['courses'], refresh))
    publish(['events'])
    await flush()
    expect(refresh).not.toHaveBeenCalled()
    publish(['courses'])
    await flush()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('leaves a hidden tab alone (it refreshes when it comes back to the front)', async () => {
    const refresh = vi.fn()
    renderHook(() => useLive(['courses'], refresh))
    visibility('hidden')
    publish(['courses'])
    await flush()
    expect(refresh).not.toHaveBeenCalled()
    visibility('visible')
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes when the connection comes back', () => {
    const refresh = vi.fn()
    renderHook(() => useLive(['courses'], refresh))
    act(() => void window.dispatchEvent(new Event('online')))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does nothing while disabled, and stops listening when it is gone', async () => {
    const refresh = vi.fn()
    const { rerender, unmount } = renderHook(({ on }) => useLive(['courses'], refresh, { enabled: on }), { initialProps: { on: false } })
    publish(['courses'])
    await flush()
    expect(refresh).not.toHaveBeenCalled()
    rerender({ on: true })
    publish(['courses'])
    await flush()
    expect(refresh).toHaveBeenCalledTimes(1)
    unmount()
    publish(['courses'])
    await flush()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

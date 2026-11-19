import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, reloadOnceForStaleBuild } from '../utils/staleBuild'
import { AppErrorBoundary } from './AppErrorBoundary'

function Boom({ error }: { error: Error }): never {
  throw error
}

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: http://x/assets/Page-abc.js')

describe('isChunkLoadError', () => {
  it('knows the download errors of Chrome, Firefox and Safari, and nothing else', () => {
    expect(isChunkLoadError(chunkError())).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true)
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(false)
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false)
  })
})

describe('reloadOnceForStaleBuild', () => {
  beforeEach(() => sessionStorage.clear())

  it('reloads, but not again within 10 seconds, so a server that is down does not cause endless reloads', () => {
    const reload = vi.fn()
    expect(reloadOnceForStaleBuild(1_000_000, reload)).toBe(true)
    expect(reloadOnceForStaleBuild(1_005_000, reload)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
    // a later deploy, much later: reloads again
    expect(reloadOnceForStaleBuild(1_020_000, reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows the page when nothing fails', () => {
    render(<AppErrorBoundary><p>Dashboard</p></AppErrorBoundary>)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows a message with a Reload button instead of an empty screen', () => {
    render(<AppErrorBoundary><Boom error={new Error('bad data')} /></AppErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('a page file from an older build that was already reloaded for: offers to reload instead of looping', () => {
    sessionStorage.setItem('stale_build_reload_at', String(Date.now()))
    render(<AppErrorBoundary><Boom error={chunkError()} /></AppErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('A newer version is available')
  })

  it('going to another page tries again', () => {
    const { rerender } = render(<AppErrorBoundary resetKey="/a"><Boom error={new Error('bad data')} /></AppErrorBoundary>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(<AppErrorBoundary resetKey="/b"><p>Calendar</p></AppErrorBoundary>)
    expect(screen.getByText('Calendar')).toBeInTheDocument()
  })
})

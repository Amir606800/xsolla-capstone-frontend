import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { subscribe } from '../sync/bus'
import { apiRequest } from './http'

const later = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

beforeEach(() => vi.stubEnv('VITE_API_URL', 'http://api.test'))
afterEach(() => vi.unstubAllEnvs())

describe('saving something tells every screen', () => {
  it('publishes the topics of a request that saves, after the server said yes', async () => {
    await stubHttp(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const seen = vi.fn()
    const stop = subscribe(['events'], seen)
    await apiRequest('/events/5', { method: 'PUT', body: {} })
    await later()
    expect(seen).toHaveBeenCalledTimes(1)
    stop()
  })

  it('stays quiet for a read, and for a save the server refused', async () => {
    await stubHttp(async (_url: string, init: RequestInit) =>
      init.method === 'GET'
        ? new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
        : new Response('{"error":"invalid","message":"no"}', { status: 422, headers: { 'Content-Type': 'application/json' } }),
    )
    const seen = vi.fn()
    const stop = subscribe(['events'], seen)
    await apiRequest('/events')
    await expect(apiRequest('/events/5', { method: 'PUT', body: {} })).rejects.toThrow()
    await later()
    expect(seen).not.toHaveBeenCalled()
    stop()
  })
})

import { createServer } from 'node:http'
import type { IncomingMessage, Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, http } from './http'

/**
 * The real axios, over a real socket, against a tiny local server: what the other tests replace with a
 * stub is proven here (JSON, headers, methods, error bodies, no answer at all). Multipart uploads and Blob
 * downloads need a browser (Node's adapter cannot do them): see e2e/http-axios.spec.ts.
 */
let server: Server
let base = ''
let last: { method?: string; url?: string; headers: IncomingMessage['headers']; body: string }

beforeAll(async () => {
  http.defaults.adapter = 'http' // node has no XMLHttpRequest
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      last = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() }
      const send = (status: number, type: string, body: string) => {
        res.writeHead(status, { 'Content-Type': type })
        res.end(body)
      }
      if (req.url === '/json') return send(200, 'application/json', JSON.stringify({ id: 7, name: 'Ann' }))
      if (req.url === '/empty') return send(204, 'application/json', '')
      if (req.url === '/file') return send(200, 'application/pdf', '%PDF-1.4 slides')
      if (req.url === '/bad') return send(422, 'application/json', JSON.stringify({ error: 'invalid', message: 'name is required', details: [{ field: 'name', message: 'name is required' }] }))
      if (req.url === '/proxy') return send(502, 'text/html', '<html>Bad gateway</html>')
      if (req.url === '/file-denied') return send(403, 'application/json', JSON.stringify({ error: 'forbidden', message: 'not yours' }))
      send(200, 'application/json', JSON.stringify({ ok: true }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  vi.stubEnv('VITE_API_URL', base)
})

afterAll(async () => {
  vi.unstubAllEnvs()
  await new Promise((resolve) => server.close(resolve))
})

describe('apiRequest with the real axios', () => {
  it('GET returns the parsed JSON, with the Accept header and the bearer token', async () => {
    expect(await apiRequest('/json', { token: 'tok' })).toEqual({ id: 7, name: 'Ann' })
    expect(last.method).toBe('GET')
    expect(last.headers.accept).toBe('application/json')
    expect(last.headers.authorization).toBe('Bearer tok')
  })

  it('POST sends the body as JSON', async () => {
    await apiRequest('/echo', { method: 'POST', body: { email: 'a@x.co', n: 1 } })
    expect(last.headers['content-type']).toContain('application/json')
    expect(JSON.parse(last.body)).toEqual({ email: 'a@x.co', n: 1 })
  })

  it('PATCH, PUT and DELETE use their own method', async () => {
    for (const method of ['PATCH', 'PUT', 'DELETE'] as const) {
      await apiRequest('/echo', { method, body: method === 'DELETE' ? undefined : { a: 1 } })
      expect(last.method).toBe(method)
    }
  })

  it('an empty answer (204) is null, not an error', async () => {
    expect(await apiRequest('/empty', { method: 'DELETE' })).toBeNull()
  })

  it('a failed download still reports the server’s message', async () => {
    await expect(apiRequest('/file-denied', { as: 'blob' })).rejects.toMatchObject({ status: 403, code: 'forbidden', message: 'Not yours' })
  })

  it('an error status becomes an ApiError with the code, the sentence and the field details', async () => {
    const err = (await apiRequest('/bad').catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 422, code: 'invalid', message: 'Name is required' })
    expect(err.details).toEqual([{ field: 'name', message: 'name is required' }])
  })

  it('an error page that is not JSON still gives a plain ApiError', async () => {
    await expect(apiRequest('/proxy')).rejects.toMatchObject({ status: 502, code: 'error', message: 'Something went wrong' })
  })

  it('no answer at all is a network_error with status 0', async () => {
    vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:1')
    await expect(apiRequest('/json')).rejects.toMatchObject({ status: 0, code: 'network_error', message: expect.stringMatching(/can't reach the server/i) })
    vi.stubEnv('VITE_API_URL', base)
  })
})

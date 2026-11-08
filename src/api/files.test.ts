import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubHttp } from '../test/stubHttp'
import { downloadFile } from './files'
import { saveTokens } from './session'

const BASE = 'https://api.test'
let clicked: HTMLAnchorElement[]

beforeEach(() => {
  clicked = []
  localStorage.clear()
  // jsdom has no object URLs or real downloads: record the link that would be clicked instead
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this)
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('with the backend', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', BASE)
    saveTokens({ accessToken: 'acc', refreshToken: 'ref' })
  })

  it('fetches the file with the login token and saves it under its own name', async () => {
    const fetchMock = vi.fn(async () => new Response('%PDF-1.4 slides', { status: 200, headers: { 'Content-Type': 'application/pdf' } }))
    await stubHttp(fetchMock)
    await downloadFile({ id: '55', name: 'slides.pdf' })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${BASE}/files/55/download`)
    expect(init.headers).toMatchObject({ Authorization: 'Bearer acc' })
    expect(clicked[0].download).toBe('slides.pdf')
    expect(clicked[0].href).toBe('blob:fake')
  })

  it('says so when the backend does not allow it', async () => {
    await stubHttp(vi.fn(async () => new Response(JSON.stringify({ error: 'forbidden', message: 'cannot download this file' }), { status: 403 })))
    await expect(downloadFile({ id: '55', name: 'slides.pdf' })).rejects.toThrow('You are not allowed to download this file.')
  })

  it('a file the server never got cannot be downloaded', async () => {
    const sent = vi.fn()
    await stubHttp(sent)
    await expect(downloadFile({ name: 'local.pdf' })).rejects.toThrow('not on the server')
    expect(sent).not.toHaveBeenCalled()
  })
})

describe('offline demo', () => {
  it('saves a small text file that says it is a demo, without calling any server', async () => {
    const sent = vi.fn()
    await stubHttp(sent)
    await downloadFile({ name: 'Go Basics - lecture slides' })
    expect(sent).not.toHaveBeenCalled()
    expect(clicked[0].download).toBe('Go Basics - lecture slides-demo.txt')
  })
})

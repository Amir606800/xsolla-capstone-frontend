import { expect, test } from '@playwright/test'

/**
 * The browser's own transport under axios (XMLHttpRequest): multipart uploads, Blob downloads and a
 * request that never gets an answer. The app is offline in e2e (no VITE_API_URL), so requests go to
 * the dev server's own origin, where Playwright answers them.
 */
async function request(page: import('@playwright/test').Page, path: string, kind: 'json' | 'upload' | 'blob' | 'post') {
  return page.evaluate(
    async ([p, k]) => {
      const { apiRequest } = await import('/src/api/http.ts')
      try {
        if (k === 'upload') {
          const form = new FormData()
          form.append('file', new File(['abc'], 'a.pdf', { type: 'application/pdf' }))
          return { ok: await apiRequest(p, { method: 'POST', body: form, token: 'tok' }) }
        }
        if (k === 'blob') {
          const blob = await apiRequest<Blob>(p, { as: 'blob', token: 'tok' })
          return { ok: { isBlob: blob instanceof Blob, size: blob.size, type: blob.type, text: await blob.text() } }
        }
        if (k === 'post') return { ok: await apiRequest(p, { method: 'POST', body: { a: 1 }, token: 'tok' }) }
        return { ok: await apiRequest(p, { token: 'tok' }) }
      } catch (e) {
        const err = e as { name: string; status: number; code: string; message: string }
        return { error: { name: err.name, status: err.status, code: err.code, message: err.message } }
      }
    },
    [path, kind] as const,
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
})

test('a multipart upload carries its boundary and the file, with the token', async ({ page }) => {
  let seen: { type?: string; auth?: string; body?: string } = {}
  await page.route('**/__t/upload', async (route) => {
    const req = route.request()
    seen = { type: await req.headerValue('content-type') ?? '', auth: await req.headerValue('authorization') ?? '', body: req.postData() ?? '' }
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 300 }) })
  })
  expect(await request(page, '/__t/upload', 'upload')).toEqual({ ok: { id: 300 } })
  expect(seen.type).toMatch(/^multipart\/form-data; boundary=/)
  expect(seen.auth).toBe('Bearer tok')
  expect(seen.body).toContain('filename="a.pdf"')
})

test('JSON goes out as JSON and comes back parsed', async ({ page }) => {
  let sent = ''
  await page.route('**/__t/json', async (route) => {
    sent = route.request().postData() ?? ''
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 7 }) })
  })
  expect(await request(page, '/__t/json', 'post')).toEqual({ ok: { id: 7 } })
  expect(JSON.parse(sent)).toEqual({ a: 1 })
})

test('a download comes back as a real Blob', async ({ page }) => {
  await page.route('**/__t/file', (route) => route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4 slides' }))
  expect(await request(page, '/__t/file', 'blob')).toEqual({ ok: { isBlob: true, size: 15, type: 'application/pdf', text: '%PDF-1.4 slides' } })
})

test('error answers become an ApiError; a JSON error on a download keeps its message', async ({ page }) => {
  await page.route('**/__t/bad', (route) => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'invalid', message: 'name is required' }) }))
  await page.route('**/__t/denied', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'forbidden', message: 'not yours' }) }))
  await page.route('**/__t/html', (route) => route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' }))
  expect(await request(page, '/__t/bad', 'json')).toEqual({ error: { name: 'ApiError', status: 422, code: 'invalid', message: 'Name is required' } })
  expect(await request(page, '/__t/denied', 'blob')).toEqual({ error: { name: 'ApiError', status: 403, code: 'forbidden', message: 'Not yours' } })
  expect(await request(page, '/__t/html', 'json')).toEqual({ error: { name: 'ApiError', status: 502, code: 'error', message: 'Something went wrong' } })
})

test('a request that cannot reach the server is a network_error', async ({ page }) => {
  await page.route('**/__t/down', (route) => route.abort('connectionrefused'))
  expect(await request(page, '/__t/down', 'json')).toEqual({
    error: { name: 'ApiError', status: 0, code: 'network_error', message: "Can't reach the server. Check your connection and try again." },
  })
})

import { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosAdapter, AxiosInstance, InternalAxiosRequestConfig } from 'axios'

/**
 * Tests answer the app's HTTP requests with a function shaped like `fetch` (url, init) -> Response, so
 * what a test checks (the URL, method, headers, body) and how it answers does not depend on the HTTP
 * library. Only the transport under axios is replaced: interceptors, headers, body encoding and error
 * handling in src/api/http.ts all run for real.
 */
// (a vi.fn() mock has no fixed signature, so it is accepted as is and called like fetch)
type FetchLike = unknown

const originals = new Map<AxiosInstance, AxiosInstance['defaults']['adapter']>()

export async function stubHttp(answer: FetchLike): Promise<void> {
  // imported now, not at the top: a test may have reset the module registry, and the stub must go on
  // the axios instance the app code under test will use
  const { http } = await import('../api/http')
  if (!originals.has(http)) originals.set(http, http.defaults.adapter)

  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const axiosHeaders = AxiosHeaders.from(config.headers)
    // like the real transport: the browser sets a multipart request's Content-Type (and its boundary)
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) axiosHeaders.delete('Content-Type')
    const headers = axiosHeaders.toJSON() as Record<string, string>
    const call = answer as (url: string, init: RequestInit) => Response | Promise<Response>
    let res: Response
    try {
      res = await call(config.url ?? '', { method: config.method?.toUpperCase(), headers, body: config.data })
    } catch (e) {
      // a stub that throws stands for "no answer at all": the real transport reports that as an AxiosError
      throw new AxiosError(e instanceof Error ? e.message : 'Network Error', AxiosError.ERR_NETWORK, config)
    }
    const data = config.responseType === 'blob' ? await res.blob() : await res.text()
    const out: Record<string, string> = {}
    res.headers.forEach((value, key) => (out[key] = value))
    return { data, status: res.status, statusText: res.statusText, headers: out, config, request: {} }
  }
  http.defaults.adapter = adapter
}

/** Puts the real transport back (called after every test). */
export function restoreHttp(): void {
  for (const [http, adapter] of originals) http.defaults.adapter = adapter
  originals.clear()
}

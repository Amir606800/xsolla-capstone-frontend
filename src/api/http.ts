import axios, { AxiosError } from 'axios'
import type { AxiosRequestConfig } from 'axios'

/** Thin axios wrapper for the LMS backend: JSON in/out and one error type for every failure. */

/** Base URL of the backend (no trailing slash). Empty = no backend configured, the mock API is used. */
export function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
}

export const hasBackend = () => apiBaseUrl() !== ''

/** Matches the backend's `handlers.ErrorResponse`. */
interface ErrorBody {
  error?: string
  message?: string
  status?: number
  details?: { field?: string; message?: string }[]
}

export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached at all. */
  readonly status: number
  /** Machine-readable code from the backend, e.g. "invalid_credentials". */
  readonly code: string
  readonly details: { field?: string; message?: string }[]

  constructor(status: number, code: string, message: string, details: ErrorBody['details'] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const sentence = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text)

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** JSON-encoded, except FormData (file uploads), which is sent as multipart and lets the browser set the boundary. */
  body?: unknown
  /** Sent as `Authorization: Bearer <token>`. */
  token?: string | null
  /** 'blob' for file downloads; JSON otherwise. */
  as?: 'json' | 'blob'
}

/**
 * The one axios instance every request goes through. Errors are turned into `ApiError` below, so axios
 * never decides what counts as a failure (`validateStatus`) and never parses the body itself
 * (`transformResponse`): a proxy's HTML error page must not break the error handling.
 */
export const http = axios.create({
  validateStatus: () => true,
  transformResponse: (data: unknown) => data,
})

export async function apiRequest<T>(path: string, { method = 'GET', body, token, as = 'json' }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: as === 'blob' ? '*/*' : 'application/json' }
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const config: AxiosRequestConfig = {
    url: `${apiBaseUrl()}${path}`,
    method,
    headers,
    // a FormData goes out as multipart (axios and the browser set the boundary); anything else as JSON
    data: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    responseType: as === 'blob' ? 'blob' : 'text',
  }

  let res
  try {
    res = await http.request<unknown>(config)
  } catch (e) {
    // no answer at all: offline, DNS, CORS, a refused connection
    if (e instanceof AxiosError || axios.isAxiosError(e)) {
      throw new ApiError(0, 'network_error', "Can't reach the server. Check your connection and try again.")
    }
    throw e
  }

  const ok = res.status >= 200 && res.status < 300
  if (ok && as === 'blob') return res.data as T

  // a blob response that failed still carries the server's JSON error as text
  const text = typeof res.data === 'string' ? res.data : res.data instanceof Blob ? await res.data.text() : ''
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // not JSON (e.g. a proxy error page)
    }
  }

  if (!ok) {
    const err = (json ?? {}) as ErrorBody
    const fieldMessages = (err.details ?? []).map((d) => d.message).filter(Boolean)
    const message = fieldMessages.length > 0 ? fieldMessages.join('. ') : (err.message ?? 'Something went wrong')
    throw new ApiError(res.status, err.error ?? 'error', sentence(message), err.details)
  }

  return json as T
}

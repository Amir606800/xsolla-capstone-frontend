import { authedRequest } from './authed'
import { ApiError } from './http'

/** The most ids one combined request carries (the server's limit). */
const MAX_IDS = 200

const noCombinedRoute = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405)

/**
 * One request for many weeks (or tasks) instead of one each (backend docs: the combined reads):
 *   GET /content-items?module_ids=1,2,3     GET /quizzes?module_ids=…     GET /enrollments?module_ids=…
 *   GET /submissions/me?assignment_ids=…
 * The server answers `{ "<id>": value }` with what the per-week route answers for that id, and leaves out an id the
 * caller may not read. A server without the combined route (404/405) is asked id by id with `one` instead, which
 * returns `undefined` for an id to leave out.
 */
export async function fetchByIds<T>(
  path: string,
  param: 'module_ids' | 'assignment_ids',
  ids: (string | number)[],
  one: (id: string) => Promise<T | undefined>,
): Promise<Record<string, T>> {
  const unique = [...new Set(ids.map(String))]
  const out: Record<string, T> = {}
  if (unique.length === 0) return out
  try {
    for (let i = 0; i < unique.length; i += MAX_IDS) {
      const part = unique.slice(i, i + MAX_IDS).join(',')
      Object.assign(out, (await authedRequest<Record<string, T> | null>(`/${path}?${param}=${part}`)) ?? {})
    }
    return out
  } catch (e) {
    if (!noCombinedRoute(e)) throw e
  }
  const values = await Promise.all(unique.map(one))
  unique.forEach((id, i) => {
    const v = values[i]
    if (v !== undefined) out[id] = v
  })
  return out
}

import { useCallback, useEffect, useState } from 'react'
import { fetchUsers } from '../api/directory'

/**
 * Names for user ids (e.g. a module's `created_by`), from the admin directory.
 * Until it loads, or if it cannot (the backend has no GET /users yet), the id is shown instead.
 */
export function usePeopleNames(): (id: number | undefined) => string {
  const [names, setNames] = useState<Map<number, string> | null>(null)

  useEffect(() => {
    let alive = true
    fetchUsers()
      .then((users) => {
        if (alive) setNames(new Map(users.map((u) => [u.id, u.name])))
      })
      .catch(() => {
        /* keep showing ids */
      })
    return () => {
      alive = false
    }
  }, [])

  return useCallback((id: number | undefined) => {
    if (id === undefined) return 'No lecturer'
    return names?.get(id) ?? `User #${id}`
  }, [names])
}

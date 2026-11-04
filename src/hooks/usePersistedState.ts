import { useCallback, useState } from 'react'

/**
 * useState that remembers one of a fixed set of string values in localStorage.
 * Unknown or unreadable stored values fall back to `initial`; storage failures
 * (private mode, blocked storage) never throw.
 */
export function usePersistedState<T extends string>(
  key: string,
  initial: T,
  allowed: readonly T[],
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved !== null && (allowed as readonly string[]).includes(saved)) return saved as T
    } catch {
      // storage unavailable
    }
    return initial
  })

  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, next)
      } catch {
        // storage unavailable
      }
    },
    [key],
  )

  return [value, update]
}

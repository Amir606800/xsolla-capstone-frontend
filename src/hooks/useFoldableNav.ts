import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { foldedGroups, groupOfPath, shouldFold, toggleFolded } from '../utils/navFold'

interface FoldGroup {
  /** The group's name; also what is remembered. */
  id: string
  /** The links in it, to tell which group the current page is in. */
  paths: string[]
}

function read(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : null
  } catch {
    return null
  }
}

function write(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked: the choice lasts until the page reloads */
  }
}

/**
 * Folding groups for a side menu, only when the menu does not fit. `containerRef` goes on the element that scrolls (the
 * menu's own box); its direct children are the menu. The hook adds up their height as if every group were open
 * (`[data-fold-body]` elements know how tall they are folded away) and compares it with the room there is. When it fits,
 * `foldable` is false and every group is open: nothing to click. When it does not, the groups can be folded, the choice
 * is remembered, and the group of the current page opens by itself when the person goes into it.
 */
export function useFoldableNav({
  storageKey,
  groups,
  pathname,
  enabled = true,
}: {
  storageKey: string
  groups: FoldGroup[]
  pathname: string
  /** Off where the menu is not a column (a row on a phone, a rail of icons). */
  enabled?: boolean
}) {
  const containerRef = useRef<HTMLElement>(null)
  const [foldable, setFoldable] = useState(false)
  const [saved, setSaved] = useState<string[] | null>(() => read(storageKey))
  const ids = useMemo(() => groups.map((g) => g.id), [groups])
  const active = useMemo(() => groupOfPath(groups, pathname), [groups, pathname])
  const folded = useMemo(() => foldedGroups(saved, ids, active), [saved, ids, active])

  const measure = useCallback(() => {
    const el = containerRef.current
    if (!el || !enabled) return setFoldable(false)
    const style = getComputedStyle(el)
    const room = el.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0)
    const gap = parseFloat(style.rowGap) || 0
    const shown = Array.from(el.children).filter((c) => (c as HTMLElement).offsetHeight > 0) as HTMLElement[]
    const used = shown.reduce((n, c) => n + c.offsetHeight, 0) + gap * Math.max(0, shown.length - 1)
    // what the folded groups would add back if they were open
    const hidden = Array.from(el.querySelectorAll<HTMLElement>('[data-fold-body]')).reduce(
      (n, b) => n + Math.max(0, b.scrollHeight - b.offsetHeight),
      0,
    )
    setFoldable(shouldFold(room, used + hidden))
  }, [enabled])

  useLayoutEffect(measure, [measure, folded, ids])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(el)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [measure])

  // going into a folded group (a link elsewhere, the search) opens it: worked out while rendering, when the page changes
  const [seenActive, setSeenActive] = useState(active)
  if (active !== seenActive) {
    setSeenActive(active)
    if (active && folded.includes(active)) setSaved(toggleFolded(folded, active))
  }

  // the choice is remembered (nothing is stored until the person, or a link, has changed something)
  useEffect(() => {
    if (saved !== null) write(storageKey, saved)
  }, [saved, storageKey])

  const toggle = useCallback((id: string) => setSaved(toggleFolded(folded, id)), [folded])

  const isOpen = useCallback((id: string) => !foldable || !folded.includes(id), [foldable, folded])

  // the ref is returned apart from the rest: it goes on the menu's element, the rest is read while rendering
  return [containerRef, { foldable, isOpen, toggle }] as const
}

/**
 * Folding groups in a side menu. A menu only folds when it would not fit: when everything fits, every group stays open
 * and its heading is plain text. These are the rules, apart from the screen.
 */

/** Does the fully open menu need more room than there is? A pixel of slack avoids flickering at the edge. */
export function shouldFold(available: number, openHeight: number, slack = 1): boolean {
  return available > 0 && openHeight > available + slack
}

/** The group a page belongs to: the one with the link that is the page itself or a parent of it. The longest link wins. */
export function groupOfPath<T extends { id: string; paths: string[] }>(groups: T[], pathname: string): string | null {
  let best: { id: string; length: number } | null = null
  for (const g of groups) {
    for (const p of g.paths) {
      const hit = pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`)
      if (hit && (!best || p.length > best.length)) best = { id: g.id, length: p.length }
    }
  }
  return best?.id ?? null
}

/**
 * The folded groups. Before the person has ever chosen (`saved` is null) every group is folded except the one the
 * current page is in, so the menu opens on where they are.
 */
export function foldedGroups(saved: string[] | null, ids: string[], active: string | null): string[] {
  return saved === null ? ids.filter((id) => id !== active) : saved.filter((id) => ids.includes(id))
}

/** One group opened or closed. */
export function toggleFolded(folded: string[], id: string): string[] {
  return folded.includes(id) ? folded.filter((x) => x !== id) : [...folded, id]
}

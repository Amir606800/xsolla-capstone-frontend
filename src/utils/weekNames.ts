interface WeekModule {
  id: string
  position: number
  title: string
}

/**
 * "Week 5 · Go Basics" for a module id, from the course; the server's own title (`titles`) when the course does not know
 * the module, and "Module 12" when nothing does.
 */
export function weekNamer(modules: WeekModule[], titles: Map<string, string | undefined>): (id: string) => string {
  const byId = new Map(modules.map((m) => [m.id, m]))
  return (id) => {
    const m = byId.get(id)
    const title = m?.title ?? titles.get(id)
    return m ? `Week ${m.position}${title ? ` · ${title}` : ''}` : (title ?? `Module ${id}`)
  }
}

/** The ids with the latest week first (weeks the course does not know go last, by id). */
export function latestWeekFirst(ids: string[], modules: WeekModule[]): string[] {
  const position = new Map(modules.map((m) => [m.id, m.position]))
  return [...new Set(ids)].sort((a, b) => (position.get(b) ?? 0) - (position.get(a) ?? 0) || b.localeCompare(a))
}

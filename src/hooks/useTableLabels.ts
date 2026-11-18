import { useEffect } from 'react'

/** Gives every cell of the admin tables under `root` its column's name (`data-label`), so a phone can show each row as a card. */
function label(table: HTMLTableElement) {
  const heads = Array.from(table.tHead?.rows[0]?.cells ?? []).map((th) => th.textContent?.trim() ?? '')
  for (const row of Array.from(table.tBodies).flatMap((b) => Array.from(b.rows))) {
    Array.from(row.cells).forEach((cell, i) => {
      const name = heads[i]
      if (name) {
        if (cell.dataset.label !== name) cell.dataset.label = name
      } else if (cell.dataset.label) {
        delete cell.dataset.label
      }
    })
  }
}

export function useTableLabels(selector = '.admin__main') {
  useEffect(() => {
    const root = document.querySelector(selector)
    if (!root) return
    let queued = false
    const run = () => {
      queued = false
      root.querySelectorAll<HTMLTableElement>('table.admin-table').forEach(label)
    }
    // the tables are drawn (and redrawn) by the pages: label them again whenever something under the page changes
    const watch = new MutationObserver(() => {
      if (queued) return
      queued = true
      requestAnimationFrame(run)
    })
    watch.observe(root, { childList: true, subtree: true })
    run()
    return () => watch.disconnect()
  }, [selector])
}

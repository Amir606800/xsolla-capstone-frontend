import { useState } from 'react'

export type SortDir = 'asc' | 'desc'
export interface SortState<K extends string> {
  key: K
  dir: SortDir
}
/** What a row is sorted by in one column; empty values (null, undefined, '') always go last. */
export type SortValue = string | number | null | undefined

const isEmpty = (v: SortValue) => v === null || v === undefined || v === ''

/** Text in natural order ("Team 2" before "Team 10"), numbers by size, empty values last either way. */
export function compareValues(a: SortValue, b: SortValue, dir: SortDir): number {
  if (isEmpty(a) || isEmpty(b)) return isEmpty(a) === isEmpty(b) ? 0 : isEmpty(a) ? 1 : -1
  const order =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
  return dir === 'asc' ? order : -order
}

/**
 * Sortable table rows. `columns` says what each sortable column sorts by. Clicking a column sorts it
 * ascending, clicking it again descending. Ties keep their original order.
 */
export function useSort<T, K extends string>(rows: T[], columns: Record<K, (row: T) => SortValue>, initial: NoInfer<SortState<K>> | null = null) {
  const [sort, setSort] = useState<SortState<K> | null>(initial)

  const sorted = sort
    ? rows
        .map((row, i) => ({ row, i }))
        .sort((a, b) => compareValues(columns[sort.key](a.row), columns[sort.key](b.row), sort.dir) || a.i - b.i)
        .map((x) => x.row)
    : rows

  const toggle = (key: K) => setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  return { sorted, sort, toggle }
}

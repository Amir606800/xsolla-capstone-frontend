import type { SortState } from '../../hooks/useSort'

/** A column header that sorts the table: click for A-Z, again for Z-A. Screen readers hear the order (aria-sort). */
export function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string
  sortKey: K
  sort: SortState<K> | null
  onSort: (key: K) => void
}) {
  const dir = sort?.key === sortKey ? sort.dir : null
  return (
    <th scope="col" aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <button type="button" className={`admin-sort${dir ? ' is-active' : ''}`} onClick={() => onSort(sortKey)}>
        {label}
        <svg className="admin-sort__icon" width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" focusable="false">
          <path className={dir === 'asc' ? 'is-on' : undefined} d="M5 1l4 5H1z" />
          <path className={dir === 'desc' ? 'is-on' : undefined} d="M5 13l4-5H1z" />
        </svg>
      </button>
    </th>
  )
}

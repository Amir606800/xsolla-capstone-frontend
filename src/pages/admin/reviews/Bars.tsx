/** A short list of "label ... bar ... count" rows. The count is written, so the bar is only a hint. */
export function Bars({ label, rows }: { label: string; rows: { key: string; text: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="admin-bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key}>
          <span className="admin-bars__label">{r.text}</span>
          <span className="admin-bars__track" aria-hidden="true">
            <span className="admin-bars__fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="admin-bars__count">{r.count}</span>
        </li>
      ))}
    </ul>
  )
}

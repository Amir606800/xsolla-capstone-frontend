/** From/To reporting dates. Both empty means the backend default (the last 12 weeks). */
export function AnalyticsPeriod({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const changed = from !== '' || to !== ''
  return (
    <div className="admin-row analytics-period" role="group" aria-label="Reporting period">
      <label className="admin-field">
        <span className="admin-field__label">From</span>
        <input
          type="date"
          className="admin-field__input"
          value={from}
          max={to || undefined}
          onChange={(e) => onChange(e.target.value, to)}
        />
      </label>
      <label className="admin-field">
        <span className="admin-field__label">To</span>
        <input
          type="date"
          className="admin-field__input"
          value={to}
          min={from || undefined}
          onChange={(e) => onChange(from, e.target.value)}
        />
      </label>
      {changed && (
        <button type="button" className="admin-btn" onClick={() => onChange('', '')}>
          Last 12 weeks
        </button>
      )}
    </div>
  )
}

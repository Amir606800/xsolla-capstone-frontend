import { memo } from 'react'

interface StatBarProps {
  label: string
  value: number
  max: number
  /** Reserved slot for features that are not built yet (e.g. quizzes). */
  placeholder?: string
}

function StatBarBase({ label, value, max, placeholder }: StatBarProps) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)

  return (
    <div className={`stat${placeholder ? ' is-placeholder' : ''}`}>
      <div className="stat__head">
        <span className="stat__label">{label}</span>
        <span className="stat__value">
          {placeholder ?? (
            <>
              <strong>{value}</strong>/{max}
            </>
          )}
        </span>
      </div>
      <div
        className="stat__bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={placeholder ? undefined : value}
        aria-valuetext={placeholder ?? `${value} of ${max}`}
      >
        <div className="stat__fill" style={{ width: `${placeholder ? 0 : pct}%` }} />
      </div>
    </div>
  )
}

export const StatBar = memo(StatBarBase)

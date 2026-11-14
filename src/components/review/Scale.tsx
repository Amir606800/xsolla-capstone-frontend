import type { Score } from '../../types/mentorReview'
import { SCORES } from '../../utils/mentorReview'

/** One 1-5 choice. `name` groups the radios; the legend or label around it says what is rated. */
export function Scale({
  name,
  value,
  onChange,
  low,
  high,
}: {
  name: string
  value: number | null | undefined
  onChange: (s: Score) => void
  low: string
  high: string
}) {
  return (
    <>
      <div className="mentor-review__scale">
        {SCORES.map((s) => (
          <label key={s} className="mentor-review__score">
            <input
              type="radio"
              name={name}
              value={s}
              checked={value === s}
              onChange={() => onChange(s)}
              aria-label={`${s}${s === 1 ? ` - ${low}` : s === 5 ? ` - ${high}` : ''}`}
            />
            <span aria-hidden="true">{s}</span>
          </label>
        ))}
      </div>
      <p className="mentor-review__ends" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </p>
    </>
  )
}

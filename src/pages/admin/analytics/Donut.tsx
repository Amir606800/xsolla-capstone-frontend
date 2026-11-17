import type { Tone } from '../../../utils/personAnalytics'
import { describeParts, shareOf } from './chartFormat'

/** One part of a whole: the tone picks the colour (green / yellow / red / grey), the label names it. */
export interface Slice {
  key: string
  label: string
  value: number
  tone: Tone
}

const R = 46
const C = 2 * Math.PI * R
/** The surface gap between two parts, along the ring. */
const GAP = 2.5

/**
 * A ring split into a few parts, with the headline in the middle. Hover a part for its count and share; the legend
 * beside it (`SliceLegend`) carries the same numbers in text, so nothing depends on colour or hovering.
 */
export function Donut({ slices, center, sub, label }: { slices: Slice[]; center: string; sub?: string; label: string }) {
  const total = slices.reduce((n, s) => n + s.value, 0)
  const parts = slices.filter((s) => s.value > 0)
  let start = 0

  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${label}: ${total === 0 ? 'nothing yet' : describeParts(slices)}`}>
        <circle className="donut__track" cx="60" cy="60" r={R} />
        {total > 0 &&
          parts.map((s) => {
            const length = (s.value / total) * C
            const gap = parts.length > 1 ? Math.min(GAP, length / 2) : 0
            const offset = -start
            start += length
            return (
              <circle
                key={s.key}
                className={`donut__part donut__part--${s.tone}`}
                cx="60"
                cy="60"
                r={R}
                strokeDasharray={`${length - gap} ${C - length + gap}`}
                strokeDashoffset={offset}
              >
                <title>{`${s.label}: ${s.value} of ${total} (${shareOf(s.value, total)}%)`}</title>
              </circle>
            )
          })}
      </svg>
      <div className="donut__center" aria-hidden="true">
        <strong>{center}</strong>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  )
}

/** The parts by name with their count and share: the text twin of the ring. */
export function SliceLegend({ slices, label }: { slices: Slice[]; label: string }) {
  const total = slices.reduce((n, s) => n + s.value, 0)
  return (
    <ul className="slice-legend" aria-label={label}>
      {slices.map((s) => (
        <li key={s.key}>
          <span className={`slice-legend__swatch donut-fill--${s.tone}`} aria-hidden="true" />
          <span className="slice-legend__label">{s.label}</span>
          <strong className="slice-legend__value">{s.value}</strong>
          <span className="slice-legend__share">{total === 0 ? '' : `${shareOf(s.value, total)}%`}</span>
        </li>
      ))}
    </ul>
  )
}

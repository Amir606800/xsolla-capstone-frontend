import { Icon } from './Icon'

/** A task that was graded by the lecturer. It is final: the student can no longer change it. */
export function GradedPill() {
  return (
    <span className="pill pill--ok graded-pill">
      <Icon name="check" size={14} />
      Graded
    </span>
  )
}

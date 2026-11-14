import { useId, useState } from 'react'
import type { StandingLevel, WeeklyStanding } from '../../../types/standing'
import type { Person } from '../../../types/team'
import { formatDateTime } from '../../../utils/date'
import { gradeWarning } from '../../../utils/review'
import { STANDING_ICON, STANDING_LABEL, STANDING_LEVELS } from '../../../utils/standing'
import { Icon } from '../../Icon'
import { StandingPill } from '../../StandingPill'
import { Avatar } from '../../team/People'

/**
 * MENTOR: one student's grade for one week - green (on track), yellow (falling behind) or red
 * (no progress) - with an optional note. The grade can be changed later; the last one counts.
 */
export function WeekGradeItem({
  student,
  week,
  grade,
  theirWeeks,
  work,
  open,
  onToggle,
  onSave,
  details = true,
  alwaysOpen = false,
}: {
  student: Person
  week: number
  grade: WeeklyStanding | undefined
  /** The student's other weekly grades, for the rule warnings. */
  theirWeeks: WeeklyStanding[]
  /** How much of the week's work they handed in; left out when the mentor cannot see it. */
  work?: { done: number; total: number }
  open: boolean
  onToggle: () => void
  onSave: (level: StandingLevel, note: string) => Promise<void>
  /** The note and the "last saved" date; off where the server keeps only the colour. */
  details?: boolean
  /** One student's page: the form is always shown, there is nothing to open. */
  alwaysOpen?: boolean
}) {
  const id = useId()
  const [level, setLevel] = useState<StandingLevel | null>(grade?.level ?? null)
  const [note, setNote] = useState(grade?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const warning = level ? gradeWarning(theirWeeks, week, level) : null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!level) {
      setError('Pick green, yellow or red first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave(level, note)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the grade')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`review${open ? ' is-open' : ''}`}>
      {alwaysOpen ? (
        <p className="review__now">
          <span className="list__meta">Now:</span>
          {grade ? <StandingPill level={grade.level} /> : <span className="chip">Not graded</span>}
        </p>
      ) : (
      <div className="review__row">
        <Avatar name={student.name} small />
        <span className="person-row__main">
          <span className="person-row__name">{student.name}</span>
          {work && (
            <span className="list__meta">
              {work.total === 0 ? 'No tasks this week' : `${work.done} of ${work.total} tasks handed in`}
            </span>
          )}
        </span>
        {grade ? <StandingPill level={grade.level} /> : <span className="chip">Not graded</span>}
        {!alwaysOpen && (
        <button
          type="button"
          className="btn btn--ghost btn--small"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          aria-label={`${grade ? 'Change' : 'Grade'} ${student.name}'s week ${week}`}
          onClick={onToggle}
        >
          {grade ? 'Change' : 'Grade'}
          <Icon name="chevron" size={16} />
        </button>
        )}
      </div>
      )}

      {(open || alwaysOpen) && (
        <form className="review__panel review__form" id={`${id}-panel`} onSubmit={save} noValidate>
          <fieldset className="grade-pick">
            <legend className="field__label">
              Week {week} grade for {student.name}
            </legend>
            {STANDING_LEVELS.map((l) => (
              <label key={l} className={`grade-pick__option grade-pick__option--${l}`}>
                <input type="radio" name={`${id}-level`} value={l} checked={level === l} onChange={() => setLevel(l)} />
                <span className="grade-pick__head">
                  <Icon name={STANDING_ICON[l]} size={16} />
                  {STANDING_LABEL[l]}
                </span>
                <span className="grade-pick__mark" aria-hidden="true">
                  <Icon name="check" size={14} />
                </span>
              </label>
            ))}
          </fieldset>

          {warning && (
            <p className="grade-pick__warning" role="status">
              <Icon name="alert" size={16} /> {warning}
            </p>
          )}

          {details && (
            <>
              <label className="field__label" htmlFor={`${id}-note`}>
                Note for {student.name} (optional)
              </label>
              <textarea
                id={`${id}-note`}
                className="field__input form__textarea"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </>
          )}
          {grade && (
            <p className="list__meta">{details ? `Last saved ${formatDateTime(grade.assessedAt)}. ` : ''}Saving again replaces it.</p>
          )}
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          <div className="review__actions">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Saving…' : 'Save week grade'}
            </button>
          </div>
        </form>
      )}
    </li>
  )
}

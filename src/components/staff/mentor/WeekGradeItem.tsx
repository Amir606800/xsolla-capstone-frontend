import { useId, useState } from 'react'
import type { StandingLevel, WeeklyStanding } from '../../../types/standing'
import type { Person } from '../../../types/team'
import { formatDateTime } from '../../../utils/date'
import { gradeWarning } from '../../../utils/review'
import { MAX_GRADE_NOTE, STANDING_ICON, STANDING_LABEL, STANDING_LEVELS } from '../../../utils/standing'
import { Icon } from '../../Icon'
import { StandingPill } from '../../StandingPill'
import { Avatar } from '../../team/People'

/**
 * MENTOR: one student's grade for one week - green (on track), yellow (falling behind) or red
 * (no progress) - with the module feedback, which is required: a grade is never given without a few words on the week.
 * The grade can be changed later; the last one counts. (The comments on single tasks are separate and optional.)
 * A task of the week handed in late makes the week red: while that stands, green and yellow cannot be picked.
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
  alwaysOpen = false,
  locked = false,
  lateTasks = [],
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
  /** One student's page: the form is always shown, there is nothing to open. */
  alwaysOpen?: boolean
  /** The week has closed and it already has a grade: the grade is shown, not editable. */
  locked?: boolean
  /** Tasks of this week the student handed in late: the week is red because of them. */
  lateTasks?: string[]
}) {
  const id = useId()
  const late = lateTasks.length > 0
  const [picked, setLevel] = useState<StandingLevel | null>(grade?.level ?? null)
  // a late hand-in keeps the week red, whatever was picked before
  const level: StandingLevel | null = late ? 'red' : picked
  const [note, setNote] = useState(grade?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [noteError, setNoteError] = useState('')
  const warning = level ? gradeWarning(theirWeeks, week, level) : null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const text = note.trim()
    setError('')
    setNoteError('')
    if (!level) {
      setError('Pick green, yellow or red first.')
      if (!text) setNoteError(`Write the module feedback for ${student.name}: it is required.`)
      return
    }
    if (!text) {
      setNoteError(`Write the module feedback for ${student.name}: it is required.`)
      return
    }
    if (text.length > MAX_GRADE_NOTE) {
      setNoteError(`Keep the module feedback under ${MAX_GRADE_NOTE} characters.`)
      return
    }
    setBusy(true)
    try {
      await onSave(level, text)
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
        <Avatar name={student.name} url={student.avatarUrl} small />
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

      {locked && grade && (
        <div className="review__panel review__locked">
          <p className="review__locked-title">
            <Icon name="lock" size={16} /> Grade locked
          </p>
          <p className="list__meta">Week {week} is closed, so its grade can no longer be changed.</p>
          {grade.note && <p className="review__locked-note">{grade.note}</p>}
          <p className="list__meta">Saved {formatDateTime(grade.assessedAt)}.</p>
        </div>
      )}

      {!locked && (open || alwaysOpen) && (
        <form className="review__panel review__form" id={`${id}-panel`} onSubmit={save} noValidate>
          {late && (
            <p className="grade-pick__late" role="note">
              <Icon name="clock" size={16} /> Red because of a late submission ({lateTasks.join(', ')}). While it stands the week stays
              red; your module feedback is still needed.
            </p>
          )}
          <fieldset className="grade-pick">
            <legend className="field__label">
              Week {week} grade for {student.name}
            </legend>
            {STANDING_LEVELS.map((l) => (
              <label key={l} className={`grade-pick__option grade-pick__option--${l}${late && l !== 'red' ? ' is-disabled' : ''}`}>
                <input
                  type="radio"
                  name={`${id}-level`}
                  value={l}
                  checked={level === l}
                  disabled={late && l !== 'red'}
                  onChange={() => setLevel(l)}
                />
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

          <label className="field__label" htmlFor={`${id}-note`}>
            Module feedback for {student.name} (required)
          </label>
          <textarea
            id={`${id}-note`}
            className="field__input form__textarea"
            rows={3}
            required
            aria-required="true"
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? `${id}-note-error` : undefined}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setNoteError('')
            }}
          />
          <p className={`review__count${note.length > MAX_GRADE_NOTE ? ' is-over' : ''}`}>
            {note.length} / {MAX_GRADE_NOTE}
          </p>
          {noteError && (
            <p className="field__error" id={`${id}-note-error`} role="alert">
              {noteError}
            </p>
          )}
          {grade && (
            <p className="list__meta">Last saved {formatDateTime(grade.assessedAt)}. Saving again replaces it.</p>
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

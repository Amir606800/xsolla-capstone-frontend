import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { FormQuestion, LectureAnswers, PendingLecture } from '../../types/lectureFeedback'
import { formatClockTime, formatDateTime } from '../../utils/date'
import { validateAnswers } from '../../utils/lectureFeedback'
import { Modal } from '../Modal'
import { Scale } from '../review/Scale'
import '../authoring/authoring.css'
import '../review/review.css'
import './lectureFeedback.css'

interface Props {
  lecture: PendingLecture | null
  form: FormQuestion[]
  onSend: (lecture: PendingLecture, answers: LectureAnswers) => Promise<void>
  onClose: () => void
}

/**
 * The lecture feedback form, drawn from the server's question list: a 1-5 scale, a choice (the pace) or free text.
 * Every required question must be answered before it is sent; the text answers are optional.
 */
export function LectureFeedbackModal({ lecture, form, onSend, onClose }: Props) {
  return (
    <Modal open={lecture !== null} onClose={onClose} title="Rate this lecture" size="lg" initialFocus=".lecture-form input">
      {lecture && <FeedbackForm key={lecture.eventId} lecture={lecture} form={form} onSend={onSend} onClose={onClose} />}
    </Modal>
  )
}

function FeedbackForm({ lecture, form, onSend, onClose }: Props & { lecture: PendingLecture }) {
  const id = useId()
  const [answers, setAnswers] = useState<LectureAnswers>({})
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const errors = validateAnswers(form, answers)
  const show = (qid: string) => (touched ? errors[qid] : undefined)
  const set = (qid: string, value: number | string) => setAnswers((a) => ({ ...a, [qid]: value }))
  const text = (qid: string) => (answers[qid] as string | undefined) ?? ''

  async function send(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length > 0 || busy) return
    setBusy(true)
    setFailed('')
    try {
      await onSend(lecture, answers)
      onClose()
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'Could not send the feedback. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="lecture-form" onSubmit={send} noValidate aria-label={`Feedback on ${lecture.title}`}>
      <div className="lecture-form__lecture">
        <strong>{lecture.title}</strong>
        <span className="list__meta">
          {formatDateTime(lecture.startsAt)}–{formatClockTime(lecture.endsAt)}
          {lecture.moduleTitle ? ` · ${lecture.moduleTitle}` : ''}
        </span>
      </div>
      <p className="mentor-review__hint">Your answers go to the school team, not to the lecturer.</p>

      {form.map((q) => (
        <div key={q.id} className="lecture-form__q">
          {q.type === 'scale' && (
            <fieldset className="mentor-review__q">
              <legend>{q.label}</legend>
              <Scale
                name={`${id}-${q.id}`}
                value={answers[q.id] as number | undefined}
                onChange={(s) => set(q.id, s)}
                low={q.minLabel ?? '1'}
                high={q.maxLabel ?? '5'}
              />
              {show(q.id) && <p className="field__error">{show(q.id)}</p>}
            </fieldset>
          )}

          {q.type === 'choice' && (
            <fieldset className="mentor-review__q">
              <legend>{q.label}</legend>
              <div className="mentor-review__options mentor-review__options--row">
                {q.options.map((o) => (
                  <label key={o.value} className="mentor-review__option">
                    <input
                      type="radio"
                      name={`${id}-${q.id}`}
                      checked={answers[q.id] === o.value}
                      onChange={() => set(q.id, o.value)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
              {show(q.id) && <p className="field__error">{show(q.id)}</p>}
            </fieldset>
          )}

          {q.type === 'text' && (
            <div className="mentor-review__q">
              <label className="mentor-review__label" htmlFor={`${id}-${q.id}`}>
                {q.label} {!q.required && <span className="form__optional">(optional)</span>}
              </label>
              <textarea
                id={`${id}-${q.id}`}
                className="field__input form__textarea"
                rows={3}
                value={text(q.id)}
                onChange={(e) => set(q.id, e.target.value)}
              />
              <p className="mentor-review__count">
                {text(q.id).length} / {q.maxLength}
              </p>
              {show(q.id) && <p className="field__error">{show(q.id)}</p>}
            </div>
          )}
        </div>
      ))}

      {failed && (
        <p className="field__error" role="alert">
          {failed}
        </p>
      )}
      <div className="mentor-review__actions">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Sending…' : 'Send feedback'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
        {touched && Object.keys(errors).length > 0 && <span className="field__error">Some answers are missing.</span>}
      </div>
    </form>
  )
}

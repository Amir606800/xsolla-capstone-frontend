import { useState } from 'react'
import { useLectureFeedback } from '../../hooks/useLectureFeedback'
import type { CourseModule } from '../../types/course'
import type { PendingLecture } from '../../types/lectureFeedback'
import { formatClockTime, formatDateTime, formatShortDate } from '../../utils/date'
import { lecturesOfModule } from '../../utils/lectureFeedback'
import { Icon } from '../Icon'
import { LectureFeedbackModal } from './LectureFeedbackModal'
import './lectureFeedback.css'

/**
 * "Rate your lecture", the first card of the module page's right-hand column (before Resources and Quizzes): the lectures of this week whose feedback form is open
 * (from 10 minutes before the lecture ends until 7 days after), each with a button that opens the form. A lecture that
 * was just rated says so. Nothing is shown when there is nothing to rate.
 */
export function LectureFeedback({ module }: { module: Pick<CourseModule, 'id' | 'opensAt' | 'closesAt'> }) {
  const { open, sent, form, send } = useLectureFeedback()
  const [rating, setRating] = useState<PendingLecture | null>(null)
  const toRate = lecturesOfModule(open, module)
  const thanked = lecturesOfModule(sent, module)
  if (toRate.length === 0 && thanked.length === 0) return null

  return (
    <section className="lecture-feedback" aria-label="Lecture feedback">
      <header className="lecture-feedback__head">
        <span className="lecture-feedback__icon">
          <Icon name="lecturer" size={18} />
        </span>
        <div>
          <h3>Rate your lecture</h3>
          <p>Tell us how it went. It takes a minute and goes to the school team, not to the lecturer.</p>
        </div>
      </header>
      <ul className="lecture-feedback__list">
        {toRate.map((l) => (
          <li key={l.eventId} className="lecture-feedback__row">
            <span className="lecture-feedback__what">
              <span className="list__title">{l.title}</span>
              <span className="list__meta">
                {formatDateTime(l.startsAt)}–{formatClockTime(l.endsAt)} · open until {formatShortDate(l.closesAt)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => setRating(l)}
              aria-label={`Rate the lecture ${l.title}`}
            >
              Rate this lecture
            </button>
          </li>
        ))}
        {thanked.map((l) => (
          <li key={l.eventId} className="lecture-feedback__row lecture-feedback__row--done" role="status">
            <Icon name="check" size={16} />
            <span>
              Thank you, your feedback on <strong>{l.title}</strong> ({formatShortDate(l.startsAt)}) is sent.
            </span>
          </li>
        ))}
      </ul>
      <LectureFeedbackModal lecture={rating} form={form} onSend={send} onClose={() => setRating(null)} />
    </section>
  )
}

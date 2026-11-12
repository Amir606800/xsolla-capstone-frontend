import { useId, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../components/Icon'
import { Loading } from '../components/loading/Loading'
import { Avatar } from '../components/team/People'
import { XsollaLogo } from '../components/XsollaLogo'
import { useAuth } from '../hooks/useAuth'
import { useMentorReview } from '../hooks/useMentorReview'
import { NO_SESSION_REASONS, REVIEW_STATEMENTS, REVIEW_TOPICS } from '../types/mentorReview'
import type { ReviewStatement, Score } from '../types/mentorReview'
import { formatShortDate } from '../utils/date'
import {
  draftToReview,
  emptyDraft,
  MAX_COMMENT,
  MAX_OTHER_TOPIC,
  NO_SESSION_LABEL,
  SCORES,
  STATEMENT_LABEL,
  TOPIC_LABEL,
  validateReview,
} from '../utils/mentorReview'
import type { ReviewDraft } from '../utils/mentorReview'
import '../styles/ui.css'
import '../components/module/module.css'
import './TeamPage.css'
import '../components/authoring/authoring.css'
import '../components/review/review.css'

/** One 1-5 choice. `name` groups the radios; the legend or label around it says what is rated. */
function Scale({ name, value, onChange, low, high }: { name: string; value: Score | null | undefined; onChange: (s: Score) => void; low: string; high: string }) {
  return (
    <>
      <div className="mentor-review__scale">
        {SCORES.map((s) => (
          <label key={s} className="mentor-review__score">
            <input type="radio" name={name} value={s} checked={value === s} onChange={() => onChange(s)} aria-label={`${s}${s === 1 ? ` - ${low}` : s === 5 ? ` - ${high}` : ''}`} />
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

/**
 * STUDENT: the weekly review of their mentor. Mandatory: once the week is over, every other page sends the student
 * here until it is sent (see ReviewGate). The mentor is the one of the student's team, so it is not asked.
 */
export default function MentorReviewPage() {
  const { status, due, mentor, submit, reload } = useMentorReview()
  const { signOut } = useAuth()
  const id = useId()
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const [sent, setSent] = useState(false)
  // locked: the form takes the whole screen (no menu to wander off into); it stays that way for the thank-you line
  const [wasLocked, setWasLocked] = useState(false)
  if (due?.locked && !wasLocked) setWasLocked(true)
  const full = !!due?.locked || (sent && wasLocked)

  const set = (patch: Partial<ReviewDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const errors = validateReview(draft)
  const show = (key: keyof typeof errors) => (touched ? errors[key] : undefined)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!due || Object.keys(errors).length > 0 || busy) return
    setBusy(true)
    setFailed('')
    try {
      await submit(draftToReview(draft, due.module.id))
      setSent(true)
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'Could not send the review. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const page = (
    <section className="module mentor-review">
      <div>
        <h1 className="page-title">Mentor review</h1>
        <p className="page-subtitle">Every week, tell us how your work with your mentor went</p>
      </div>

      {status === 'loading' && <Loading className="module__state">Loading…</Loading>}

      {status === 'error' && (
        <div className="module__state" role="alert">
          <p>We couldn&apos;t check your reviews.</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && sent && (
        <div className="card mentor-review__done" role="status">
          <p>
            <strong>Thank you, your review is sent.</strong> The LMS is open again.
          </p>
          <Link className="btn" to="/dashboard">
            Go to the dashboard
          </Link>
        </div>
      )}

      {status === 'ready' && !sent && !due && (
        <div className="card mentor-review__done">
          <p>There is no review to send right now. The next one opens on the weekend of the running week.</p>
          <Link className="btn btn--ghost" to="/dashboard">
            Back to the dashboard
          </Link>
        </div>
      )}

      {status === 'ready' && !sent && due && (
        <>
          {due.locked && (
            <p className="mentor-review__lock" role="alert">
              <Icon name="lock" size={18} />
              <span>
                Week {due.module.position} is over and its review is missing. The LMS is locked until you send it; it takes about two minutes.
              </span>
            </p>
          )}

          <form className="card" onSubmit={send} noValidate aria-label={`Review of week ${due.module.position}`}>
            <div className="mentor-review__who">
              <Avatar name={mentor?.name ?? '?'} mentor />
              <p>
                <strong>{mentor?.name}</strong>
                <br />
                <span className="list__meta">
                  Week {due.module.position} · {due.module.title}
                  {due.module.opensAt && due.module.closesAt ? ` · ${formatShortDate(due.module.opensAt)} - ${formatShortDate(due.module.closesAt)}` : ''}
                </span>
              </p>
            </div>

            <div className="mentor-review__form">
              <p className="form__note">
                <Icon name="eye" size={16} />
                <span>Be honest: your answers go to the school team, not to your mentor.</span>
              </p>

              <fieldset className="mentor-review__q">
                <legend>Did you have your 1:1 session with {mentor?.name ?? 'your mentor'} this week?</legend>
                <div className="mentor-review__options mentor-review__options--row">
                  {[true, false].map((v) => (
                    <label key={String(v)} className="mentor-review__option">
                      <input type="radio" name={`${id}-session`} checked={draft.hadSession === v} onChange={() => set({ hadSession: v })} />
                      {v ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
                {show('hadSession') && <p className="field__error">{show('hadSession')}</p>}
              </fieldset>

              {draft.hadSession === false && (
                <fieldset className="mentor-review__q">
                  <legend>Why was there no session?</legend>
                  <div className="mentor-review__options">
                    {NO_SESSION_REASONS.map((r) => (
                      <label key={r} className="mentor-review__option">
                        <input type="radio" name={`${id}-reason`} checked={draft.noSessionReason === r} onChange={() => set({ noSessionReason: r })} />
                        {NO_SESSION_LABEL[r]}
                      </label>
                    ))}
                  </div>
                  {show('noSessionReason') && <p className="field__error">{show('noSessionReason')}</p>}
                </fieldset>
              )}

              {draft.hadSession === true && (
                <>
                  <fieldset className="mentor-review__q">
                    <legend>What did you discuss in the session?</legend>
                    <p className="mentor-review__hint">Choose everything that applies.</p>
                    <div className="mentor-review__options">
                      {REVIEW_TOPICS.map((t) => (
                        <label key={t} className="mentor-review__option">
                          <input
                            type="checkbox"
                            checked={draft.topics.includes(t)}
                            onChange={(e) => set({ topics: e.target.checked ? [...draft.topics, t] : draft.topics.filter((x) => x !== t) })}
                          />
                          {TOPIC_LABEL[t]}
                        </label>
                      ))}
                    </div>
                    {draft.topics.includes('other') && (
                      <input
                        className="field__input form__input mentor-review__other"
                        aria-label="The other topic"
                        placeholder="What was it?"
                        maxLength={MAX_OTHER_TOPIC}
                        value={draft.otherTopic}
                        onChange={(e) => set({ otherTopic: e.target.value })}
                      />
                    )}
                    {(show('topics') || show('otherTopic')) && <p className="field__error">{show('topics') ?? show('otherTopic')}</p>}
                  </fieldset>

                  <div className="mentor-review__q" role="group" aria-labelledby={`${id}-statements`}>
                    <p id={`${id}-statements`} className="mentor-review__label">
                      How clear and useful was your work with your mentor?
                    </p>
                    <p className="mentor-review__hint">1 = strongly disagree, 5 = strongly agree</p>
                    <div className="mentor-review__statements">
                      {REVIEW_STATEMENTS.map((s: ReviewStatement) => (
                        <fieldset key={s} className="mentor-review__statement">
                          <legend>{STATEMENT_LABEL[s]}</legend>
                          <Scale
                            name={`${id}-${s}`}
                            value={draft.ratings[s]}
                            onChange={(score) => set({ ratings: { ...draft.ratings, [s]: score } })}
                            low="Strongly disagree"
                            high="Strongly agree"
                          />
                        </fieldset>
                      ))}
                    </div>
                    {show('ratings') && <p className="field__error">{show('ratings')}</p>}
                  </div>
                </>
              )}

              <fieldset className="mentor-review__q">
                <legend>Overall, how satisfied are you with your mentor&apos;s support this week?</legend>
                <Scale name={`${id}-overall`} value={draft.overall} onChange={(overall) => set({ overall })} low="Not at all" high="Very satisfied" />
                {show('overall') && <p className="field__error">{show('overall')}</p>}
              </fieldset>

              <div className="mentor-review__q">
                <label className="mentor-review__label" htmlFor={`${id}-comment`}>
                  Any comments or suggestions? <span className="form__optional">(optional)</span>
                </label>
                <p className="mentor-review__hint">What was unclear, or what would help you in your mentor sessions.</p>
                <textarea
                  id={`${id}-comment`}
                  className="field__input form__textarea"
                  rows={4}
                  value={draft.comment}
                  onChange={(e) => set({ comment: e.target.value })}
                />
                <p className="mentor-review__count">
                  {draft.comment.length} / {MAX_COMMENT}
                </p>
                {errors.comment && <p className="field__error">{errors.comment}</p>}
              </div>

              {failed && (
                <p className="field__error" role="alert">
                  {failed}
                </p>
              )}
              <div className="mentor-review__actions">
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? 'Sending…' : 'Send review'}
                </button>
                {touched && Object.keys(errors).length > 0 && <span className="field__error">Some answers are missing.</span>}
              </div>
            </div>
          </form>
        </>
      )}
    </section>
  )

  if (!full) return page
  return (
    <div className="review-lock">
      <header className="review-lock__bar">
        <XsollaLogo className="review-lock__logo" />
        <button type="button" className="btn btn--ghost btn--small" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      {page}
    </div>
  )
}

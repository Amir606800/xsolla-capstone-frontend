import { useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { sendReport } from '../../api/reports'
import { useAuth } from '../../hooks/useAuth'
import { useMyTeam } from '../../hooks/useMyTeam'
import { EMPTY_REPORT, MAX_MESSAGE, MAX_TITLE, MAX_WHO, REPORT_ABOUT, reportMessage, reportSubject, validateReport } from '../../utils/report'
import type { ReportDraft } from '../../utils/report'
import { Icon } from '../Icon'
import { Modal } from '../Modal'
import './report.css'

/**
 * Report a problem to the school's admins: what it is about (the school, a mentor, a lecturer, a student, or something
 * else), who or what if it helps, a short title and what happened. Only the admins read reports, and the sender's name
 * goes with it.
 */
export function ReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Report a problem" initialFocus="input[type=radio]">
      {/* a fresh form every time it opens */}
      {open && <ReportForm onClose={onClose} />}
    </Modal>
  )
}

function ReportForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { team } = useMyTeam()
  const id = useId()
  const [d, setD] = useState<ReportDraft>(EMPTY_REPORT)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const [sent, setSent] = useState(false)
  const errors = validateReport(d)
  const shown = touched ? errors : {}
  const set = (patch: Partial<ReportDraft>) => setD((prev) => ({ ...prev, ...patch }))

  // names worth suggesting: the people of the reporter's team
  const people = useMemo(() => {
    const names = [team?.mentor?.name, ...(team?.members ?? []).map((m) => m.name)].filter((n): n is string => !!n && n !== user?.name)
    return [...new Set(names)]
  }, [team, user?.name])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setFailed('')
    if (Object.values(errors).some(Boolean) || busy) return
    setBusy(true)
    try {
      await sendReport(reportSubject(d), reportMessage(d), user ? { id: user.id, name: user.name } : undefined)
      setSent(true)
    } catch (err) {
      setFailed(err instanceof Error && err.message ? err.message : 'The report could not be sent. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="report report--sent" role="status">
        <span className="report__sent-icon" aria-hidden="true">
          <Icon name="check" size={22} />
        </span>
        <p className="report__sent-title">Report sent</p>
        <p className="report__lead">Thank you. The school&apos;s admins read every report and will follow up.</p>
        <div className="report__actions">
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    )
  }

  const about = REPORT_ABOUT.find((a) => a.key === d.about)
  const person = d.about === 'mentor' || d.about === 'lecturer' || d.about === 'student'

  return (
    <form className="report" onSubmit={submit} noValidate>
      <p className="report__lead">
        Something wrong with the school, a mentor, a lecturer, a student, or anything else? Tell the admins. Only they read reports,
        and your name is sent with it.
      </p>

      <fieldset className="report__about" aria-describedby={shown.about ? `${id}-about-error` : undefined}>
        <legend className="field__label">What is it about?</legend>
        <div className="report__choices">
          {REPORT_ABOUT.map((a) => (
            <label key={a.key} className={`report__choice${d.about === a.key ? ' is-picked' : ''}`}>
              <input type="radio" name={`${id}-about`} value={a.key} checked={d.about === a.key} onChange={() => set({ about: a.key })} />
              <Icon name={a.icon} size={20} />
              <span className="report__choice-text">
                <span className="report__choice-label">{a.label}</span>
                <span className="report__choice-hint">{a.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {shown.about && (
          <p className="field__error" id={`${id}-about-error`} role="alert">
            {shown.about}
          </p>
        )}
      </fieldset>

      {about && (
        <div className="report__field">
          <label className="field__label" htmlFor={`${id}-who`}>
            {person ? 'Who' : 'Who or what'} <span className="report__optional">(optional)</span>
          </label>
          <input
            id={`${id}-who`}
            className="field__input"
            value={d.who}
            maxLength={MAX_WHO + 20}
            list={people.length ? `${id}-people` : undefined}
            placeholder={person ? 'A name' : 'A name, a lecture, a place'}
            aria-invalid={shown.who ? true : undefined}
            onChange={(e) => set({ who: e.target.value })}
          />
          {people.length > 0 && (
            <datalist id={`${id}-people`}>
              {people.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          )}
          {shown.who && <span className="field__error">{shown.who}</span>}
        </div>
      )}

      <div className="report__field">
        <label className="field__label" htmlFor={`${id}-title`}>
          Title
        </label>
        <input
          id={`${id}-title`}
          className="field__input"
          value={d.title}
          maxLength={MAX_TITLE + 20}
          placeholder="In a few words"
          aria-invalid={shown.title ? true : undefined}
          onChange={(e) => set({ title: e.target.value })}
        />
        {shown.title && <span className="field__error">{shown.title}</span>}
      </div>

      <div className="report__field">
        <label className="field__label" htmlFor={`${id}-message`}>
          What happened?
        </label>
        <textarea
          id={`${id}-message`}
          className="field__input report__message"
          rows={5}
          value={d.message}
          placeholder="What happened, when, and anything the admins should know"
          aria-invalid={shown.message ? true : undefined}
          onChange={(e) => set({ message: e.target.value })}
        />
        <span className={`report__count${d.message.trim().length > MAX_MESSAGE ? ' is-over' : ''}`}>
          {d.message.trim().length} / {MAX_MESSAGE}
        </span>
        {shown.message && <span className="field__error">{shown.message}</span>}
      </div>

      {failed && (
        <p className="field__error" role="alert">
          {failed}
        </p>
      )}

      <div className="report__actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn report__send" disabled={busy}>
          <Icon name="flag" size={18} />
          {busy ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </form>
  )
}

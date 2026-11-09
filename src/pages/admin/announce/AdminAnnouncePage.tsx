import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchBroadcasts, sendBroadcast } from '../../../api/notifications'
import { Icon } from '../../../components/Icon'
import { useAuth } from '../../../hooks/useAuth'
import { useDirectory } from '../../../hooks/useDirectory'
import { useSort } from '../../../hooks/useSort'
import type { Broadcast } from '../../../mocks/broadcasts'
import { AUDIENCE_LABEL, AUDIENCES, audienceCounts, LINK_CHOICES, MAX_MESSAGE, people } from '../../../utils/adminNotifications'
import type { Audience } from '../../../utils/adminNotifications'
import { formatDateTime } from '../../../utils/date'
import { ConfirmDialog } from '../ConfirmDialog'
import { SortableTh } from '../SortableTh'
import { Loading } from '../../../components/loading/Loading'

/**
 * Admin: announcements everyone sees in their notification bell. Write the message, pick who it is for
 * (everyone, or only students, mentors or lecturers), check how many people it reaches, send. Below is
 * what was sent before. A sent announcement cannot be taken back, so sending asks first.
 */
export default function AdminAnnouncePage() {
  const { user } = useAuth()
  const { status: peopleStatus, users } = useDirectory()
  const id = useId()
  const [history, setHistory] = useState<Broadcast[] | null>(null)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [link, setLink] = useState('')
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState('')

  useEffect(() => {
    let alive = true
    fetchBroadcasts()
      .then((rows) => alive && setHistory(rows))
      .catch(() => alive && (setHistoryFailed(true), setHistory([])))
    return () => {
      alive = false
    }
  }, [])

  // how many people each choice reaches; unknown while the people list is not available
  const counts = peopleStatus === 'ready' ? audienceCounts(users) : null
  const text = message.trim()
  const error = !text ? 'Write the announcement.' : text.length > MAX_MESSAGE ? `At most ${MAX_MESSAGE} characters.` : ''
  const reach = counts?.[audience]

  const {
    sorted: sent,
    sort,
    toggle,
  } = useSort(
    history ?? [],
    {
      sentAt: (b) => b.sentAt,
      audience: (b) => AUDIENCE_LABEL[b.audience],
      recipients: (b) => b.recipients,
      message: (b) => b.message,
    },
    { key: 'sentAt', dir: 'desc' },
  )

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!error) setConfirming(true)
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <h1 className="page-title">Announce</h1>
        <p className="page-subtitle">Send a message that appears in everyone’s notification bell.</p>
      </header>

      <p className="admin-status" role="status">
        {done}
      </p>

      <form className="admin-panel admin-compose" onSubmit={submit} noValidate aria-label="New announcement">
        <h2 className="admin-section-title">New announcement</h2>

        <div className="admin-field">
          <label className="admin-field__label" htmlFor={`${id}-message`}>
            Message
          </label>
          <textarea
            id={`${id}-message`}
            className="admin-field__input admin-compose__text"
            rows={4}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setDone('')
            }}
            aria-invalid={touched && !!error}
            aria-describedby={`${id}-count`}
          />
          <span id={`${id}-count`} className={`admin-hint${text.length > MAX_MESSAGE ? ' admin-hint--warn' : ''}`}>
            {text.length} / {MAX_MESSAGE}
          </span>
          {touched && error && <span className="admin-field__error">{error}</span>}
        </div>

        <fieldset className="admin-roles admin-compose__who">
          <legend className="admin-field__label">Send to</legend>
          <div className="admin-audience">
            {AUDIENCES.map((a) => (
              <label key={a} className="admin-check">
                <input type="radio" name={`${id}-audience`} checked={audience === a} onChange={() => setAudience(a)} />
                <span>
                  {AUDIENCE_LABEL[a]}
                  {counts && <span className="admin-hint">{people(counts[a])}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="admin-field">
          <label className="admin-field__label" htmlFor={`${id}-link`}>
            Opens (optional)
          </label>
          <select id={`${id}-link`} className="admin-field__input" value={link} onChange={(e) => setLink(e.target.value)}>
            {LINK_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="admin-hint">The page the notification takes people to when they click it.</span>
        </div>

        <div className="admin-confirm__actions">
          <button type="submit" className="admin-btn admin-btn--primary">
            <Icon name="bell" size={16} /> Send announcement
          </button>
        </div>
      </form>

      <section aria-labelledby={`${id}-history`} className="admin-page">
        <h2 id={`${id}-history`} className="admin-section-title">
          Sent so far
        </h2>
        {history === null && (
          <Loading className="admin-muted">Loading…</Loading>
        )}
        {historyFailed && (
          <p className="admin-muted" role="note">
            The list of sent announcements could not be loaded.
          </p>
        )}
        {history !== null && !historyFailed && sent.length === 0 && <p className="admin-empty">Nothing has been sent yet.</p>}
        {sent.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">Sent announcements</caption>
              <thead>
                <tr>
                  <SortableTh label="Sent" sortKey="sentAt" sort={sort} onSort={toggle} />
                  <SortableTh label="To" sortKey="audience" sort={sort} onSort={toggle} />
                  <SortableTh label="Reached" sortKey="recipients" sort={sort} onSort={toggle} />
                  <SortableTh label="Message" sortKey="message" sort={sort} onSort={toggle} />
                </tr>
              </thead>
              <tbody>
                {sent.map((b) => (
                  <tr key={b.id}>
                    <td className="admin-table__muted admin-nowrap">{formatDateTime(b.sentAt)}</td>
                    <td>{AUDIENCE_LABEL[b.audience]}</td>
                    <td className="admin-table__muted">{people(b.recipients)}</td>
                    <td className="admin-pre">{b.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirming}
        title="Send this announcement?"
        confirmLabel="Send"
        busyLabel="Sending…"
        tone="primary"
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          const row = await sendBroadcast({ message: text, link, audience }, user?.name ?? 'Admin')
          setHistory((prev) => [row, ...(prev ?? [])])
          setHistoryFailed(false)
          setConfirming(false)
          setMessage('')
          setLink('')
          setTouched(false)
          setDone(`Sent to ${people(row.recipients)} (${AUDIENCE_LABEL[row.audience].toLowerCase()}).`)
        }}
      >
        <p className="admin-pre">“{text}”</p>
        <p className="admin-muted">
          {reach !== undefined ? `It goes to ${people(reach)}` : `It goes to ${AUDIENCE_LABEL[audience].toLowerCase()}`} and
          cannot be taken back.
        </p>
      </ConfirmDialog>
    </section>
  )
}

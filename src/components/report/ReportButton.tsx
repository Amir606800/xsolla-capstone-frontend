import { useState } from 'react'
import { Icon } from '../Icon'
import { ReportDialog } from './ReportDialog'
import './report.css'

/** The red flag in the header: report a problem to the admins from any page, without leaving it. */
export function ReportButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="header__icon-btn report-btn"
        aria-label="Report a problem"
        title="Report a problem"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon name="flag" />
      </button>
      <ReportDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** The same, as a card on the Profile page. */
export function ReportCard() {
  const [open, setOpen] = useState(false)
  return (
    <section className="pw-card report-card" aria-labelledby="report-card-title">
      <header className="pw-card__head">
        <span className="pw-card__icon report-card__icon" aria-hidden="true">
          <Icon name="flag" size={22} />
        </span>
        <div>
          <h2 id="report-card-title" className="pw-card__title">
            Report a problem
          </h2>
          <p className="pw-card__lead">
            Something wrong with the school, a mentor, a lecturer or a student? Tell the admins: only they read reports.
          </p>
        </div>
      </header>
      <div className="report-card__actions">
        <button type="button" className="btn report__send" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Icon name="flag" size={18} />
          Report a problem
        </button>
      </div>
      <ReportDialog open={open} onClose={() => setOpen(false)} />
    </section>
  )
}

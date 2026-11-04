import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useCourses } from '../../hooks/useCourses'
import { useNotifications } from '../../hooks/useNotifications'
import { usePersistedState } from '../../hooks/usePersistedState'
import type { AppNotification, NotificationType } from '../../types/notification'
import { formatRelative } from '../../utils/date'
import { describeRoute } from '../../utils/routes'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'
import { Modal } from '../Modal'
import '../../styles/ui.css'
import './notifications.css'

const TYPE_ICON: Record<NotificationType, IconName> = {
  task: 'tasks',
  deadline: 'clock',
  graded: 'award',
  material: 'file',
  meeting: 'calendar',
  event: 'calendar',
  submission: 'upload',
}

type Filter = 'all' | 'unread'
type ConfirmMode = 'ask' | 'skip'
const CONFIRM_MODES = ['ask', 'skip'] as const

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { status, notifications, unreadCount, reload, markRead, markAllRead } = useNotifications()
  const { modules } = useCourses()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [filter, setFilter] = useState<Filter>('all')
  const [failed, setFailed] = useState(false)
  // fixed while the panel is open, so the relative times don't jump around
  const [now] = useState(() => new Date())

  // "Ask before opening a notification" - remembered, so people who don't want the extra step can turn it off
  const [confirmMode, setConfirmMode] = usePersistedState<ConfirmMode>('notif_confirm', 'ask', CONFIRM_MODES)
  const [pending, setPending] = useState<AppNotification | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  const shown = filter === 'unread' ? notifications.filter((n) => !n.readAt) : notifications

  async function handleMarkAll() {
    setFailed(false)
    try {
      await markAllRead()
    } catch {
      setFailed(true)
    }
  }

  function open(n: AppNotification) {
    markRead(n.id).catch(() => {}) // the UI already updated optimistically
    onClose()
  }

  function handleClick(e: MouseEvent, n: AppNotification) {
    // Already on that page (or asking is switched off): just go.
    if (n.link === pathname || confirmMode === 'skip') {
      open(n)
      return // the <Link> navigates by itself
    }
    // Otherwise stop the navigation and ask first: leaving can lose unsaved work on this page.
    e.preventDefault()
    setDontAskAgain(false)
    setPending(n)
  }

  function confirmOpen() {
    if (!pending) return
    if (dontAskAgain) setConfirmMode('skip')
    const target = pending
    open(target)
    navigate(target.link)
  }

  if (status === 'loading') {
    return (
      <p className="card__empty" role="status">
        Loading notifications…
      </p>
    )
  }

  if (status === 'error') {
    return (
      <div className="card__empty" role="alert">
        <p>We couldn&apos;t load your notifications.</p>
        <button type="button" className="btn" onClick={reload}>
          Try again
        </button>
      </div>
    )
  }

  if (pending) {
    return (
      <section className="notif__confirm" aria-labelledby="notif-confirm-title">
        <h3 id="notif-confirm-title">Open this notification?</h3>
        <p className="notif__confirm-quote">&ldquo;{pending.message}&rdquo;</p>
        <p>
          You&apos;ll go to <strong>{describeRoute(pending.link, modules)}</strong>. If you&apos;re in the middle of
          something on this page, such as a submission you&apos;re typing, it won&apos;t be saved.
        </p>

        <label className="check">
          <input type="checkbox" checked={dontAskAgain} onChange={(e) => setDontAskAgain(e.target.checked)} />
          Don&apos;t ask me again
        </label>

        <div className="notif__confirm-actions">
          {/* the safe choice has the initial focus */}
          <button type="button" className="btn btn--ghost" onClick={() => setPending(null)} autoFocus>
            Stay here
          </button>
          <button type="button" className="btn" onClick={confirmOpen}>
            Open page
          </button>
        </div>
      </section>
    )
  }

  return (
    <>
      <div className="notif__toolbar">
        <div className="view-toggle" role="group" aria-label="Show">
          <button
            type="button"
            className={`view-toggle__btn${filter === 'all' ? ' is-active' : ''}`}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`view-toggle__btn${filter === 'unread' ? ' is-active' : ''}`}
            aria-pressed={filter === 'unread'}
            onClick={() => setFilter('unread')}
          >
            Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
        </div>

        <button type="button" className="btn btn--ghost" onClick={handleMarkAll} disabled={unreadCount === 0}>
          <Icon name="check" size={16} /> Mark all as read
        </button>
      </div>

      {failed && (
        <p className="field__error notif__error" role="alert">
          Couldn&apos;t update your notifications. Please try again.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="card__empty">
          {filter === 'unread' ? 'No unread notifications.' : "You're all caught up. Nothing new."}
        </p>
      ) : (
        <ul className="notif__list" aria-label="Notifications">
          {shown.map((n) => (
            <li key={n.id}>
              <Link to={n.link} className={`notif${n.readAt ? '' : ' is-unread'}`} onClick={(e) => handleClick(e, n)}>
                <span className="notif__icon">
                  <Icon name={TYPE_ICON[n.type]} size={18} />
                </span>
                <span className="notif__text">
                  <span className="notif__message">{n.message}</span>
                  <span className="notif__time">{formatRelative(n.createdAt, now)}</span>
                </span>
                {!n.readAt && (
                  <>
                    <span className="notif__dot" aria-hidden="true" />
                    <span className="sr-only">Unread</span>
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="notif__footer">
        <label className="check">
          <input
            type="checkbox"
            checked={confirmMode === 'ask'}
            onChange={(e) => setConfirmMode(e.target.checked ? 'ask' : 'skip')}
          />
          Ask before opening a notification
        </label>
      </div>
    </>
  )
}

export function NotificationsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Notifications">
      <NotificationsPanel onClose={onClose} />
    </Modal>
  )
}

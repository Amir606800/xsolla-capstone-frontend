import { useState } from 'react'
import { Link } from 'react-router'
import { useNotifications } from '../../hooks/useNotifications'
import type { NotificationType } from '../../types/notification'
import { formatRelative } from '../../utils/date'
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

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { status, notifications, unreadCount, reload, markRead, markAllRead } = useNotifications()
  const [filter, setFilter] = useState<Filter>('all')
  const [failed, setFailed] = useState(false)
  // fixed while the panel is open, so the relative times don't jump around
  const [now] = useState(() => new Date())

  const shown = filter === 'unread' ? notifications.filter((n) => !n.readAt) : notifications

  async function handleMarkAll() {
    setFailed(false)
    try {
      await markAllRead()
    } catch {
      setFailed(true)
    }
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
              <Link
                to={n.link}
                className={`notif${n.readAt ? '' : ' is-unread'}`}
                onClick={() => {
                  // fire and forget: the UI already updated optimistically
                  markRead(n.id).catch(() => {})
                  onClose()
                }}
              >
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

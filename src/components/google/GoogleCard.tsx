import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useGoogle } from '../../hooks/useGoogle'
import type { GoogleAccount, GoogleConnection } from '../../types/google'
import { isStudent } from '../../utils/roles'
import { Icon } from '../Icon'
import { Loading } from '../loading/Loading'
import { Spinner } from '../loading/Spinner'
import './google.css'

/** Where a person takes back the access they gave: the server has no "disconnect" route yet. */
export const GOOGLE_PERMISSIONS_URL = 'https://myaccount.google.com/permissions'

const PILL: Record<GoogleConnection, { text: string; tone: 'ok' | 'warn' | 'off' }> = {
  connected: { text: 'Connected', tone: 'ok' },
  disconnected: { text: 'Not connected', tone: 'off' },
  reconnect: { text: 'Reconnect needed', tone: 'warn' },
  unavailable: { text: 'Can’t check right now', tone: 'off' },
  unsupported: { text: 'Not available yet', tone: 'off' },
}

function Avatar({ account }: { account: GoogleAccount }) {
  const [broken, setBroken] = useState(false)
  if (account.picture && !broken) {
    // Google's own picture; sending no referrer keeps the page address private
    return <img className="google-card__avatar" src={account.picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  }
  return (
    <span className="google-card__avatar google-card__avatar--initial" aria-hidden="true">
      {(account.name || account.email).charAt(0).toUpperCase()}
    </span>
  )
}

/**
 * Connect, check and reconnect the Google account behind "Add to my Google Calendar". Shared by the LMS
 * Settings page and the admin one (`variant` picks that section's button style). Google sends the person
 * back here with `?google=connected` or `?google=error`; that is read once, shown, and removed.
 */
export function GoogleCard({ variant = 'lms' }: { variant?: 'lms' | 'admin' }) {
  const { status, loading, connecting, reload, connect } = useGoogle()
  const { user } = useAuth()
  const student = isStudent(user)
  const [params, setParams] = useSearchParams()
  // Google comes back with a full page load, so the answer is there when this mounts
  const [came, setCame] = useState<'connected' | 'error' | null>(() => {
    const back = params.get('google')
    return back === 'connected' || back === 'error' ? back : null
  })
  const [problem, setProblem] = useState('')

  const back = params.get('google')
  useEffect(() => {
    if (back !== 'connected' && back !== 'error') return
    // the answer is only worth showing once; a reload must not repeat it
    setParams(
      (p) => {
        p.delete('google')
        return p
      },
      { replace: true },
    )
    void reload()
  }, [back, setParams, reload])

  const btn = variant === 'admin' ? 'admin-btn' : 'btn'
  const btnPrimary = variant === 'admin' ? 'admin-btn admin-btn--primary' : 'btn'
  const btnQuiet = variant === 'admin' ? 'admin-btn' : 'btn btn--ghost'

  async function start() {
    setProblem('')
    setCame(null)
    try {
      await connect()
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not start the connection.')
    }
  }

  const pill = status ? PILL[status.connection] : undefined
  const connectButton = (label: string, primary = true) => (
    <button type="button" className={primary ? btnPrimary : btnQuiet} onClick={start} disabled={connecting}>
      {connecting ? <Spinner size={16} /> : <Icon name="calendar" size={16} />}
      {connecting ? 'Connecting…' : label}
    </button>
  )

  return (
    <section className={`google-card google-card--${variant}`} aria-labelledby="google-card-title">
      <header className="google-card__head">
        <span className="google-card__icon" aria-hidden="true">
          <Icon name="calendar" size={22} />
        </span>
        <div className="google-card__titles">
          <h2 id="google-card-title" className="google-card__title">
            Google Calendar
          </h2>
          <p className="google-card__lead">
            {student ? 'Connect your Google account to see your own Google Calendar on the school calendar.' : 'Put the lectures and events you add here on your own Google Calendar too.'}
          </p>
        </div>
        {pill && <span className={`google-card__pill google-card__pill--${pill.tone}`}>{pill.text}</span>}
      </header>

      {came === 'connected' && (
        <p className="google-card__note google-card__note--ok" role="status">
          Google Calendar is connected.
        </p>
      )}
      {came === 'error' && (
        <p className="google-card__note google-card__note--bad" role="alert">
          Google could not be connected. Try again. If it keeps failing, ask an admin to add your Google address as a test user of the school’s
          Google app.
        </p>
      )}
      {problem && (
        <p className="google-card__note google-card__note--bad" role="alert">
          {problem}
        </p>
      )}

      {!status && <Loading className="google-card__loading">Checking your Google connection…</Loading>}

      {status?.connection === 'connected' && (
        <>
          {status.account && (
            <div className="google-card__account">
              <Avatar account={status.account} />
              <div>
                <p className="google-card__name">{status.account.name}</p>
                <p className="google-card__email">{status.account.email}</p>
              </div>
            </div>
          )}
          <ul className="google-card__facts">
            {student ? (
              <>
                <li>Your own Google Calendar events now show on the school calendar, only for you. You cannot change them there.</li>
                <li>Connecting sends nothing to Google: the school’s events are not added to your calendar.</li>
              </>
            ) : (
              <>
                <li>Tick “Add to my Google Calendar” when you create an event. It goes on your calendar, not on your students’.</li>
                <li>Changing or deleting that event in the LMS changes or removes your Google copy too.</li>
              </>
            )}
          </ul>
          <div className="google-card__actions">
            {connectButton('Use a different Google account', false)}
            <a className="google-card__link" href={GOOGLE_PERMISSIONS_URL} target="_blank" rel="noopener noreferrer">
              Remove access in your Google account <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </>
      )}

      {status?.connection === 'disconnected' && (
        <>
          <ul className="google-card__facts">
            <li>You choose, event by event, what goes to Google. Nothing is sent without your tick.</li>
            <li>Google may say “This app isn’t verified” while the school tests it: choose Advanced, then continue.</li>
          </ul>
          <div className="google-card__actions">{connectButton('Connect Google Calendar')}</div>
        </>
      )}

      {status?.connection === 'reconnect' && (
        <>
          <p className="google-card__note google-card__note--warn" role="alert">
            {status.account ? `${status.account.email} is` : 'Your Google account is'} no longer connected: the access was removed or has expired.
            Events you add will not reach Google until you connect again.
          </p>
          <div className="google-card__actions">{connectButton('Reconnect Google Calendar')}</div>
        </>
      )}

      {status?.connection === 'unavailable' && (
        <>
          <p className="google-card__note google-card__note--warn" role="alert">
            Google, or the school’s server, could not be reached, so the connection could not be checked.
          </p>
          <div className="google-card__actions">
            <button type="button" className={btn} onClick={() => void reload()} disabled={loading}>
              {loading ? 'Checking…' : 'Try again'}
            </button>
          </div>
        </>
      )}

      {status?.connection === 'unsupported' && <p className="google-card__note">The school’s server does not offer the Google Calendar connection yet.</p>}
    </section>
  )
}

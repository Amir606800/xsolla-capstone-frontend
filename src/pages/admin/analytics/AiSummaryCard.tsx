import { Icon } from '../../../components/Icon'
import { Loading } from '../../../components/loading/Loading'
import type { SummaryState } from '../../../hooks/useAnalytics'
import { formatDateTime } from '../../../utils/date'

/**
 * The AI summary of a person's feedback. The server reads the feedback and writes the text; this card only shows it,
 * says how many records it is based on and when it was written, and lets the admin ask for a fresh one. A failure here
 * never takes the rest of the page down.
 */
export function AiSummaryCard({ state, source, missing }: { state: SummaryState; source: string; missing: string }) {
  const { status, data, problem, error, busy } = state
  const empty = status === 'ready' && data?.sourceCount === 0

  return (
    <section className="admin-panel ai-summary" aria-label="AI summary" aria-busy={status === 'loading' || busy}>
      <header className="ai-summary__head">
        <div>
          <h2 className="admin-section-title ai-summary__title">
            <Icon name="sparkle" size={18} /> AI summary
          </h2>
          <p className="admin-muted analytics-note">Written by the AI from {source} in this period.</p>
        </div>
        {status === 'ready' && !empty && (
          <button type="button" className="admin-btn" onClick={state.regenerate} disabled={busy}>
            <Icon name="reset" size={16} /> {busy ? 'Writing…' : 'Regenerate'}
          </button>
        )}
      </header>

      <div aria-live="polite">
        {status === 'loading' && <Loading className="admin-muted">Writing the summary… this can take up to a minute.</Loading>}

        {status === 'ready' && data && (
          <>
            <div className={`ai-summary__text${busy ? ' ai-summary__text--stale' : ''}${empty ? ' admin-muted' : ''}`}>
              {data.summary
                .split(/\n+/)
                .map((p) => p.trim())
                .filter(Boolean)
                .map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
            </div>
            {!empty && (
              <p className="admin-muted ai-summary__meta">
                Based on {data.sourceCount} {data.sourceCount === 1 ? 'record' : 'records'}
                {data.generatedAt && ` · written ${formatDateTime(data.generatedAt)}`}
                {data.cached && ' · saved copy'}
              </p>
            )}
          </>
        )}

        {status === 'problem' && (
          <div className="ai-summary__problem">
            <p>{problem === 'missing' ? missing : error}</p>
            {problem === 'off' && <p className="admin-muted">The rest of the page still works.</p>}
            {problem !== 'missing' && (
              <button type="button" className="admin-btn" onClick={state.retry}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

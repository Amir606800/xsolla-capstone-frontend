import { memo } from 'react'
import type { ResourceItem } from '../../types/course'
import { Icon } from '../Icon'

function ResourceListBase({ resources }: { resources: ResourceItem[] }) {
  return (
    <section className="card" aria-labelledby="resources-title">
      <header className="card__head">
        <span className="card__icon">
          <Icon name="file" size={20} />
        </span>
        <h2 id="resources-title">Resources</h2>
      </header>

      {resources.length === 0 ? (
        <p className="card__empty">No resources yet.</p>
      ) : (
        <ul className="list">
          {resources.map((r) => (
            <li key={r.id} className="list__row resource">
              <span className="resource__icon">
                <Icon name={r.kind === 'link' ? 'link' : 'file'} size={18} />
              </span>
              <div className="resource__text">
                <p className="list__title">{r.title}</p>
                <p className="list__meta">
                  {r.description ? `${r.description} · ` : ''}
                  {r.kind === 'link' ? 'Link' : r.kind.toUpperCase()}
                </p>
              </div>
              {r.kind === 'link' && r.url ? (
                <a
                  className="btn btn--ghost"
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${r.title}`}
                >
                  Open
                </a>
              ) : (
                // Files are fetched via GET /files/:id/download with the auth header - wired up with the backend.
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled
                  title="Downloads are available once the backend is connected"
                  aria-label={`Download ${r.title}`}
                >
                  <Icon name="download" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export const ResourceList = memo(ResourceListBase)

import { memo, useLayoutEffect, useRef, useState } from 'react'
import type { ResourceItem } from '../../types/course'
import { DownloadButton } from '../DownloadButton'
import { Icon } from '../Icon'
import { Modal } from '../Modal'

/** Up to this many rows fit in the card; more start scrolling inside it. */
const FITS = 5

type Filter = 'all' | 'files' | 'links'

/** `compact`: icon buttons for the narrow side card; the pop-up has room for labelled buttons. */
function ResourceRow({ r, compact = false }: { r: ResourceItem; compact?: boolean }) {
  return (
    <li className="list__row resource">
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
          className={compact ? 'icon-btn' : 'btn btn--ghost'}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${r.title}`}
          title="Open in a new tab"
        >
          {compact ? <Icon name="link" size={16} /> : 'Open'}
        </a>
      ) : (
        <DownloadButton
          file={{ id: r.fileId, name: r.file?.name ?? r.title }}
          label={`Download ${r.title}`}
          variant={compact ? 'icon' : 'ghost'}
        />
      )}
    </li>
  )
}

/** True when the element's content is taller than the element (it scrolls). */
function useOverflow<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null)
  // without a layout engine (tests) fall back to the number of rows
  const [overflowing, setOverflowing] = useState(count > FITS)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined' || el.clientHeight === 0) {
      setOverflowing(count > FITS)
      return
    }
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [count])
  return [ref, overflowing] as const
}

/**
 * Module resources: files and links. A long list scrolls inside the card so the Quizzes below stay
 * close, can be narrowed to files or links, and opens in a pop-up (grouped) to see everything at once.
 * The backend has no link between a resource and a task, so grouping is by kind only.
 */
function ResourceListBase({ resources }: { resources: ResourceItem[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [enlarged, setEnlarged] = useState(false)
  const files = resources.filter((r) => r.kind !== 'link')
  const links = resources.filter((r) => r.kind === 'link')
  const shown = filter === 'files' ? files : filter === 'links' ? links : resources
  const [scrollRef, overflowing] = useOverflow<HTMLDivElement>(shown.length)
  // fade the bottom edge only while there is more below
  const [atEnd, setAtEnd] = useState(false)
  const showFilter = files.length > 0 && links.length > 0

  return (
    <section className="card" aria-labelledby="resources-title">
      <header className="card__head">
        <span className="card__icon">
          <Icon name="file" size={20} />
        </span>
        <h2 id="resources-title">Resources</h2>
        {resources.length > 0 && <span className="pill">{resources.length}</span>}
        {overflowing && (
          <button
            type="button"
            className="icon-btn resources__enlarge"
            onClick={() => setEnlarged(true)}
            aria-label="Show all resources"
            title="Show all"
          >
            <Icon name="maximize" size={16} />
          </button>
        )}
      </header>

      {resources.length === 0 ? (
        <p className="card__empty">No resources yet.</p>
      ) : (
        <>
          {showFilter && (
            <div className="resources__filter" role="group" aria-label="Show">
              {(
                [
                  ['all', 'All', resources.length],
                  ['files', 'Files', files.length],
                  ['links', 'Links', links.length],
                ] as const
              ).map(([value, label, n]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value)
                    setAtEnd(false)
                  }}
                >
                  {label} <span>{n}</span>
                </button>
              ))}
            </div>
          )}
          <div
            ref={scrollRef}
            className={`resources__scroll${overflowing && !atEnd ? ' is-overflowing' : ''}`}
            onScroll={(e) => {
              const el = e.currentTarget
              setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 2)
            }}
            // keyboard users can scroll the list too
            tabIndex={overflowing ? 0 : undefined}
          >
            <ul className="list" aria-label="Resources">
              {shown.map((r) => (
                <ResourceRow key={r.id} r={r} compact />
              ))}
            </ul>
          </div>
        </>
      )}

      <Modal open={enlarged} onClose={() => setEnlarged(false)} title={`Resources · ${resources.length}`}>
        <div className="resources__all">
          {files.length > 0 && (
            <section aria-labelledby="resources-files-title">
              <h3 id="resources-files-title" className="resources__group">
                Files <span>{files.length}</span>
              </h3>
              <ul className="list" aria-label="All files">
                {files.map((r) => (
                  <ResourceRow key={r.id} r={r} />
                ))}
              </ul>
            </section>
          )}
          {links.length > 0 && (
            <section aria-labelledby="resources-links-title">
              <h3 id="resources-links-title" className="resources__group">
                Links <span>{links.length}</span>
              </h3>
              <ul className="list" aria-label="All links">
                {links.map((r) => (
                  <ResourceRow key={r.id} r={r} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </Modal>
    </section>
  )
}

export const ResourceList = memo(ResourceListBase)

import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { navFor } from '../../config/nav'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useModuleAccess } from '../../hooks/useModuleAccess'
import { buildSearchItems, filterSearchItems } from '../../utils/search'
import type { SearchItem } from '../../utils/search'
import { Icon } from '../Icon'
import { Modal } from '../Modal'
import './search.css'

function PaletteBody({ onClose }: { onClose: () => void }) {
  const { modules } = useCourses()
  const isLocked = useModuleAccess()
  const role = useAuth().user?.role
  const navigate = useNavigate()
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const all = useMemo(() => buildSearchItems(navFor(role), modules, isLocked), [role, modules, isLocked])
  const results = useMemo(() => filterSearchItems(all, query), [all, query])
  const current = results[Math.min(active, results.length - 1)]

  function go(item: SearchItem) {
    navigate(item.to)
    onClose()
  }

  function move(delta: number) {
    if (results.length === 0) return
    const next = (active + delta + results.length) % results.length
    setActive(next)
    // keep the highlighted row visible while arrowing through a long list
    listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter' && current) {
      e.preventDefault()
      go(current)
    }
  }

  return (
    <div className="palette">
      <div className="palette__field">
        <Icon name="search" size={18} />
        <input
          className="palette__input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={current ? `${listId}-${results.indexOf(current)}` : undefined}
          aria-label="Search courses, tasks and pages"
          placeholder="Search courses, tasks and pages…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {results.length === 0 ? (
        <p className="card__empty" role="status">
          No results for &ldquo;{query.trim()}&rdquo;
        </p>
      ) : (
        <ul className="palette__list" role="listbox" id={listId} aria-label="Results" ref={listRef}>
          {results.map((item, i) => {
            const heading = i === 0 || results[i - 1].group !== item.group ? item.group : null
            return (
              <li key={item.id} role="presentation">
                {heading && <p className="palette__group">{heading}</p>}
                <div
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={item === current}
                  className={`palette__item${item === current ? ' is-active' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item)}
                >
                  <span className="palette__icon">
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span className="palette__label">{item.label}</span>
                  {item.hint && <span className="palette__hint">{item.hint}</span>}
                  {item === current && <Icon name="corner-down-left" size={16} />}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="palette__tips" aria-hidden="true">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> to move
        </span>
        <span>
          <kbd>Enter</kbd> to open
        </span>
        <span>
          <kbd>Esc</kbd> to close
        </span>
      </p>
    </div>
  )
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Search" initialFocus=".palette__input">
      <PaletteBody onClose={onClose} />
    </Modal>
  )
}

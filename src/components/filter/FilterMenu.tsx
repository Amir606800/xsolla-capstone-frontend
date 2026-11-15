import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../Icon'
import './filter.css'

export interface FilterOption {
  value: string
  label: string
}

/** One thing to filter by: a name, the options, and the one chosen now. `all` (the first option) means "no filter". */
export interface FilterGroup {
  id: string
  label: string
  value: string
  options: FilterOption[]
}

/** The value that means "not filtered". */
export const ALL = 'all'

const chosen = (g: FilterGroup) => g.value !== ALL
const nameOf = (g: FilterGroup) => g.options.find((o) => o.value === g.value)?.label ?? g.value

/**
 * A "Filters" button that opens a panel with a list of options for each thing to filter by (week, mentor, ...). A choice
 * applies at once and the panel stays open, so several can be set; Escape, a click outside or "Done" closes it. The
 * button says how many filters are on.
 */
export function FilterMenu({
  groups,
  onChange,
  onClear,
}: {
  groups: FilterGroup[]
  onChange: (id: string, value: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const active = groups.filter(chosen).length

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div className="filter" ref={root}>
      <button
        ref={button}
        type="button"
        className={`admin-btn filter__button${active > 0 ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="filter" size={16} /> Filters
        {active > 0 && (
          <span className="filter__count" aria-label={`${active} on`}>
            {active}
          </span>
        )}
      </button>

      {open && (
        <div id={panelId} className="filter__panel" role="group" aria-label="Filters">
          {groups.map((g) => (
            <fieldset key={g.id} className="filter__group">
              <legend className="filter__legend">{g.label}</legend>
              <div className="filter__options">
                {g.options.map((o) => (
                  <label key={o.value} className={`filter__option${g.value === o.value ? ' is-chosen' : ''}`}>
                    <input
                      type="radio"
                      name={`${panelId}-${g.id}`}
                      checked={g.value === o.value}
                      onChange={() => onChange(g.id, o.value)}
                    />
                    <span className="filter__label">{o.label}</span>
                    <span className="filter__check" aria-hidden="true">
                      <Icon name="check" size={14} />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="filter__foot">
            <button type="button" className="admin-btn admin-btn--small" onClick={onClear} disabled={active === 0}>
              Clear filters
            </button>
            <button type="button" className="admin-btn admin-btn--small admin-btn--primary" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** What is filtered now, one removable chip for each ("Week 5 · React ×"). Nothing when nothing is. */
export function FilterChips({ groups, onChange }: { groups: FilterGroup[]; onChange: (id: string, value: string) => void }) {
  const on = groups.filter(chosen)
  if (on.length === 0) return null
  return (
    <ul className="filter__chips" aria-label="Active filters">
      {on.map((g) => (
        <li key={g.id}>
          <button
            type="button"
            className="filter__chip"
            onClick={() => onChange(g.id, ALL)}
            aria-label={`Remove the ${g.label.toLowerCase()} filter: ${nameOf(g)}`}
          >
            <span>
              <span className="filter__chip-name">{g.label}:</span> {nameOf(g)}
            </span>
            <Icon name="close" size={12} />
          </button>
        </li>
      ))}
    </ul>
  )
}

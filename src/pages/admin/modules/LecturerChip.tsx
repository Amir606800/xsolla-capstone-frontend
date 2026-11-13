import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../../../components/Icon'

/**
 * The lecturers of a week in a table cell, kept short: nobody → a muted note; one → their name; several → a coloured chip
 * with the count that opens a small card above it listing the names. (The table scrolls sideways, so the card is
 * positioned on the screen, not inside the cell.)
 */
export function LecturerChip({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const outside = (e: MouseEvent) => {
      if (!card.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) close()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        button.current?.focus()
      }
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (names.length === 0) return <span className="lecturer-chip lecturer-chip--none">No lecturer</span>
  if (names.length === 1)
    return (
      <span className="lecturer-chip lecturer-chip--1">
        <Icon name="user" size={14} /> {names[0]}
      </span>
    )

  const tone = Math.min(names.length, 3)
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`lecturer-chip lecturer-chip--${tone} lecturer-chip--button`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${names.length} lecturers`}
        onClick={() => {
          const r = button.current?.getBoundingClientRect()
          if (r) setAt({ left: r.left, bottom: window.innerHeight - r.top + 8 })
          setOpen((v) => !v)
        }}
      >
        {Array.from({ length: Math.min(names.length, 3) }, (_, i) => (
          <Icon key={i} name="user" size={14} />
        ))}
        <span className="lecturer-chip__count">{names.length}</span>
      </button>
      {open && at && (
        <div ref={card} id={id} role="dialog" aria-label="Lecturers of this week" className={`lecturer-card lecturer-card--${tone}`} style={{ left: at.left, bottom: at.bottom }}>
          <p className="lecturer-card__title">{names.length} lecturers</p>
          <ul>
            {names.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

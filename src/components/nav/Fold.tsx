import type { ReactNode } from 'react'
import { Icon } from '../Icon'
import './fold.css'

/**
 * A group's heading in a side menu. Plain text while the whole menu fits; a button that folds the group when it does
 * not (`foldable`). `className` is the menu's own heading style, so the two look the same.
 */
export function FoldHeading({
  id,
  label,
  className,
  foldable,
  open,
  onToggle,
  bodyId,
}: {
  id: string
  label: string
  className: string
  foldable: boolean
  open: boolean
  onToggle: () => void
  bodyId: string
}) {
  if (!foldable) {
    return (
      <p id={id} className={className}>
        {label}
      </p>
    )
  }
  return (
    <button type="button" id={id} className={`${className} fold__heading`} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
      <span>{label}</span>
      <span className="fold__chevron">
        <Icon name="chevron" size={12} />
      </span>
    </button>
  )
}

/**
 * What a heading folds. It keeps its natural height inside (`data-fold-body` lets the menu measure it) and only the
 * visible part shrinks; folded away it is also out of the tab order and hidden from screen readers.
 */
export function FoldBody({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return (
    <div id={id} className="fold" data-open={open}>
      <div className="fold__inner" data-fold-body inert={!open}>
        {children}
      </div>
    </div>
  )
}

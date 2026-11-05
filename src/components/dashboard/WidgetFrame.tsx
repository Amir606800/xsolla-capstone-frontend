import { memo } from 'react'
import type { ReactNode } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { SIZE_LABEL, WIDGETS } from '../../config/dashboardWidgets'
import type { WidgetId, WidgetSize } from '../../config/dashboardWidgets'
import { Icon } from '../Icon'

interface Props {
  id: WidgetId
  size: WidgetSize
  editing: boolean
  isFirst: boolean
  isLast: boolean
  onMoveBy: (id: WidgetId, direction: -1 | 1) => void
  onResize: (id: WidgetId, size: WidgetSize) => void
  onRemove: (id: WidgetId) => void
  children: ReactNode
}

/** One cell of the dashboard grid. In edit mode it gets a control bar and can be dragged by its handle. */
function WidgetFrameBase({ id, size, editing, isFirst, isLast, onMoveBy, onResize, onRemove, children }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  })
  const meta = WIDGETS[id]

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`widget widget--${size}${editing ? ' is-editing' : ''}${isDragging ? ' is-dragging' : ''}`}
      data-widget={id}
    >
      {editing && (
        <div className="widget__bar" role="group" aria-label={`${meta.title} controls`}>
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="widget__btn widget__handle"
            {...attributes}
            {...listeners}
            aria-label={`Drag ${meta.title}`}
          >
            <Icon name="grip" size={18} />
          </button>
          <button
            type="button"
            className="widget__btn"
            onClick={() => onMoveBy(id, -1)}
            disabled={isFirst}
            aria-label={`Move ${meta.title} earlier`}
          >
            <Icon name="chevron-left" size={18} />
          </button>
          <button
            type="button"
            className="widget__btn"
            onClick={() => onMoveBy(id, 1)}
            disabled={isLast}
            aria-label={`Move ${meta.title} later`}
          >
            <Icon name="chevron-right" size={18} />
          </button>

          <div className="widget__sizes" role="group" aria-label={`${meta.title} width`}>
            {meta.sizes.map((s) => (
              <button
                key={s}
                type="button"
                className="widget__size"
                aria-pressed={s === size}
                aria-label={`${SIZE_LABEL[s]} width`}
                onClick={() => onResize(id, s)}
              >
                {s === 'full' ? 'Full' : s.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="widget__btn widget__remove"
            onClick={() => onRemove(id)}
            aria-label={`Remove ${meta.title}`}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
      {/* while editing the content is inert, so a stray click can't open a link or move a focus ring */}
      <div className="widget__body" inert={editing}>
        {children}
      </div>
    </div>
  )
}

export const WidgetFrame = memo(WidgetFrameBase)

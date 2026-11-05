import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useDashboardLayout } from '../../hooks/useDashboardLayout'
import type { WidgetId } from '../../config/dashboardWidgets'
import { visibleWidgets } from '../../utils/dashboardLayout'
import { DashboardWidgetBody } from './DashboardWidgetBody'
import type { DashboardData } from './DashboardWidgetBody'
import { WidgetFrame } from './WidgetFrame'

interface Props {
  data: DashboardData
  editing: boolean
  onAddClick: () => void
}

/** The widget grid: renders the shown widgets in the student's order and sizes, and lets them be rearranged. */
export function DashboardWidgets({ data, editing, onAddClick }: Props) {
  const { layout, move, moveBy, resize, setShown } = useDashboardLayout()
  const shown = visibleWidgets(layout)

  // a small drag distance keeps a plain click on a handle from starting a drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) move(active.id as WidgetId, over.id as WidgetId)
  }

  if (shown.length === 0) {
    return (
      <div className="dash__state widgets__empty">
        <p>Your dashboard is empty.</p>
        <button type="button" className="btn" onClick={onAddClick}>
          Add a widget
        </button>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={shown.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div className="widgets">
          {shown.map((w, i) => (
            <WidgetFrame
              key={w.id}
              id={w.id}
              size={w.size}
              editing={editing}
              isFirst={i === 0}
              isLast={i === shown.length - 1}
              onMoveBy={moveBy}
              onResize={resize}
              onRemove={(id) => setShown(id, false)}
            >
              <DashboardWidgetBody id={w.id} data={data} />
            </WidgetFrame>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

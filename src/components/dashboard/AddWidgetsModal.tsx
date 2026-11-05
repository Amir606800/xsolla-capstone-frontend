import { WIDGETS } from '../../config/dashboardWidgets'
import { useDashboardLayout } from '../../hooks/useDashboardLayout'
import { hiddenWidgets } from '../../utils/dashboardLayout'
import { Icon } from '../Icon'
import { Modal } from '../Modal'

/** Lists the widgets that are not on the dashboard, with an Add button for each. */
export function AddWidgetsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { layout, setShown } = useDashboardLayout()
  const hidden = hiddenWidgets(layout)

  return (
    <Modal open={open} onClose={onClose} title="Add widgets">
      {hidden.length === 0 ? (
        <p className="card__empty">Every widget is already on your dashboard.</p>
      ) : (
        <ul className="list">
          {hidden.map(({ id }) => {
            const meta = WIDGETS[id]
            return (
              <li key={id} className="list__row widget-add__row">
                <span className="card__icon">
                  <Icon name={meta.icon} size={20} />
                </span>
                <div className="widget-add__text">
                  <p className="list__title">{meta.title}</p>
                  <p className="list__meta">{meta.description}</p>
                </div>
                <button type="button" className="btn btn--ghost" onClick={() => setShown(id, true)} aria-label={`Add ${meta.title}`}>
                  <Icon name="plus" size={16} />
                  Add
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

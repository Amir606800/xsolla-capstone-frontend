import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { MaterialForm } from '../../../components/authoring/MaterialForm'
import { ModuleForm } from '../../../components/authoring/ModuleForm'
import { QuizForm } from '../../../components/authoring/QuizForm'
import { TaskForm } from '../../../components/authoring/TaskForm'
import { Icon } from '../../../components/Icon'
import { Modal } from '../../../components/Modal'
import { useAuth } from '../../../hooks/useAuth'
import { useCourses } from '../../../hooks/useCourses'
import { usePeopleNames } from '../../../hooks/usePeopleNames'
import { newId } from '../../../mocks/contentEdits'
import type { ContentItem, CourseModule } from '../../../types/course'
import { contentsLine, ITEM_TYPE_LABEL, itemAuthor, itemSummary, keepMeta, moduleDates, moduleDeleteWarning } from '../../../utils/adminContent'
import { draftToMaterial, draftToQuiz, draftToTask } from '../../../utils/authoring'
import { modulePhase, PHASE_LABEL } from '../../../utils/content'
import { formatDateTime } from '../../../utils/date'
import { ConfirmDialog } from '../ConfirmDialog'
import { ItemDetails } from './ItemDetails'

type Filter = 'all' | ContentItem['type']
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'assignment', label: 'Tasks' },
  { value: 'resource', label: 'Resources' },
  { value: 'quiz', label: 'Quizzes' },
]
/** Tasks first, then resources, then quizzes (each in course order). */
const TYPE_ORDER: ContentItem['type'][] = ['assignment', 'resource', 'quiz']

type Action =
  | { kind: 'view' | 'edit' | 'delete'; item: ContentItem }
  | { kind: 'add'; type: ContentItem['type'] }
  | { kind: 'edit-module' | 'delete-module' }

const ADD_BUTTONS: { type: ContentItem['type']; label: string }[] = [
  { type: 'assignment', label: 'New task' },
  { type: 'resource', label: 'New resource' },
  { type: 'quiz', label: 'New quiz' },
]

const ITEM_ICON = { assignment: 'tasks', resource: 'file', quiz: 'sparkle' } as const

/** Admin: one module with all of its tasks, resources and quizzes; view, edit or delete each. */
export default function AdminModulePage() {
  const { moduleId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { status, modules, now, reload, saveModule, saveItem, deleteItem, deleteModule } = useCourses()
  const nameOf = usePeopleNames()
  const [filter, setFilter] = useState<Filter>('all')
  const [action, setAction] = useState<Action | null>(null)
  // a module created on the list page arrives here with a message
  const [message, setMessage] = useState<string>(() => (location.state as { message?: string } | null)?.message ?? '')

  if (status === 'loading') {
    return (
      <p className="admin-muted" role="status">
        Loading the module…
      </p>
    )
  }
  if (status === 'error') {
    return (
      <div className="admin-empty" role="alert">
        <p>The module could not be loaded.</p>
        <button type="button" className="admin-btn" onClick={reload}>
          Try again
        </button>
      </div>
    )
  }

  const module = modules.find((m) => m.id === moduleId)
  if (!module) {
    return (
      <section className="admin-page">
        <BackLink />
        <h1 className="page-title">Module not found</h1>
        <p className="admin-muted">It may have been deleted.</p>
      </section>
    )
  }

  const items = TYPE_ORDER.flatMap((t) => module.items.filter((i) => i.type === t))
  const shown = filter === 'all' ? items : items.filter((i) => i.type === filter)
  const count = (f: Filter) => (f === 'all' ? items.length : items.filter((i) => i.type === f).length)
  const phase = modulePhase(module, now)
  // the item as it is now (it may have changed since the dialog opened)
  const current = action && 'item' in action ? module.items.find((i) => i.id === action.item.id) : undefined

  const open = (a: Action) => {
    setMessage('')
    setAction(a)
  }
  const close = () => setAction(null)
  const saved = (text: string) => {
    close()
    setMessage(text)
  }

  return (
    <section className="admin-page">
      <BackLink />
      <header className="admin-page__head admin-module-head">
        <div>
          <p className="admin-eyebrow">Module {module.position}</p>
          <h1 className="page-title">{module.title}</h1>
          {module.description && <p className="page-subtitle">{module.description}</p>}
        </div>
        <div className="admin-actions">
          <button type="button" className="admin-btn" onClick={() => open({ kind: 'edit-module' })}>
            <Icon name="edit" size={16} /> Edit module
          </button>
          <button type="button" className="admin-btn admin-btn--danger-outline" onClick={() => open({ kind: 'delete-module' })}>
            <Icon name="trash" size={16} /> Delete module
          </button>
        </div>
      </header>

      <dl className="admin-facts">
        <div>
          <dt>Lecturer</dt>
          <dd>{nameOf(module.createdBy)}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{module.createdAt ? formatDateTime(module.createdAt) : 'Unknown'}</dd>
        </div>
        <div>
          <dt>Dates</dt>
          <dd>{moduleDates(module)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`admin-pill admin-pill--${phase}`}>{PHASE_LABEL[phase]}</span>
          </dd>
        </div>
        <div>
          <dt>Contents</dt>
          <dd>{contentsLine(module)}</dd>
        </div>
      </dl>

      <p className="admin-status" role="status">
        {message}
      </p>

      <div className="admin-toolbar">
        <h2 className="admin-section-title">Contents</h2>
        <div className="admin-actions admin-toolbar__add" role="group" aria-label="Add content">
          {ADD_BUTTONS.map((b) => (
            <button key={b.type} type="button" className="admin-btn" onClick={() => open({ kind: 'add', type: b.type })}>
              <Icon name="plus" size={16} /> {b.label}
            </button>
          ))}
        </div>
        <div className="admin-segmented" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label} <span className="admin-segmented__count">{count(f.value)}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="admin-empty">{filter === 'all' ? 'This module is empty.' : `No ${FILTERS.find((f) => f.value === filter)!.label.toLowerCase()} in this module.`}</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="sr-only">Contents of {module.title}</caption>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Title</th>
                <th scope="col">Details</th>
                <th scope="col">Lecturer</th>
                <th scope="col">Students</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className="admin-type">
                      <Icon name={ITEM_ICON[i.type]} size={16} /> {ITEM_TYPE_LABEL[i.type]}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="admin-link admin-table__title" onClick={() => open({ kind: 'view', item: i })}>
                      {i.title}
                    </button>
                  </td>
                  <td className="admin-table__muted">{itemSummary(i)}</td>
                  <td>{nameOf(itemAuthor(i, module))}</td>
                  <td>
                    <span className={`admin-pill ${i.hidden ? 'admin-pill--hidden' : 'admin-pill--visible'}`}>{i.hidden ? 'Hidden' : 'Visible'}</span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" className="admin-icon-btn" onClick={() => open({ kind: 'view', item: i })} aria-label={`View ${i.title}`} title="View">
                        <Icon name="eye" size={16} />
                      </button>
                      <button type="button" className="admin-icon-btn" onClick={() => open({ kind: 'edit', item: i })} aria-label={`Edit ${i.title}`} title="Edit">
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn admin-icon-btn--danger"
                        onClick={() => open({ kind: 'delete', item: i })}
                        aria-label={`Delete ${i.title}`}
                        title="Delete"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* view */}
      <Modal open={action?.kind === 'view'} onClose={close} title={current?.title ?? ''}>
        {action?.kind === 'view' && current && (
          <div className="admin-dialog">
            <ItemDetails item={current} module={module} nameOf={nameOf} />
            <div className="admin-confirm__actions">
              <button type="button" className="admin-btn" onClick={() => open({ kind: 'edit', item: current })}>
                <Icon name="edit" size={16} /> Edit
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* edit an item */}
      <Modal open={action?.kind === 'edit'} onClose={close} title={current ? `Edit ${ITEM_TYPE_LABEL[current.type].toLowerCase()}` : ''} initialFocus=".form input, .form select">
        {action?.kind === 'edit' && current && (
          <ItemForm type={current.type} item={current} module={module} now={now} onCancel={close} onSave={async (next, text) => {
            await saveItem(next)
            saved(text)
          }} />
        )}
      </Modal>

      {/* add an item */}
      <Modal
        open={action?.kind === 'add'}
        onClose={close}
        title={action?.kind === 'add' ? `New ${ITEM_TYPE_LABEL[action.type].toLowerCase()}` : ''}
        initialFocus=".form input, .form select"
      >
        {action?.kind === 'add' && (
          <ItemForm
            type={action.type}
            module={module}
            now={now}
            createdBy={user?.id}
            onCancel={close}
            onSave={async (next, text) => {
              await saveItem(next)
              // make sure the new item is in view
              setFilter('all')
              saved(text)
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={action?.kind === 'delete'}
        title={current ? `Delete “${current.title}”?` : ''}
        confirmLabel={current ? `Delete ${ITEM_TYPE_LABEL[current.type].toLowerCase()}` : 'Delete'}
        onClose={close}
        onConfirm={async () => {
          if (!current) return
          await deleteItem(current.id)
          saved(`“${current.title}” deleted.`)
        }}
      >
        {current && (
          <p>
            It is removed from Module {module.position} for everyone.
            {current.type === 'assignment' ? ' Work students already handed in is kept.' : ''}
          </p>
        )}
      </ConfirmDialog>

      {/* the module itself */}
      <Modal open={action?.kind === 'edit-module'} onClose={close} title="Edit module" initialFocus=".form input">
        {action?.kind === 'edit-module' && (
          <ModuleForm module={module} onCancel={close} onSave={async (patch) => {
            await saveModule(module.id, patch)
            saved('Module saved.')
          }} />
        )}
      </Modal>

      <ConfirmDialog
        open={action?.kind === 'delete-module'}
        title={`Delete “${module.title}”?`}
        confirmLabel="Delete module"
        onClose={close}
        onConfirm={async () => {
          await deleteModule(module.id)
          navigate('/admin/modules', { replace: true, state: { message: `“${module.title}” deleted.` } })
        }}
      >
        <p>
          Module {module.position} is removed for everyone. {moduleDeleteWarning(module)}
        </p>
      </ConfirmDialog>
    </section>
  )
}

function BackLink() {
  return (
    <Link to="/admin/modules" className="admin-link admin-back">
      <Icon name="back" size={16} /> All modules
    </Link>
  )
}

const ID_PREFIX = { assignment: 'task', resource: 'material', quiz: 'quiz' } as const

/**
 * The lecturer's own form for the item's type, empty for a new item. An edit keeps what the form does
 * not know about (author, hidden); a new item is by the admin who adds it.
 */
function ItemForm({
  type,
  item,
  module,
  now,
  createdBy,
  onCancel,
  onSave,
}: {
  type: ContentItem['type']
  item?: ContentItem
  module: CourseModule
  now: Date
  createdBy?: number
  onCancel: () => void
  onSave: (next: ContentItem, message: string) => Promise<void>
}) {
  // a new item gets its id once, so saving again after an error never makes two
  const [id] = useState(() => item?.id ?? newId(ID_PREFIX[type]))
  const verb = item ? 'saved' : 'added'
  const finish = <T extends ContentItem>(next: T): T => (item ? keepMeta(item, next) : createdBy !== undefined ? { ...next, createdBy } : next)

  switch (type) {
    case 'assignment':
      return (
        <TaskForm
          module={module}
          now={now}
          item={item?.type === 'assignment' ? item : undefined}
          onCancel={onCancel}
          onSave={(d) => onSave(finish(draftToTask(d, module.id, id)), `Task ${verb}.`)}
        />
      )
    case 'resource':
      return (
        <MaterialForm
          item={item?.type === 'resource' ? item : undefined}
          onCancel={onCancel}
          onSave={(d) => onSave(finish(draftToMaterial(d, module.id, id)), `Resource ${verb}.`)}
        />
      )
    case 'quiz':
      return (
        <QuizForm
          item={item?.type === 'quiz' ? item : undefined}
          onCancel={onCancel}
          onSave={(d) => onSave(finish(draftToQuiz(d, module.id, id)), `Quiz ${verb}.`)}
        />
      )
  }
}

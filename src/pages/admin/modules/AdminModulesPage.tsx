import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { saveBlob } from '../../../api/files'
import { ModuleForm } from '../../../components/authoring/ModuleForm'
import { Icon } from '../../../components/Icon'
import { Modal } from '../../../components/Modal'
import { useCourses } from '../../../hooks/useCourses'
import { usePeopleNames } from '../../../hooks/usePeopleNames'
import { useSort } from '../../../hooks/useSort'
import type { CourseModule } from '../../../types/course'
import { contentsLine, moduleDates, moduleDeleteWarning } from '../../../utils/adminContent'
import { modulePhase, PHASE_LABEL } from '../../../utils/content'
import { buildTemplate, templateFileName } from '../../../utils/moduleTemplate'
import { ImportTemplate } from './ImportTemplate'
import { ConfirmDialog } from '../ConfirmDialog'
import { SortableTh } from '../SortableTh'
import { Loading } from '../../../components/loading/Loading'

type Action = { kind: 'edit' | 'delete'; module: CourseModule } | { kind: 'new' } | { kind: 'import' }
const PHASE_ORDER = { running: 0, upcoming: 1, done: 2 } as const

/** Admin: every module of the course, who wrote it and what is in it; edit or delete one. */
export default function AdminModulesPage() {
  const { status, modules, now, reload, saveModule, deleteModule, createModule } = useCourses()
  const navigate = useNavigate()
  const nameOf = usePeopleNames()
  const location = useLocation()
  const [action, setAction] = useState<Action | null>(null)
  // a module deleted on its own page comes back here with a message
  const [message, setMessage] = useState<string>(() => (location.state as { message?: string } | null)?.message ?? '')
  const byPosition = useMemo(() => [...modules].sort((a, b) => a.position - b.position), [modules])
  const { sorted, sort, toggle } = useSort(
    byPosition,
    {
      position: (m) => m.position,
      title: (m) => m.title,
      lecturer: (m) => (m.createdBy !== undefined ? nameOf(m.createdBy) : undefined),
      contents: (m) => m.items.length,
      dates: (m) => m.opensAt,
      // running first, then the ones to come, then the finished ones
      status: (m) => PHASE_ORDER[modulePhase(m, now)],
    },
    { key: 'position', dir: 'asc' },
  )

  const open = (kind: 'edit' | 'delete', module: CourseModule) => {
    setMessage('')
    setAction({ kind, module })
  }
  // an empty module for the form; it goes after the last one
  const blank: CourseModule = { id: '', position: (byPosition.at(-1)?.position ?? 0) + 1, title: '', items: [] }
  const close = () => setAction(null)

  // every module with its tasks, links and quizzes as a file; dates are kept relative to week 1
  function exportTemplate() {
    const template = buildTemplate(modules)
    saveBlob(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }), templateFileName())
    const out = template.left_out
    const notes = [
      out && out.files > 0 ? `${out.files} uploaded ${out.files === 1 ? 'file' : 'files'} not included` : '',
      out && out.modulesWithoutDates > 0 ? `${out.modulesWithoutDates} ${out.modulesWithoutDates === 1 ? 'module' : 'modules'} without dates left out` : '',
    ].filter(Boolean)
    setMessage(`Template saved with ${template.modules.length} ${template.modules.length === 1 ? 'module' : 'modules'}.${notes.length ? ` (${notes.join('; ')}.)` : ''}`)
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head admin-module-head">
        <div>
          <h1 className="page-title">Modules</h1>
          <p className="page-subtitle">Every module and its tasks, resources and quizzes.</p>
        </div>
        <div className="admin-module-head__actions">
          <button type="button" className="admin-btn" onClick={exportTemplate} disabled={status !== 'ready' || modules.length === 0}>
            <Icon name="download" size={16} /> Export template
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              setMessage('')
              setAction({ kind: 'import' })
            }}
            disabled={status !== 'ready'}
          >
            <Icon name="upload" size={16} /> Import template
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => {
              setMessage('')
              setAction({ kind: 'new' })
            }}
            disabled={status !== 'ready'}
          >
            <Icon name="plus" size={16} /> New module
          </button>
        </div>
      </header>

      <p className="admin-status" role="status">
        {message}
      </p>

      {status === 'loading' && (
        <Loading className="admin-muted">Loading the modules…</Loading>
      )}
      {status === 'error' && (
        <div className="admin-empty" role="alert">
          <p>The modules could not be loaded.</p>
          <button type="button" className="admin-btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {status === 'ready' && sorted.length === 0 && <p className="admin-empty">There are no modules.</p>}
      {status === 'ready' && sorted.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="sr-only">Modules</caption>
            <thead>
              <tr>
                <SortableTh label="#" sortKey="position" sort={sort} onSort={toggle} />
                <SortableTh label="Module" sortKey="title" sort={sort} onSort={toggle} />
                <SortableTh label="Lecturer" sortKey="lecturer" sort={sort} onSort={toggle} />
                <SortableTh label="Contents" sortKey="contents" sort={sort} onSort={toggle} />
                <SortableTh label="Dates" sortKey="dates" sort={sort} onSort={toggle} />
                <SortableTh label="Status" sortKey="status" sort={sort} onSort={toggle} />
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const phase = modulePhase(m, now)
                return (
                  <tr key={m.id}>
                    <td className="admin-table__num">{m.position}</td>
                    <td>
                      <Link to={`/admin/modules/${m.id}`} className="admin-table__title">
                        {m.title}
                      </Link>
                    </td>
                    <td>{nameOf(m.createdBy)}</td>
                    <td className="admin-table__muted">{contentsLine(m)}</td>
                    <td className="admin-table__muted">{moduleDates(m)}</td>
                    <td>
                      <span className={`admin-pill admin-pill--${phase}`}>{PHASE_LABEL[phase]}</span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <Link to={`/admin/modules/${m.id}`} className="admin-icon-btn" aria-label={`View ${m.title}`} title="View">
                          <Icon name="eye" size={16} />
                        </Link>
                        <button type="button" className="admin-icon-btn" onClick={() => open('edit', m)} aria-label={`Edit ${m.title}`} title="Edit">
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn admin-icon-btn--danger"
                          onClick={() => open('delete', m)}
                          aria-label={`Delete ${m.title}`}
                          title="Delete"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={action?.kind === 'new'} onClose={close} title={`New module (Module ${blank.position})`} initialFocus=".form input">
        {action?.kind === 'new' && (
          <ModuleForm
            module={blank}
            submitLabel="Create module"
            onCancel={close}
            onSave={async (patch) => {
              const { id, warning } = await createModule(patch)
              const message = 'Module created. Add its tasks, resources and quizzes below.'
              navigate(`/admin/modules/${id}`, { state: { message: warning ? `${message} ${warning}` : message } })
            }}
          />
        )}
      </Modal>

      <Modal open={action?.kind === 'import'} onClose={close} title="Import a module template">
        {action?.kind === 'import' && (
          <ImportTemplate
            onClose={close}
            onDone={(text) => {
              close()
              setMessage(text)
            }}
          />
        )}
      </Modal>

      <Modal open={action?.kind === 'edit'} onClose={close} title="Edit module" initialFocus=".form input">
        {action?.kind === 'edit' && (
          <ModuleForm
            module={action.module}
            onCancel={close}
            onSave={async (patch) => {
              const warning = await saveModule(action.module.id, patch)
              close()
              setMessage(warning ? `Module saved. ${warning}` : 'Module saved.')
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={action?.kind === 'delete'}
        title={action?.kind === 'delete' ? `Delete “${action.module.title}”?` : ''}
        confirmLabel="Delete module"
        onClose={close}
        onConfirm={async () => {
          if (action?.kind !== 'delete') return
          await deleteModule(action.module.id)
          close()
          setMessage(`“${action.module.title}” deleted.`)
        }}
      >
        {action?.kind === 'delete' && (
          <p>
            Module {action.module.position} is removed for everyone. {moduleDeleteWarning(action.module)}
          </p>
        )}
      </ConfirmDialog>
    </section>
  )
}

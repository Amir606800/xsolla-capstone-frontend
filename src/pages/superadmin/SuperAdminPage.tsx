import { useId, useReducer, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { Avatar } from '../../components/profile/Avatar'
import { XsollaLogo } from '../../components/XsollaLogo'
import { emailError, nameError } from '../../utils/credentials'
import { ConfirmDialog } from '../admin/ConfirmDialog'
import { cohortsOf, initialState, superAdminReducer, unassigned } from './superAdminState'
import type { Cohort, Coordinator, SuperAdminState } from './superAdminState'
import '../../styles/ui.css'
import '../admin/admin.css'
import './superadmin.css'

type Dialog =
  | { kind: 'addCohort' }
  | { kind: 'addCoordinator' }
  | { kind: 'assign'; cohort: Cohort }
  | { kind: 'deleteCohort'; cohort: Cohort }
  | { kind: 'deleteCoordinator'; coordinator: Coordinator }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * SUPER ADMIN (a demo, front-end only): manages the coordinators (the admin accounts of each school) and the cohorts, and says
 * which coordinators run which cohort. The LMS we have is one cohort, Xsolla School Baku, and its admin is that school's coordinator.
 * Nothing is saved: a reload brings the sample data back.
 */
export default function SuperAdminPage() {
  const [state, dispatch] = useReducer(superAdminReducer, initialState)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [message, setMessage] = useState('')

  const close = () => setDialog(null)
  const done = (text: string) => {
    setMessage(text)
    close()
  }
  const free = unassigned(state)

  return (
    <div className="admin sa">
      <header className="admin__bar">
        <div className="admin-brand">
          <XsollaLogo className="admin-brand__logo" />
          <span className="admin-brand__tag">Super admin</span>
        </div>
        <span className="sa__demo">Demo, not saved</span>
      </header>

      <main className="sa__main">
        <header className="admin-page__head">
          <h1 className="page-title">Schools and coordinators</h1>
          <p className="page-subtitle">
            Every Xsolla school is a cohort. Its coordinators are the admin accounts that run it, like the admin of the Baku school.
          </p>
        </header>

        <p className="admin-status" role="status">
          {message}
        </p>

        <dl className="admin-facts">
          <div>
            <dt>Cohorts</dt>
            <dd>{state.cohorts.length}</dd>
          </div>
          <div>
            <dt>Coordinators</dt>
            <dd>{state.coordinators.length}</dd>
          </div>
          <div>
            <dt>Without a cohort</dt>
            <dd>{free.length}</dd>
          </div>
        </dl>

        <section aria-labelledby="sa-cohorts">
          <div className="sa__section-head">
            <h2 id="sa-cohorts">Cohorts</h2>
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => setDialog({ kind: 'addCohort' })}>
              <Icon name="plus" size={16} /> Add cohort
            </button>
          </div>
          {state.cohorts.length === 0 ? (
            <p className="admin-muted">No cohort yet. Add the first one.</p>
          ) : (
            <div className="sa__cohorts">
              {state.cohorts.map((h) => (
                <CohortCard key={h.id} cohort={h} state={state} onAssign={() => setDialog({ kind: 'assign', cohort: h })} onDelete={() => setDialog({ kind: 'deleteCohort', cohort: h })} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="sa-coordinators">
          <div className="sa__section-head">
            <h2 id="sa-coordinators">Coordinators</h2>
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => setDialog({ kind: 'addCoordinator' })}>
              <Icon name="plus" size={16} /> Add coordinator
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Coordinator</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Runs</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.coordinators.map((c) => {
                  const runs = cohortsOf(state, c.id)
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="sa-person">
                          <Avatar name={c.name} size={28} />
                          <span className="sa-person__name">{c.name}</span>
                        </span>
                      </td>
                      <td>{c.email}</td>
                      <td>
                        <span className="sa-tags">
                          {runs.length === 0 ? (
                            <span className="sa-tag sa-tag--warn">No cohort yet</span>
                          ) : (
                            runs.map((h) => (
                              <span key={h.id} className="sa-tag">
                                {h.city}
                              </span>
                            ))
                          )}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-icon-btn admin-icon-btn--danger"
                          aria-label={`Remove ${c.name}`}
                          title="Remove"
                          onClick={() => setDialog({ kind: 'deleteCoordinator', coordinator: c })}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Modal open={dialog?.kind === 'addCohort'} onClose={close} title="Add a cohort" initialFocus="input">
        {dialog?.kind === 'addCohort' && (
          <CohortForm
            state={state}
            onCancel={close}
            onSave={(v) => {
              dispatch({ type: 'addCohort', ...v })
              done(`${v.name} added${v.coordinatorIds.length ? ` with ${plural(v.coordinatorIds.length, 'coordinator')}` : ''}.`)
            }}
          />
        )}
      </Modal>

      <Modal open={dialog?.kind === 'addCoordinator'} onClose={close} title="Add a coordinator" initialFocus="input">
        {dialog?.kind === 'addCoordinator' && (
          <CoordinatorForm
            state={state}
            onCancel={close}
            onSave={(v) => {
              dispatch({ type: 'addCoordinator', ...v })
              done(`${v.name} added as a coordinator.`)
            }}
          />
        )}
      </Modal>

      <Modal open={dialog?.kind === 'assign'} onClose={close} title={dialog?.kind === 'assign' ? `Coordinators of ${dialog.cohort.name}` : ''}>
        {dialog?.kind === 'assign' && (
          <AssignForm
            cohort={dialog.cohort}
            coordinators={state.coordinators}
            onCancel={close}
            onSave={(ids) => {
              dispatch({ type: 'assign', cohortId: dialog.cohort.id, coordinatorIds: ids })
              done(`${dialog.cohort.name} now has ${plural(ids.length, 'coordinator')}.`)
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={dialog?.kind === 'deleteCohort'}
        title={dialog?.kind === 'deleteCohort' ? `Remove ${dialog.cohort.name}?` : ''}
        confirmLabel="Remove cohort"
        busyLabel="Removing…"
        onClose={close}
        onConfirm={async () => {
          if (dialog?.kind !== 'deleteCohort') return
          dispatch({ type: 'removeCohort', id: dialog.cohort.id })
          done(`${dialog.cohort.name} was removed. Its coordinators stay in the list.`)
        }}
      >
        <p>The cohort is taken off the list. Its coordinators keep their accounts.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'deleteCoordinator'}
        title={dialog?.kind === 'deleteCoordinator' ? `Remove ${dialog.coordinator.name}?` : ''}
        confirmLabel="Remove coordinator"
        busyLabel="Removing…"
        onClose={close}
        onConfirm={async () => {
          if (dialog?.kind !== 'deleteCoordinator') return
          dispatch({ type: 'removeCoordinator', id: dialog.coordinator.id })
          done(`${dialog.coordinator.name} was removed.`)
        }}
      >
        <p>They can no longer sign in as a coordinator, and they leave every cohort they ran.</p>
      </ConfirmDialog>
    </div>
  )
}

function CohortCard({ cohort, state, onAssign, onDelete }: { cohort: Cohort; state: SuperAdminState; onAssign: () => void; onDelete: () => void }) {
  const people = state.coordinators.filter((c) => cohort.coordinatorIds.includes(c.id))
  // the picture and the name open the cohort's page (only Baku has one so far: its admin sign-in)
  const top = (
    <>
      <div className="sa-cohort__media">
        {cohort.photo ? (
          <img src={cohort.photo} alt="" loading="lazy" style={{ objectPosition: cohort.photoPosition ?? 'center' }} />
        ) : (
          <span className="sa-cohort__nophoto" aria-hidden="true">
            {cohort.city}
          </span>
        )}
      </div>
      <div className="sa-cohort__head">
        <h3>{cohort.name}</h3>
        <p className="sa-cohort__place">
          {cohort.city}, {cohort.country}
        </p>
        {cohort.note && <p className="sa-cohort__note">{cohort.note}</p>}
      </div>
    </>
  )
  return (
    <article className="sa-cohort" aria-label={cohort.name}>
      {cohort.path ? (
        <Link to={cohort.path} className="sa-cohort__open" aria-label={`Open ${cohort.name}`}>
          {top}
        </Link>
      ) : (
        <div className="sa-cohort__open sa-cohort__open--none" title="This cohort has no page yet">
          {top}
          <span className="sa-tag sa-tag--warn sa-cohort__soon">Page not built yet</span>
        </div>
      )}
      <button type="button" className="admin-icon-btn admin-icon-btn--danger sa-cohort__remove" aria-label={`Remove ${cohort.name}`} title="Remove" onClick={onDelete}>
        <Icon name="trash" size={16} />
      </button>
      {people.length === 0 ? (
        <p className="admin-muted">No coordinator yet.</p>
      ) : (
        <ul className="sa-people" aria-label={`Coordinators of ${cohort.name}`}>
          {people.map((c) => (
            <li key={c.id} className="sa-person">
              <Avatar name={c.name} size={28} />
              <span className="sa-person__text">
                <span className="sa-person__name">{c.name}</span>
                <span className="sa-person__mail">{c.email}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="sa-cohort__foot">
        <span className="admin-muted">{plural(people.length, 'coordinator')}</span>
        <button type="button" className="admin-btn" onClick={onAssign}>
          <Icon name="team" size={16} /> Assign coordinators
        </button>
      </div>
    </article>
  )
}

/** A list of checkboxes: who (or which cohorts) to pick. */
function PickList({
  legend,
  items,
  picked,
  onChange,
  empty,
}: {
  legend: string
  items: { id: string; name: string; hint: string }[]
  picked: string[]
  onChange: (ids: string[]) => void
  empty: string
}) {
  const toggle = (id: string) => onChange(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])
  return (
    <fieldset className="sa-pick">
      <legend>{legend}</legend>
      {items.length === 0 ? (
        <p className="sa-pick__empty">{empty}</p>
      ) : (
        <div className="sa-pick__list">
          {items.map((it) => (
            <label key={it.id} className="sa-pick__row">
              <input type="checkbox" checked={picked.includes(it.id)} onChange={() => toggle(it.id)} />
              <span className="sa-person__text">
                <span className="sa-person__name">{it.name}</span>
                <span className="sa-person__mail">{it.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}

function Field({ id, label, value, onChange, error, type = 'text' }: { id: string; label: string; value: string; onChange: (v: string) => void; error: string; type?: string }) {
  return (
    <div className="admin-field">
      <label className="admin-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="admin-field__input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p className="admin-field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

function Actions({ onCancel, label }: { onCancel: () => void; label: string }) {
  return (
    <div className="sa-actions">
      <button type="button" className="admin-btn" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="admin-btn admin-btn--primary">
        {label}
      </button>
    </div>
  )
}

function CohortForm({
  state,
  onSave,
  onCancel,
}: {
  state: SuperAdminState
  onSave: (v: { name: string; country: string; city: string; coordinatorIds: string[] }) => void
  onCancel: () => void
}) {
  const id = useId()
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const errors = {
    name: name.trim() ? '' : 'Enter the cohort name, like "Xsolla School Almaty".',
    country: country.trim() ? '' : 'Enter the country.',
    city: city.trim() ? '' : 'Enter the city.',
  }
  const show = (k: keyof typeof errors) => (touched ? errors[k] : '')

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (errors.name || errors.country || errors.city) return
    onSave({ name: name.trim(), country: country.trim(), city: city.trim(), coordinatorIds: picked })
  }

  return (
    <form className="admin-dialog" onSubmit={submit} noValidate aria-label="New cohort">
      <Field id={`${id}-name`} label="Cohort name" value={name} onChange={setName} error={show('name')} />
      <div className="admin-form-row">
        <Field id={`${id}-country`} label="Country" value={country} onChange={setCountry} error={show('country')} />
        <Field id={`${id}-city`} label="City" value={city} onChange={setCity} error={show('city')} />
      </div>
      <PickList
        legend="Coordinators of this cohort (you can also do it later)"
        items={state.coordinators.map((c) => ({ id: c.id, name: c.name, hint: c.email }))}
        picked={picked}
        onChange={setPicked}
        empty="No coordinator yet: add one first."
      />
      <Actions onCancel={onCancel} label="Add cohort" />
    </form>
  )
}

function CoordinatorForm({
  state,
  onSave,
  onCancel,
}: {
  state: SuperAdminState
  onSave: (v: { name: string; email: string; cohortIds: string[] }) => void
  onCancel: () => void
}) {
  const id = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const taken = state.coordinators.some((c) => c.email.toLowerCase() === email.trim().toLowerCase())
  const errors = {
    name: nameError(name),
    email: emailError(email) || (taken ? 'There is already a coordinator with this e-mail.' : ''),
  }
  const show = (k: keyof typeof errors) => (touched ? errors[k] : '')

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (errors.name || errors.email) return
    onSave({ name: name.trim().replace(/\s+/g, ' '), email: email.trim(), cohortIds: picked })
  }

  return (
    <form className="admin-dialog" onSubmit={submit} noValidate aria-label="New coordinator">
      <Field id={`${id}-name`} label="Full name" value={name} onChange={setName} error={show('name')} />
      <Field id={`${id}-email`} label="E-mail" type="email" value={email} onChange={setEmail} error={show('email')} />
      <PickList
        legend="Cohorts they run (you can also do it later)"
        items={state.cohorts.map((h) => ({ id: h.id, name: h.name, hint: `${h.city}, ${h.country}` }))}
        picked={picked}
        onChange={setPicked}
        empty="No cohort yet: add one first."
      />
      <Actions onCancel={onCancel} label="Add coordinator" />
    </form>
  )
}

function AssignForm({
  cohort,
  coordinators,
  onSave,
  onCancel,
}: {
  cohort: Cohort
  coordinators: Coordinator[]
  onSave: (ids: string[]) => void
  onCancel: () => void
}) {
  const [picked, setPicked] = useState(cohort.coordinatorIds)
  return (
    <form
      className="admin-dialog"
      aria-label={`Coordinators of ${cohort.name}`}
      onSubmit={(e) => {
        e.preventDefault()
        onSave(picked)
      }}
    >
      <PickList
        legend={`Who runs ${cohort.name}? Pick one or more.`}
        items={coordinators.map((c) => ({ id: c.id, name: c.name, hint: c.email }))}
        picked={picked}
        onChange={setPicked}
        empty="No coordinator yet: add one first."
      />
      <Actions onCancel={onCancel} label="Save" />
    </form>
  )
}

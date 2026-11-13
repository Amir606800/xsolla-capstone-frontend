import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { EditorRow } from '../../components/authoring/EditorRow'
import { MaterialForm } from '../../components/authoring/MaterialForm'
import { ModuleForm } from '../../components/authoring/ModuleForm'
import { QuizForm } from '../../components/authoring/QuizForm'
import { TaskForm } from '../../components/authoring/TaskForm'
import { DownloadButton } from '../../components/DownloadButton'
import { Icon } from '../../components/Icon'
import type { IconName } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { Spinner } from '../../components/loading/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { newId } from '../../mocks/contentEdits'
import type { AssignmentItem, CourseModule, QuizItem, ResourceItem } from '../../types/course'
import { draftToMaterial, draftToQuiz, draftToTask, MATERIAL_KINDS } from '../../utils/authoring'
import { contentGaps, materialsOf, modulePhase, PHASE_LABEL, quizzesOf, tasksOf } from '../../utils/content'
import { formatDateTime, formatShortDate } from '../../utils/date'
import { hasRole } from '../../utils/roles'
import '../../styles/ui.css'
import '../../components/module/module.css'
import './lecturer.css'
import { Loading } from '../../components/loading/Loading'

type Kind = 'module' | 'material' | 'task' | 'quiz'
interface Editing {
  kind: Kind
  id?: string
}

const ADDABLE = ['material', 'task', 'quiz'] as const
const NOUN: Record<Kind, string> = { module: 'module', material: 'material', task: 'task', quiz: 'quiz' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Section({
  id,
  icon,
  title,
  addLabel,
  onAdd,
  extraActions,
  empty,
  children,
}: {
  id: string
  icon: IconName
  title: string
  addLabel?: string
  onAdd?: () => void
  extraActions?: React.ReactNode
  empty: string | null
  children: React.ReactNode
}) {
  return (
    <section className="card" aria-labelledby={id}>
      <header className="card__head">
        <span className="card__icon">
          <Icon name={icon} size={20} />
        </span>
        <h2 id={id}>{title}</h2>
        <div className="editor__actions">
          {extraActions}
          {addLabel && onAdd && (
            <button type="button" className="btn btn--ghost btn--small editor__add" onClick={onAdd}>
              <Icon name="plus" size={16} /> {addLabel}
            </button>
          )}
        </div>
      </header>
      {empty ? <p className="card__empty">{empty}</p> : <ul className="list">{children}</ul>}
    </section>
  )
}

export default function ModuleEditorPage() {
  const { moduleId } = useParams()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const isLecturer = hasRole(user, 'lecturer')
  const { status, modules, now, reload, saveModule, saveItem, deleteItem, generateAiQuiz } = useCourses()

  const [editing, setEditing] = useState<Editing | null>(() => {
    const add = params.get('add')
    if (add === 'quiz' && !isLecturer) return null
    return (ADDABLE as readonly string[]).includes(add ?? '') ? { kind: add as Kind } : null
  })
  const [aiSourceId, setAiSourceId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  if (status === 'loading') {
    return <Loading className="module__state">Loading module…</Loading>
  }
  if (status === 'error') {
    return (
      <div className="module__state" role="alert">
        <p>We couldn&apos;t load this module.</p>
        <button type="button" className="btn" onClick={reload}>
          Try again
        </button>
      </div>
    )
  }

  const module = modules.find((m) => m.id === moduleId)
  if (!module) {
    return (
      <div className="module__state">
        <h1 className="page-title">Module not found</h1>
        <Link to="/courses" className="btn">
          Back to course content
        </Link>
      </div>
    )
  }

  const tasks = tasksOf(module)
  const materials = materialsOf(module)
  const quizzes = quizzesOf(module)
  const gaps = contentGaps([module], now)
  const phase = modulePhase(module, now)
  const current = editing?.id ? module.items.find((i) => i.id === editing.id) : undefined

  function close() {
    setEditing(null)
    if (params.has('add')) setParams({}, { replace: true })
  }
  const done = (text: string) => async (run: Promise<string | void | undefined>) => {
    const warning = await run
    close()
    setMessage(warning ? `${text} ${warning}` : text)
  }
  const removed = (what: string, id: string) => async () => {
    await deleteItem(id)
    setMessage(`${cap(what)} deleted.`)
  }
  const open = (kind: Kind, id?: string) => {
    setMessage('')
    setEditing({ kind, id })
  }
  const openAiQuiz = (materialId?: string) => {
    setMessage('')
    setAiSourceId(materialId ?? materials[0]?.id ?? '')
  }

  const title = editing ? `${editing.id || editing.kind === 'module' ? 'Edit' : 'New'} ${NOUN[editing.kind]}` : ''
  const kindLabel = (k: ResourceItem['kind']) => MATERIAL_KINDS.find((x) => x.value === k)?.label ?? k

  return (
    <div className="module editor">
      <header className="module-head">
        <Link to="/courses" className="module-head__back">
          <Icon name="back" size={16} /> Course content
        </Link>
        <p className="module-head__eyebrow">Module {module.position}</p>
        <div className="editor__title-row">
          <h1 className="page-title">{module.title}</h1>
          <span className={`pill phase phase--${phase}`}>{PHASE_LABEL[phase]}</span>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => open('module')}>
            <Icon name="edit" size={16} /> Edit details
          </button>
        </div>
        {module.description && <p className="page-subtitle">{module.description}</p>}
        <dl className="module-head__meta">
          <div>
            <dt>Opens</dt>
            <dd>{module.opensAt ? formatDateTime(module.opensAt) : 'Not set'}</dd>
          </div>
          <div>
            <dt>Closes</dt>
            <dd>{module.closesAt ? formatDateTime(module.closesAt) : 'Not set'}</dd>
          </div>
        </dl>
      </header>

      <p className="editor__status" role="status">
        {message}
      </p>

      {gaps.length > 0 && (
        <ul className="editor__gaps" aria-label="Still missing">
          {gaps.map((g) => (
            <li key={g.id}>
              <Icon name="alert" size={16} /> {g.text}
            </li>
          ))}
        </ul>
      )}

      <div className="module__grid">
        <Section
          id="editor-tasks"
          icon="tasks"
          title="Tasks"
          addLabel="New task"
          onAdd={() => open('task')}
          empty={tasks.length ? null : 'No tasks yet. Students see what to hand in and by when.'}
        >
          {tasks.map((t: AssignmentItem) => (
            <EditorRow
              key={t.id}
              icon={<Icon name="tasks" size={18} />}
              title={t.title}
              meta={`Due ${formatDateTime(t.dueAt)}${t.requirements?.length ? ` · ${t.requirements.length} ${t.requirements.length === 1 ? 'requirement' : 'requirements'}` : ''}`}
              warning={t.submission ? "Students' work for it will be hidden too." : undefined}
              onEdit={() => open('task', t.id)}
              onDelete={removed('task', t.id)}
            />
          ))}
        </Section>

        <div className="module__side">
          <Section
            id="editor-materials"
            icon="file"
            title="Materials"
            addLabel="Add"
            onAdd={() => open('material')}
            empty={materials.length ? null : 'No materials yet: add the lecture slides or useful links.'}
          >
            {materials.map((r) => (
              <EditorRow
                key={r.id}
                icon={<Icon name={r.kind === 'link' ? 'link' : 'file'} size={18} />}
                title={r.title}
                meta={[kindLabel(r.kind), r.file?.name, r.description].filter(Boolean).join(' · ')}
                onEdit={() => open('material', r.id)}
                onDelete={removed('material', r.id)}
                extra={
                  <>
                    {isLecturer && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        onClick={() => openAiQuiz(r.id)}
                        aria-label={`AI Quiz from ${r.title}`}
                        title="Generate 10-question AI quiz from this material"
                      >
                        <Icon name="sparkle" size={14} /> AI Quiz
                      </button>
                    )}
                    {r.kind !== 'link' && (
                      <DownloadButton
                        variant="icon"
                        file={{ id: r.fileId, name: r.file?.name ?? r.title }}
                        label={`Download ${r.title}`}
                      />
                    )}
                  </>
                }
              />
            ))}
          </Section>

          <Section
            id="editor-quizzes"
            icon="sparkle"
            title="Quizzes"
            addLabel={isLecturer ? 'New quiz' : undefined}
            onAdd={isLecturer ? () => open('quiz') : undefined}
            extraActions={
              isLecturer ? (
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={materials.length === 0}
                  onClick={() => openAiQuiz()}
                  title={
                    materials.length
                      ? 'Generate a 10-question quiz in English with AI from a lesson material'
                      : 'Upload a lesson material first'
                  }
                >
                  <Icon name="sparkle" size={16} /> AI Quiz
                </button>
              ) : undefined
            }
            empty={quizzes.length ? null : 'Optional: a short multiple-choice check for the week.'}
          >
            {quizzes.map((q: QuizItem) => {
              if (q.status === 'generating') {
                return (
                  <EditorRow
                    key={q.id}
                    icon={<Spinner size={18} />}
                    title={q.title}
                    meta="Generating 10 English multiple-choice questions in the background..."
                    onDelete={removed('quiz', q.id)}
                  />
                )
              }
              if (q.status === 'failed') {
                return (
                  <EditorRow
                    key={q.id}
                    icon={<Icon name="sparkle" size={18} />}
                    title={q.title}
                    meta={q.errorMessage ? `AI generation failed: ${q.errorMessage}` : 'AI generation failed'}
                    onEdit={isLecturer ? () => open('quiz', q.id) : undefined}
                    onDelete={removed('quiz', q.id)}
                  />
                )
              }
              return (
                <EditorRow
                  key={q.id}
                  icon={<Icon name="sparkle" size={18} />}
                  title={q.title}
                  meta={`${q.questions?.length ?? 0} ${q.questions?.length === 1 ? 'question' : 'questions'}${q.isAiGenerated ? ' · AI generated' : ''}${q.dueAt ? ` · due ${formatShortDate(q.dueAt)}` : ''}`}
                  onEdit={isLecturer ? () => open('quiz', q.id) : undefined}
                  onDelete={removed('quiz', q.id)}
                />
              )
            })}
          </Section>
        </div>
      </div>

      <Modal open={editing !== null} onClose={close} title={title} initialFocus=".form input, .form select">
        {editing && (
          <EditorForm
            editing={editing}
            module={module}
            now={now}
            current={current}
            done={done}
            actions={{ saveModule, saveItem }}
            onCancel={close}
          />
        )}
      </Modal>

      <Modal
        open={aiSourceId !== null}
        onClose={() => setAiSourceId(null)}
        title="AI Quiz"
        initialFocus=".form select, .form input"
      >
        {aiSourceId !== null && (
          <AiQuizForm
            materials={materials}
            initialMaterialId={aiSourceId}
            onCancel={() => setAiSourceId(null)}
            onGenerate={async (contentItemId, customTitle) => {
              await generateAiQuiz({
                moduleId: module.id,
                contentItemId,
                title: customTitle || undefined,
              })
              setAiSourceId(null)
              setMessage('AI quiz generation started in the background. It will appear once ready.')
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function AiQuizForm({
  materials,
  initialMaterialId,
  onGenerate,
  onCancel,
}: {
  materials: ResourceItem[]
  initialMaterialId: string
  onGenerate: (contentItemId: string, customTitle: string) => Promise<void>
  onCancel: () => void
}) {
  const [materialId, setMaterialId] = useState(() => initialMaterialId || materials[0]?.id || '')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!materialId) {
      setError('Select a lesson material to generate the quiz from.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onGenerate(materialId, title.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start AI quiz generation')
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <p className="ai-quiz__hint">
        AI will generate <strong>10 multiple-choice questions</strong> in <strong>English</strong> in the background based on the selected lesson material.
      </p>

      <div className="field">
        <label htmlFor="ai-quiz-material">Lesson material</label>
        <select
          id="ai-quiz-material"
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
          disabled={busy || materials.length === 0}
        >
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
              {m.file?.name ? ` (${m.file.name})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="ai-quiz-title">Quiz title (optional)</label>
        <input
          id="ai-quiz-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Auto-generated from material if left blank"
          disabled={busy}
        />
      </div>

      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}

      <div className="form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={busy || !materialId}>
          <Icon name="sparkle" size={16} /> {busy ? 'Starting...' : 'Generate AI Quiz'}
        </button>
      </div>
    </form>
  )
}

function EditorForm({
  editing,
  module,
  now,
  current,
  done,
  actions,
  onCancel,
}: {
  editing: Editing
  module: CourseModule
  now: Date
  current: CourseModule['items'][number] | undefined
  done: (text: string) => (run: Promise<string | void | undefined>) => Promise<void>
  actions: Pick<ReturnType<typeof useCourses>, 'saveModule' | 'saveItem'>
  onCancel: () => void
}) {
  const verb = editing.id ? 'saved' : 'added'
  const idFor = () => editing.id ?? newId(editing.kind)

  switch (editing.kind) {
    case 'module':
      return <ModuleForm module={module} onCancel={onCancel} onSave={(patch) => done('Module saved.')(actions.saveModule(module.id, patch))} />
    case 'material':
      return (
        <MaterialForm
          item={current?.type === 'resource' ? current : undefined}
          onCancel={onCancel}
          onSave={(d) => done(`Material ${verb}.`)(actions.saveItem(draftToMaterial(d, module.id, idFor())))}
        />
      )
    case 'task':
      return (
        <TaskForm
          module={module}
          now={now}
          item={current?.type === 'assignment' ? current : undefined}
          onCancel={onCancel}
          onSave={(d) => done(`Task ${verb}.`)(actions.saveItem(draftToTask(d, module.id, idFor())))}
        />
      )
    case 'quiz':
      return (
        <QuizForm
          item={current?.type === 'quiz' ? current : undefined}
          onCancel={onCancel}
          onSave={(d) => done(`Quiz ${verb}.`)(actions.saveItem(draftToQuiz(d, module.id, idFor())))}
        />
      )
  }
}

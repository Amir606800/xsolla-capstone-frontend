import { DownloadButton } from '../../../components/DownloadButton'
import { Icon } from '../../../components/Icon'
import type { ContentItem, CourseModule } from '../../../types/course'
import { ITEM_TYPE_LABEL, itemAuthor, kindLabel } from '../../../utils/adminContent'
import { formatDateTime } from '../../../utils/date'
import { formatBytes } from '../../../utils/files'

/** Everything about one task, resource or quiz, as the admin sees it (quiz answers included). */
export function ItemDetails({ item, module, nameOf }: { item: ContentItem; module: CourseModule; nameOf: (id: number | undefined) => string }) {
  const author = item.createdBy !== undefined ? nameOf(item.createdBy) : `${nameOf(itemAuthor(item, module))} (module lecturer)`

  return (
    <div className="admin-details">
      <dl className="admin-dl">
        <Row label="Type">{ITEM_TYPE_LABEL[item.type]}</Row>
        <Row label="Module">
          Module {module.position} · {module.title}
        </Row>
        <Row label="Lecturer">{author}</Row>
        <Row label="Students see it">{item.hidden ? 'No, it is hidden' : 'Yes'}</Row>

        {item.type === 'assignment' && <Row label="Due">{formatDateTime(item.dueAt)}</Row>}
        {item.type === 'quiz' && <Row label="Due">{item.dueAt ? formatDateTime(item.dueAt) : 'No due date'}</Row>}
        {item.type === 'resource' && <Row label="Kind">{kindLabel(item.kind)}</Row>}

        {item.type === 'resource' && item.kind === 'link' && (
          <Row label="Link">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="admin-link admin-break">
                {item.url} <Icon name="external" size={14} />
              </a>
            ) : (
              'No link'
            )}
          </Row>
        )}
        {item.type === 'resource' && item.kind !== 'link' && (
          <Row label="File">
            <span className="admin-file">
              <span>
                {item.file?.name ?? item.title}
                {item.file ? ` · ${formatBytes(item.file.sizeBytes)}` : ''}
              </span>
              <DownloadButton variant="icon" file={{ id: item.fileId, name: item.file?.name ?? item.title }} label={`Download ${item.title}`} />
            </span>
          </Row>
        )}

        <Row label="Description">{item.description ? <span className="admin-pre">{item.description}</span> : 'None'}</Row>
        <Row label="Item id">
          <code>{item.id}</code>
        </Row>
      </dl>

      {item.type === 'assignment' && (
        <section aria-labelledby="item-reqs">
          <h3 id="item-reqs" className="admin-details__heading">
            What to hand in
          </h3>
          {item.requirements?.length ? (
            <ul className="admin-details__list">
              {item.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="admin-muted">Nothing listed.</p>
          )}
        </section>
      )}

      {item.type === 'quiz' && (
        <section aria-labelledby="item-questions">
          <h3 id="item-questions" className="admin-details__heading">
            Questions
          </h3>
          {item.questions?.length ? (
            <ol className="admin-quiz">
              {item.questions.map((q) => (
                <li key={q.id}>
                  <p className="admin-quiz__prompt">{q.prompt}</p>
                  <ul className="admin-quiz__options">
                    {q.options.map((o, i) => (
                      <li key={i} className={i === q.correct ? 'is-correct' : undefined}>
                        {i === q.correct && <Icon name="check" size={14} />} {o}
                        {i === q.correct && <span className="sr-only"> (correct answer)</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : (
            <p className="admin-muted">No questions yet.</p>
          )}
        </section>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="admin-dl__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

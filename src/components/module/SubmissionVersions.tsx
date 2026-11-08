import type { SubmissionFile, SubmissionVersion } from '../../types/course'
import { formatDateTime } from '../../utils/date'
import { formatBytes } from '../../utils/files'
import { DownloadButton } from '../DownloadButton'
import { Icon } from '../Icon'

/** Handed-in files, each with a download button. */
export function FileList({ files, label }: { files: SubmissionFile[]; label: string }) {
  return (
    <ul className="submission__files" aria-label={label}>
      {files.map((f) => (
        <li key={f.id ?? `${f.name}:${f.sizeBytes}`}>
          <Icon name="file" size={16} /> {f.name} <span>{formatBytes(f.sizeBytes)}</span>
          <DownloadButton variant="icon" file={f} />
        </li>
      ))}
    </ul>
  )
}

/** The versions handed in before the current one, newest first. Folded away until opened. */
export function EarlierVersions({ history, total }: { history: SubmissionVersion[]; total: number }) {
  return (
    <details className="submission__history">
      <summary>
        Earlier versions ({history.length})
      </summary>
      <ol className="submission__versions" aria-label="Earlier versions">
        {history.map((v, i) => (
          <li key={v.submittedAt} className="submission__version">
            <p className="submission__version-head">
              Version {total - 1 - i} · {formatDateTime(v.submittedAt)}
            </p>
            {v.textBody && <p className="submission__text">{v.textBody}</p>}
            {v.files && v.files.length > 0 && <FileList files={v.files} label={`Files of version ${total - 1 - i}`} />}
            {!v.textBody && !v.files?.length && <p className="submission__muted">Nothing but the hand-in time.</p>}
          </li>
        ))}
      </ol>
    </details>
  )
}

import { useState } from 'react'
import { downloadFile, type DownloadableFile } from '../api/files'
import { Icon } from './Icon'

/**
 * Downloads one file (a material or handed-in work). Shown to everyone who can see the file:
 * students, lecturers and mentors. A failure (e.g. not allowed) is shown right next to it.
 */
export function DownloadButton({
  file,
  label,
  variant = 'ghost',
}: {
  file: DownloadableFile
  /** What the button says to screen readers, e.g. "Download Slides". */
  label?: string
  /** 'ghost' = a normal button, 'icon' = a small icon-only button for tight rows. */
  variant?: 'ghost' | 'icon'
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setBusy(true)
    setError('')
    try {
      await downloadFile(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The download failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="download">
      <button
        type="button"
        className={variant === 'icon' ? 'icon-btn' : 'btn btn--ghost btn--small download__btn'}
        onClick={run}
        disabled={busy}
        aria-label={label ?? `Download ${file.name}`}
        title="Download"
      >
        <Icon name="download" size={16} />
        {variant === 'ghost' && <span>{busy ? 'Downloading…' : 'Download'}</span>}
      </button>
      {error && (
        <span className="download__error" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}

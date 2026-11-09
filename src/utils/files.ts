/** Client-side pre-check only; the server enforces the same rules (413 / 415). */
export const ALLOWED_EXTENSIONS = ['pdf', 'pptx', 'md', 'zip'] as const
export const MAX_FILE_BYTES = 20 * 1024 * 1024

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Returns an error message, or null when the file is acceptable. */
export function validateFile(file: { name: string; size: number }): string | null {
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
    return `${file.name}: only ${ALLOWED_EXTENSIONS.join(', ')} files are allowed`
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name}: file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`
  }
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

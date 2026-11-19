/**
 * Each page's code is a separate file whose name changes with every build. A tab left open across a new
 * deploy (or a restart of the dev server) still asks for the old file names, the download fails, and the page
 * cannot be shown. Loading the page again fetches the current index.html, which names the new files.
 */

const KEY = 'stale_build_reload_at'
/** A second failure this soon after a reload means reloading does not help (e.g. the server is down): stop. */
const WINDOW_MS = 10_000

/** True for the errors a browser gives when a page's code file cannot be downloaded. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    error.message,
  )
}

/**
 * Reloads the page, unless it was already reloaded for this reason in the last few seconds.
 * Returns true when it reloads.
 */
export function reloadOnceForStaleBuild(now = Date.now(), reload: () => void = () => window.location.reload()): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY))
    if (last && now - last < WINDOW_MS) return false
    sessionStorage.setItem(KEY, String(now))
  } catch {
    // storage unavailable: without the marker a reload could repeat forever, so do not reload
    return false
  }
  reload()
  return true
}

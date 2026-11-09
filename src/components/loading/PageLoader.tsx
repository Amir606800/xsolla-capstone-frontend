import { XsollaLogo } from '../XsollaLogo'
import { Spinner } from './Spinner'

/**
 * What a page shows while its code is still arriving: the Xsolla wordmark above a spinner, centred.
 * `fullscreen` fills the window (before the app shell exists); otherwise it fills the page area.
 */
export function PageLoader({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div className={`page-loader${fullscreen ? ' page-loader--full' : ''}`} role="progressbar" aria-label="Loading the page" aria-busy="true">
      {/* decoration: the loader is already labelled, and the page itself has its own logo */}
      <span aria-hidden="true">
        <XsollaLogo className="page-loader__logo" />
      </span>
      <Spinner size={28} />
    </div>
  )
}

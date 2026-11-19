import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { isChunkLoadError, reloadOnceForStaleBuild } from '../utils/staleBuild'
import { PageLoader } from './loading/PageLoader'
import './app-error.css'

interface Props {
  children: ReactNode
  /** When this changes (the person goes to another page), the error is forgotten and the page is tried again. */
  resetKey?: string
}

interface State {
  error: Error | null
  reloading: boolean
}

/**
 * Without this, an error while showing a page removes the whole app and leaves an empty screen.
 * A page whose code file can no longer be downloaded (a new deploy since the tab was opened) reloads the page once;
 * any other error shows a message with a Reload button.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadOnceForStaleBuild()) {
      this.setState({ reloading: true })
      return
    }
    console.error('The page could not be shown', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, reloading: false })
  }

  render() {
    const { error, reloading } = this.state
    if (!error) return this.props.children
    if (reloading) return <PageLoader fullscreen />
    const stale = isChunkLoadError(error)
    return (
      <div className="app-error" role="alert">
        <h1 className="app-error__title">{stale ? 'A newer version is available' : 'Something went wrong'}</h1>
        <p className="app-error__text">
          {stale
            ? 'This page could not be loaded. Reload to get the latest version.'
            : 'This page could not be shown. Reloading usually fixes it.'}
        </p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}

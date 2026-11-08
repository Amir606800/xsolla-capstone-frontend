import { useEffect, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/Icon'
import { LINKS } from '../config/links'
import { goTo, prefersReducedMotion } from '../utils/teleport'
import '../styles/ui.css'
import './OfficeTourPage.css'

/** A screenshot of the tour, shown blurred so it does not spoil it. Put the real one here. */
const PREVIEW_SRC = '/office-tour/preview.jpg'

/** How long the teleport plays before the tour page takes over (OfficeTourPage.css ends by 1s). */
export const TELEPORT_MS = 1100

/** Where the frame's picture was on screen when it was clicked, as a share of the screen. */
type Launch = { top: number; left: number; sx: number; sy: number }

/** Runs `fn` after the browser has painted twice, so new layers are ready before anything moves. */
function afterPaint(fn: () => void): () => void {
  if (typeof window.requestAnimationFrame !== 'function') {
    fn()
    return () => {}
  }
  let second = 0
  const first = window.requestAnimationFrame(() => {
    second = window.requestAnimationFrame(fn)
  })
  return () => {
    window.cancelAnimationFrame(first)
    window.cancelAnimationFrame(second)
  }
}

/**
 * Office tour: a short story about the office, then a blurred preview of the 360° tour in a
 * viewfinder frame. Hovering (or focusing) shows the play button. Clicking "teleports": the page
 * blurs, the picture grows to fill the screen while it zooms in and sharpens, a fade to dark, and the
 * tour opens in this tab (Back returns here). Ctrl/Cmd/middle click still opens a new tab, without the animation.
 * The text is a first draft: edit it freely.
 */
export default function OfficeTourPage() {
  // without a screenshot yet, an abstract picture stands in (it is blurred anyway)
  const [hasPreview, setHasPreview] = useState(true)
  const [launch, setLaunch] = useState<Launch | null>(null)
  const [playing, setPlaying] = useState(false)

  // coming back with the Back button may restore this page as it was left: clear the teleport
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setLaunch(null)
        setPlaying(false)
      }
    }
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  useEffect(() => {
    if (!launch) return
    const cancel = afterPaint(() => setPlaying(true))
    const timer = window.setTimeout(() => goTo(LINKS.officeTour), TELEPORT_MS)
    return () => {
      cancel()
      window.clearTimeout(timer)
    }
  }, [launch])

  function startTour(e: MouseEvent<HTMLAnchorElement>) {
    // a new tab (ctrl/cmd/shift/middle click) is the browser's job
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (launch) return
    if (prefersReducedMotion()) {
      goTo(LINKS.officeTour)
      return
    }
    // start from the picture inside the frame, so the frame stays behind and the picture lifts out
    const picture = e.currentTarget.querySelector('.tour__view') ?? e.currentTarget
    const box = picture.getBoundingClientRect()
    const w = window.innerWidth || 1
    const h = window.innerHeight || 1
    setLaunch({ top: box.top, left: box.left, sx: Math.max(box.width / w, 0.01), sy: Math.max(box.height / h, 0.01) })
  }

  const scene = (cls: string) =>
    hasPreview ? <img className={`tour__img ${cls}`} src={PREVIEW_SRC} alt="" decoding="sync" /> : <span className={`tour__art ${cls}`} />

  return (
    <section className="office">
      <header className="office__intro">
        <p className="office__eyebrow">
          <Icon name="tour" size={16} /> Office tour
        </p>
        <h1 className="page-title">Welcome to your office</h1>
        <p className="page-subtitle">Before your first day on site, take a walk through the place you will be working from.</p>
      </header>

      <div className="office__story">
        <p>
          Every journey at Xsolla School Baku starts at the same door. Step inside and look around: this is where your team will
          meet, build, argue about code and celebrate the first green pipeline.
        </p>
        <p>
          Walk through the space where the teams sit together, find the rooms for your 1:1s with your mentor, and the spot where
          everyone gathers for the lectures.
        </p>
        <p>
          Look in every direction, take your time, and come back whenever you like. When you arrive on your first day, you will
          already know your way around.
        </p>
      </div>

      <a
        className={`tour${launch ? ' is-launching' : ''}`}
        href={LINKS.officeTour}
        rel="noopener noreferrer"
        onClick={startTour}
        aria-label="Start the 360° office tour"
      >
        <span className="tour__view" aria-hidden="true">
          <span className="tour__art" />
          {hasPreview && <img className="tour__img" src={PREVIEW_SRC} alt="" onError={() => setHasPreview(false)} />}
        </span>

        {/* viewfinder corners */}
        <span className="tour__corner tour__corner--tl" aria-hidden="true" />
        <span className="tour__corner tour__corner--tr" aria-hidden="true" />
        <span className="tour__corner tour__corner--bl" aria-hidden="true" />
        <span className="tour__corner tour__corner--br" aria-hidden="true" />

        <span className="tour__badge" aria-hidden="true">
          <Icon name="tour" size={16} /> 360°
        </span>
        <span className="tour__play" aria-hidden="true">
          <Icon name="play" size={34} />
        </span>
        <span className="tour__hint" aria-hidden="true">
          Start the tour <Icon name="external" size={14} />
        </span>
      </a>
      <p className="office__note">
        No spoilers here: the picture stays blurred until you step in. Use Back to return to the LMS.
      </p>

      {launch &&
        createPortal(
          <div
            className={`teleport${playing ? ' is-playing' : ''}`}
            style={
              {
                '--t': `${launch.top}px`,
                '--l': `${launch.left}px`,
                '--sx': launch.sx,
                '--sy': launch.sy,
              } as CSSProperties
            }
          >
            <div className="teleport__veil" aria-hidden="true" />
            <div className="teleport__portal" aria-hidden="true">
              <div className="teleport__scene">
                {/* the sharp picture under a blurred copy that fades away */}
                {scene('teleport__sharp')}
                {scene('teleport__blurred')}
              </div>
            </div>
            <div className="teleport__fade" aria-hidden="true" />
            <p className="teleport__label" role="status">
              Teleporting to the office…
            </p>
          </div>,
          document.body,
        )}
    </section>
  )
}

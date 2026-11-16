import type { ReactNode } from 'react'
import { Icon } from '../../../components/Icon'
import type { IconName } from '../../../components/Icon'
import type { Tone, Verdict } from '../../../utils/personAnalytics'
import { Donut, SliceLegend } from './Donut'
import type { Slice } from './Donut'

const TONE_ICON: Record<Tone, IconName> = { good: 'check', warn: 'clock', bad: 'alert', none: 'minus' }

export interface Tile {
  label: string
  value: string
  /** What the value is made of ("6 of 8 deadlines"), so a share is never shown without its base. */
  hint?: string
}

/**
 * The first thing on a person's analytics page: how they are doing, in one look. The ring shows the split the verdict is
 * based on, the verdict says it in words (with an icon, so the colour is never the only sign), and the tiles give the
 * few numbers an admin asks about next.
 */
export function GlanceCard({
  title = 'At a glance',
  verdict,
  ring,
  tiles,
  children,
}: {
  title?: string
  verdict: Verdict
  ring: { slices: Slice[]; center: string; sub?: string; label: string }
  tiles: Tile[]
  children?: ReactNode
}) {
  return (
    <section className="admin-panel glance" aria-label={title}>
      <h2 className="admin-section-title">{title}</h2>
      <div className="glance__body">
        <Donut slices={ring.slices} center={ring.center} sub={ring.sub} label={ring.label} />
        <div className="glance__main">
          <p className={`glance__verdict glance__verdict--${verdict.tone}`}>
            <Icon name={TONE_ICON[verdict.tone]} size={18} />
            <strong>{verdict.title}</strong>
          </p>
          <p className="glance__text">{verdict.text}</p>
          <SliceLegend slices={ring.slices} label={`${ring.label} key`} />
        </div>
        <dl className="glance__tiles">
          {tiles.map((t) => (
            <div className="glance__tile" key={t.label}>
              <dt>{t.label}</dt>
              <dd>
                <strong>{t.value}</strong>
                {t.hint && <span>{t.hint}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {children}
    </section>
  )
}

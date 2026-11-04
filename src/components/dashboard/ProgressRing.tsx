import { memo } from 'react'
import type { ReactNode } from 'react'

interface ProgressRingProps {
  percent: number // 0-100
  size: number
  stroke: number
  children?: ReactNode
}

function ProgressRingBase({ percent, size, stroke, children }: ProgressRingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children && <div className="ring__content">{children}</div>}
    </div>
  )
}

export const ProgressRing = memo(ProgressRingBase)

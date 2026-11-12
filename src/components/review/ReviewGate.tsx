import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useMentorReview } from '../../hooks/useMentorReview'
import { Icon } from '../Icon'
import './review.css'

export const REVIEW_PATH = '/mentor-review'

/**
 * Around every LMS page. A student who owes last week's mentor review is sent to the form whatever they open;
 * during the weekend of the running week a reminder sits on top of the page instead.
 */
export function ReviewGate({ children }: { children: ReactNode }) {
  const { due, mentor } = useMentorReview()
  const { pathname } = useLocation()
  const onForm = pathname === REVIEW_PATH

  if (due?.locked && !onForm) return <Navigate to={REVIEW_PATH} replace />

  return (
    <>
      {due && !due.locked && !onForm && (
        <aside className="review-reminder" aria-label="Weekly mentor review">
          <Icon name="alert" size={20} />
          <p>
            <strong>Review your week with {mentor?.name ?? 'your mentor'}.</strong> It takes two minutes. When week {due.module.position} is
            over, the LMS stays locked until the review is sent.
          </p>
          <Link className="btn" to={REVIEW_PATH}>
            Review now
          </Link>
        </aside>
      )}
      {children}
    </>
  )
}

import { createContext } from 'react'
import type { MentorReview } from '../types/mentorReview'
import type { Person } from '../types/team'
import type { ReviewDue } from '../utils/mentorReview'
import type { LoadStatus } from './courses'

export interface MentorReviewContextValue {
  /** 'ready' also for people who never owe a review (staff, students without a mentor, a server without the feature). */
  status: LoadStatus
  /** The review the student owes now, if any. `locked` = nothing else can be opened first. */
  due: ReviewDue | null
  /** Who is reviewed: the mentor of the student's team. */
  mentor: Person | null
  submit: (review: MentorReview) => Promise<void>
  reload: () => void
}

export const MentorReviewContext = createContext<MentorReviewContextValue | null>(null)

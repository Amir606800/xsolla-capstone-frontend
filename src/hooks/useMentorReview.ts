import { useContext } from 'react'
import { MentorReviewContext } from '../context/mentorReview'

export function useMentorReview() {
  const ctx = useContext(MentorReviewContext)
  if (!ctx) throw new Error('useMentorReview must be used inside <MentorReviewProvider>')
  return ctx
}

import { useCallback, useEffect, useState } from 'react'
import { fetchLectureForm, fetchPendingLectures, sendLectureFeedback } from '../api/lectureFeedback'
import type { FormQuestion, LectureAnswers, PendingLecture } from '../types/lectureFeedback'
import { LECTURE_FORM } from '../utils/lectureFeedback'
import { isStudent } from '../utils/roles'
import { useAuth } from './useAuth'

/**
 * The lectures a student can give feedback on right now, and the form to do it with. Only students are asked; for
 * anyone else, or a server without the routes, or a failed load, there is simply nothing to show (it is a side feature
 * of the module page, never a reason to show an error). A lecture that was sent moves to `sent` so the page can
 * thank the student instead of making the row vanish.
 */
export function useLectureFeedback() {
  const { user } = useAuth()
  const studentId = user && isStudent(user) ? user.id : null
  const [open, setOpen] = useState<PendingLecture[]>([])
  const [sent, setSent] = useState<PendingLecture[]>([])
  const [form, setForm] = useState<FormQuestion[]>(LECTURE_FORM)

  useEffect(() => {
    if (studentId === null) return
    let alive = true
    Promise.all([fetchPendingLectures(studentId), fetchLectureForm()]).then(
      ([lectures, questions]) => {
        if (!alive) return
        setOpen(lectures ?? [])
        setForm(questions)
      },
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [studentId])

  /** Sends the form of one lecture; rejects with the server's message when it is refused. */
  const send = useCallback(
    async (lecture: PendingLecture, answers: LectureAnswers) => {
      if (studentId === null) throw new Error('Only students give lecture feedback.')
      await sendLectureFeedback(studentId, lecture.eventId, form, answers)
      setOpen((list) => list.filter((l) => l.eventId !== lecture.eventId))
      setSent((list) => [...list, lecture])
    },
    [studentId, form],
  )

  return { open, sent, form, send }
}

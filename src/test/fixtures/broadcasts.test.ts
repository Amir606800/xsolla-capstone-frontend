import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../types/calendar'
import { addBroadcast, announcementsFor, isAnnouncementId, listBroadcasts, markAnnouncementsRead, noticeForSavedEvent } from './broadcasts'

const NOW = new Date('2026-11-07T12:00:00Z')
const student = { id: 1, roles: ['student' as const] }
const mentor = { id: 2, roles: ['mentor' as const] }
const sent = (audience: 'all' | 'students' | 'mentors' | 'lecturers', message: string, at = NOW) => addBroadcast({ message, link: '', audience }, 10, 'Admin', at)

describe('announcements store', () => {
  it('keeps what was sent, newest first', () => {
    sent('all', 'older', new Date('2026-11-06T09:00:00Z'))
    sent('students', ' newer ')
    expect(listBroadcasts().map((b) => b.message)).toEqual(['newer', 'older'])
    expect(listBroadcasts()[0]).toMatchObject({ audience: 'students', recipients: 10, sentBy: 'Admin' })
  })

  it('each person gets only the announcements meant for them, as notifications', () => {
    sent('all', 'for all')
    sent('students', 'for students')
    expect(announcementsFor(student, NOW).map((n) => n.message).sort()).toEqual(['for all', 'for students'])
    expect(announcementsFor(mentor, NOW).map((n) => n.message)).toEqual(['for all'])
    expect(announcementsFor({ id: 9, roles: ['admin'] }, NOW)).toEqual([])
    expect(announcementsFor(student, NOW)[0]).toMatchObject({ type: 'announcement', readAt: null })
    expect(isAnnouncementId(announcementsFor(student, NOW)[0].id)).toBe(true)
    expect(isAnnouncementId('n1')).toBe(false)
  })

  it('a lecturer role that has ended no longer receives lecturer announcements', () => {
    sent('lecturers', 'lecturers only')
    const temp = { id: 3, roles: ['mentor' as const, 'lecturer' as const], roleUntil: { lecturer: '2026-11-01T00:00:00Z' } }
    expect(announcementsFor(temp, NOW)).toEqual([])
    expect(announcementsFor({ ...temp, roleUntil: { lecturer: '2026-12-01T00:00:00Z' } }, NOW)).toHaveLength(1)
  })

  it('reading is remembered per person', () => {
    sent('all', 'hello')
    const [n] = announcementsFor(student, NOW)
    markAnnouncementsRead(1, [n.id, 'n1'])
    expect(announcementsFor(student, NOW)[0].readAt).not.toBeNull()
    expect(announcementsFor(mentor, NOW)[0].readAt).toBeNull()
  })

  it('survives broken storage', () => {
    localStorage.setItem('broadcasts', '{nope')
    expect(listBroadcasts()).toEqual([])
  })
})

describe('lecture link notices', () => {
  const lecture: CalendarEvent = { id: 'lec', title: 'Lecture', kind: 'lecture', startsAt: new Date(2026, 10, 9, 10).toISOString(), endsAt: new Date(2026, 10, 9, 12).toISOString() }
  const LINK = 'https://meet.google.com/abc-defg-hij'
  const SOON = new Date(2026, 10, 8, 9)

  it('adding a link tells the students: it opens the calendar and is not in the admin history', () => {
    noticeForSavedEvent(lecture, { ...lecture, meetingUrl: LINK }, SOON)
    const [n] = announcementsFor(student, SOON)
    expect(n).toMatchObject({ type: 'event', link: '/calendar', message: 'Lecture, Mon, Nov 9, 10:00: the meeting link is ready.', readAt: null })
    expect(listBroadcasts()).toEqual([]) // the admin did not send it
    expect(announcementsFor(mentor, SOON)).toEqual([]) // lecture links are for students
  })

  it('changing the link tells them again, in other words; saving the same link tells nobody', () => {
    const first = { ...lecture, meetingUrl: LINK }
    noticeForSavedEvent(undefined, first, SOON)
    noticeForSavedEvent(first, { ...first, title: 'Lecture' }, SOON) // same link
    expect(announcementsFor(student, SOON)).toHaveLength(1)
    noticeForSavedEvent(first, { ...first, meetingUrl: 'https://meet.google.com/xyz-xyzz-xyz' }, new Date(2026, 10, 8, 10))
    const all = announcementsFor(student, SOON)
    expect(all).toHaveLength(2)
    expect(all[0].message).toBe('Lecture, Mon, Nov 9, 10:00: the meeting link was changed.')
  })

  it('no notice for a lecture that is over, for other kinds, or when the link is taken away', () => {
    noticeForSavedEvent(undefined, { ...lecture, meetingUrl: LINK }, new Date(2026, 10, 9, 13)) // already over
    noticeForSavedEvent(undefined, { ...lecture, kind: 'meeting', meetingUrl: LINK }, SOON)
    noticeForSavedEvent({ ...lecture, meetingUrl: LINK }, lecture, SOON) // link removed
    expect(announcementsFor(student, SOON)).toEqual([])
  })

  it('reading it is remembered like any announcement', () => {
    noticeForSavedEvent(undefined, { ...lecture, meetingUrl: LINK }, SOON)
    const [n] = announcementsFor(student, SOON)
    markAnnouncementsRead(1, [n.id])
    expect(announcementsFor(student, SOON)[0].readAt).not.toBeNull()
  })
})

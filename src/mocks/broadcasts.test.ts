import { describe, expect, it } from 'vitest'
import { addBroadcast, announcementsFor, isAnnouncementId, listBroadcasts, markAnnouncementsRead } from './broadcasts'

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

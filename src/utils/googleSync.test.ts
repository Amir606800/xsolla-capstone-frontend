import { describe, expect, it } from 'vitest'
import { savedNotice, profilePath } from './googleSync'

describe('savedNotice', () => {
  it('says nothing more when Google was not asked for', () => {
    expect(savedNotice('Event added.', 'not-asked')).toEqual({ text: 'Event added.', warn: false })
  })
  it('adds that it is on the Google Calendar when it arrived', () => {
    expect(savedNotice('Event added.', 'synced')).toEqual({ text: 'Event added. It is on your Google Calendar too.', warn: false })
  })
  it('warns, and says the event itself is saved, when the Google copy did not arrive', () => {
    const n = savedNotice('Event added.', 'failed')
    expect(n.warn).toBe(true)
    expect(n.text).toMatch(/^Event added\. But it did not reach your Google Calendar/)
  })
})

describe('savedNotice: a meeting link the server did not keep', () => {
  it('says so and makes it a warning', () => {
    expect(savedNotice('Event saved.', 'not-asked', { meetingLinkLost: true })).toEqual({
      text: 'Event saved. The server did not keep the meeting link.',
      warn: true,
    })
    expect(savedNotice('Event added.', 'synced', { meetingLinkLost: true }).warn).toBe(true)
  })
})

describe('profilePath', () => {
  it('sends admins to their own section and everyone else to the LMS settings', () => {
    expect(profilePath({ roles: ['admin'] })).toBe('/admin/profile')
    expect(profilePath({ roles: ['lecturer'] })).toBe('/profile')
    expect(profilePath(null)).toBe('/profile')
  })
})

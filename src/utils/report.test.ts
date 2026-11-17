import { describe, expect, it } from 'vitest'
import { EMPTY_REPORT, MAX_MESSAGE, reportMessage, reportSubject, validateReport } from './report'

const good = { about: 'mentor' as const, who: ' Rashad Aliyev ', title: ' Missed two 1:1s ', message: ' He did not come twice. ' }

describe('a report', () => {
  it('needs what it is about, a title and what happened; who is optional', () => {
    expect(validateReport(EMPTY_REPORT)).toEqual({
      about: 'Pick what the report is about.',
      title: 'Give the report a short title.',
      message: 'Write what happened.',
    })
    expect(validateReport({ ...good, who: '' })).toEqual({})
    expect(validateReport({ ...good, message: 'x'.repeat(MAX_MESSAGE + 1) }).message).toMatch(/under/)
  })

  it('puts what (and who) it is about at the start of the subject and the message, as the server has no field for it', () => {
    expect(reportSubject(good)).toBe('A mentor: Rashad Aliyev · Missed two 1:1s')
    expect(reportMessage(good)).toBe('About: A mentor (Rashad Aliyev)\n\nHe did not come twice.')
    expect(reportSubject({ ...good, about: 'school', who: '' })).toBe('The school · Missed two 1:1s')
  })

  it('stays inside the server limits (subject 200, message 5000)', () => {
    expect(reportSubject({ ...good, title: 'x'.repeat(300) }).length).toBe(200)
    expect(reportMessage({ ...good, message: 'x'.repeat(6000) }).length).toBe(5000)
  })
})

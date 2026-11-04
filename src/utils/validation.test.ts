import { describe, expect, it } from 'vitest'
import { isValidEmail, isValidPassword, passwordsMatch } from './validation'

describe('isValidEmail', () => {
  it.each(['a@b.co', 'user.name+tag@example.com', 'x@sub.domain.org'])('accepts %s', (v) => {
    expect(isValidEmail(v)).toBe(true)
  })

  it.each(['', 'plain', 'a@b', '@b.com', 'a b@c.com', 'a@b c.com'])('rejects "%s"', (v) => {
    expect(isValidEmail(v)).toBe(false)
  })
})

describe('isValidPassword', () => {
  it('sign in: any non-empty password is valid', () => {
    expect(isValidPassword('x', false)).toBe(true)
    expect(isValidPassword('', false)).toBe(false)
  })

  it('sign up: requires at least 8 characters', () => {
    expect(isValidPassword('1234567', true)).toBe(false)
    expect(isValidPassword('12345678', true)).toBe(true)
    expect(isValidPassword('', true)).toBe(false)
  })
})

describe('passwordsMatch', () => {
  it('compares exactly', () => {
    expect(passwordsMatch('abc', 'abc')).toBe(true)
    expect(passwordsMatch('abc', 'abC')).toBe(false)
    expect(passwordsMatch('abc', '')).toBe(false)
  })
})

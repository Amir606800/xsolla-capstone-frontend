import { describe, expect, it } from 'vitest'
import { emailError, nameError, passwordError, passwordProblems } from './credentials'

describe('passwords the admin sets', () => {
  it('a good password breaks no rule', () => {
    expect(passwordProblems('Tq7mWz4kPd')).toEqual([])
    expect(passwordError('Tq7mWz4kPd')).toBe('')
  })

  it('needs 10 to 72 characters, a lowercase and an uppercase letter, a number, and no spaces', () => {
    expect(passwordProblems('Tq7mWz4')).toEqual(['length'])
    expect(passwordProblems(`Tq7${'m'.repeat(70)}`)).toContain('length')
    expect(passwordProblems('TQ7MWZ4KPD')).toEqual(['lower'])
    expect(passwordProblems('tq7mwz4kpd')).toEqual(['upper'])
    expect(passwordProblems('TqxmWzrkPd')).toEqual(['digit'])
    expect(passwordProblems('Tq7m Wz4kPd')).toEqual(['spaces'])
  })

  it('refuses easy-to-guess ones', () => {
    for (const weak of ['Password123', 'Qwerty2026x', 'Xsolla2026!', 'Abc123456789', 'Zzzzz9aaaaB', 'Aa1Aa1Aa1Aa1', 'Welcome2Baku']) {
      expect(passwordProblems(weak), weak).toContain('common')
    }
  })

  it('refuses the person’s own name or e-mail inside it', () => {
    const owner = { name: 'Leyla Hasanova', email: 'l.hasanova@example.com' }
    expect(passwordProblems('Leyla2026Kp', owner)).toEqual(['personal'])
    expect(passwordProblems('HASANOVA7kq', owner)).toEqual(['personal'])
    expect(passwordProblems('Tq7mWz4kPd', owner)).toEqual([])
  })

  it('says the first problem in plain words', () => {
    expect(passwordError('')).toBe('Enter a password.')
    expect(passwordError('short1A')).toBe('Use 10 to 72 characters.')
    expect(passwordError('Password123')).toBe('This password is too easy to guess.')
    expect(passwordError('Leyla2026Kp', { name: 'Leyla Hasanova' })).toBe('The password must not contain their name or e-mail.')
  })
})

describe('e-mail addresses for accounts', () => {
  it('accepts real-looking addresses', () => {
    for (const ok of ['ann@x.co', 'leyla.hasanova@example.com', 'nil+school@mail.xsolla.az', 'a_b-c@sub.domain.school', '  ann@x.co  ']) {
      expect(emailError(ok), ok).toBe('')
    }
  })

  it('refuses made-up or broken ones', () => {
    for (const bad of ['ann', 'ann@', '@x.co', 'ann@x', 'ann@x.c', 'ann@x.123', 'a..b@x.co', '.ann@x.co', 'ann.@x.co', 'ann@-x.co', 'ann@x-.co', 'an n@x.co', 'ann@@x.co']) {
      expect(emailError(bad), bad).toBe('Enter a real e-mail address, like name@example.com.')
    }
    expect(emailError('')).toBe('Enter their e-mail address.')
    expect(emailError(`${'a'.repeat(65)}@x.co`)).toBe('This e-mail address is too long.')
  })

  it('refuses throwaway mailboxes', () => {
    expect(emailError('someone@mailinator.com')).toBe('Throwaway mailboxes cannot be used: enter their real address.')
    expect(emailError('someone@eu.yopmail.com')).toBe('Throwaway mailboxes cannot be used: enter their real address.')
  })
})

describe('full names for accounts', () => {
  it('accepts first and last names, with accents, hyphens and apostrophes', () => {
    for (const ok of ['Ali Abbasov', 'Gülnar Məmmədova', 'Anna-Maria O’Neil', 'Jean  Luc Picard', "D'Arcy Smith"]) {
      expect(nameError(ok), ok).toBe('')
    }
  })

  it('refuses names that are not real names', () => {
    expect(nameError('')).toBe('Enter their full name.')
    expect(nameError('Ali')).toBe('Enter their first and last name.')
    expect(nameError('Ali A')).toBe('Write the names out in full.')
    expect(nameError('Ali 123')).toBe('Use letters only (spaces, - and ’ are fine).')
    expect(nameError('test@user')).toBe('Use letters only (spaces, - and ’ are fine).')
    expect(nameError('aaa bbb')).toBe('This does not look like a real name.')
    expect(nameError(`${'Ab'.repeat(31)} Smith`)).toBe('Keep the name to 60 characters.')
  })
})

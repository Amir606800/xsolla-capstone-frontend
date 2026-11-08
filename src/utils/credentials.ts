/**
 * Rules for the accounts and passwords an admin creates, so nobody ends up with a made-up e-mail, a
 * name like "asdf" or a password like "12345678". The backend must check the same (BACKEND_REQUIREMENTS).
 * Signing in is not checked against these: existing passwords keep working.
 */

export const MIN_PASSWORD_LENGTH = 10
/** bcrypt only reads the first 72 bytes. */
export const MAX_PASSWORD_LENGTH = 72

export type PasswordRule = 'length' | 'lower' | 'upper' | 'digit' | 'spaces' | 'common' | 'personal'

export const PASSWORD_RULES: { id: PasswordRule; label: string }[] = [
  { id: 'length', label: `${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters` },
  { id: 'lower', label: 'A lowercase letter' },
  { id: 'upper', label: 'An uppercase letter' },
  { id: 'digit', label: 'A number' },
  { id: 'spaces', label: 'No spaces' },
  { id: 'common', label: 'Not a common or easy-to-guess password' },
  { id: 'personal', label: 'Does not contain their name or e-mail' },
]

/** Words and runs that make a password easy to guess wherever they appear in it. */
const WEAK_PARTS = [
  'password', 'passw0rd', 'qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', 'letmein', 'welcome', 'iloveyou', 'monkey', 'dragon',
  'admin', 'login', 'secret', 'xsolla', 'school', 'student', 'mentor', 'lecturer', 'baku',
  '123456', '234567', '345678', '456789', '987654', '654321', 'abcdef', 'bcdefg',
  '111111', '000000', '121212', '112233',
]

/** The person the password is for: it must not contain their name or the start of their e-mail. */
export interface PasswordOwner {
  name?: string
  email?: string
}

/** Pieces of the person's name and e-mail (3+ letters) that must not appear in the password. */
function personalParts({ name = '', email = '' }: PasswordOwner): string[] {
  const local = email.split('@')[0] ?? ''
  return [...name.split(/[\s'’.-]+/), ...local.split(/[._+-]+/), local]
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length >= 3)
}

/** The rules a password breaks (none: it is fine). */
export function passwordProblems(password: string, owner: PasswordOwner = {}): PasswordRule[] {
  const lower = password.toLowerCase()
  const broken: PasswordRule[] = []
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) broken.push('length')
  if (!/\p{Ll}/u.test(password)) broken.push('lower')
  if (!/\p{Lu}/u.test(password)) broken.push('upper')
  if (!/\d/.test(password)) broken.push('digit')
  if (/\s/.test(password)) broken.push('spaces')
  // a weak word or run, 4 of the same character in a row, or only 2-3 different characters
  if (WEAK_PARTS.some((w) => lower.includes(w)) || /(.)\1{3}/.test(password) || (password.length > 0 && new Set(lower).size <= 3)) {
    broken.push('common')
  }
  if (personalParts(owner).some((p) => lower.includes(p))) broken.push('personal')
  return broken
}

/** One sentence for the first rule a password breaks, or '' when it is fine. */
export function passwordError(password: string, owner: PasswordOwner = {}): string {
  if (!password) return 'Enter a password.'
  const first = passwordProblems(password, owner)[0]
  if (!first) return ''
  const messages: Record<PasswordRule, string> = {
    length: `Use ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters.`,
    lower: 'Add a lowercase letter.',
    upper: 'Add an uppercase letter.',
    digit: 'Add a number.',
    spaces: 'Leave out the spaces.',
    common: 'This password is too easy to guess.',
    personal: 'The password must not contain their name or e-mail.',
  }
  return messages[first]
}

// ---------- e-mail ----------

/** Throwaway mailboxes: an account there is lost as soon as the inbox expires. */
const DISPOSABLE = [
  'mailinator.com', 'yopmail.com', 'guerrillamail.com', 'sharklasers.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mintemail.com',
]

// local part: letters, digits and . _ % + - (not starting or ending with a dot); domain: labels of letters,
// digits and inner hyphens; the last label (.com, .az, .school) is letters only, 2 or more
const EMAIL_RE = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._%+-]+(?<!\.)@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/

/** Why an e-mail address cannot be used for an account, or '' when it is fine. */
export function emailError(raw: string): string {
  const email = raw.trim()
  if (!email) return 'Enter their e-mail address.'
  if (email.length > 254 || (email.split('@')[0]?.length ?? 0) > 64) return 'This e-mail address is too long.'
  if (!EMAIL_RE.test(email)) return 'Enter a real e-mail address, like name@example.com.'
  const domain = email.split('@')[1].toLowerCase()
  if (DISPOSABLE.some((d) => domain === d || domain.endsWith(`.${d}`))) return 'Throwaway mailboxes cannot be used: enter their real address.'
  return ''
}

// ---------- name ----------

/** Why a full name cannot be used, or '' when it is fine. First and last name, letters only. */
export function nameError(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) return 'Enter their full name.'
  if (name.length > 60) return 'Keep the name to 60 characters.'
  if (!/^[\p{L}][\p{L}\p{M} '’.-]*$/u.test(name)) return 'Use letters only (spaces, - and ’ are fine).'
  const parts = name.split(' ').filter((p) => /\p{L}/u.test(p))
  if (parts.length < 2) return 'Enter their first and last name.'
  if (parts.some((p) => p.replace(/[^\p{L}]/gu, '').length < 2)) return 'Write the names out in full.'
  // "aaa bbb", "Aaaali": the same letter three times in a row
  if (/(\p{L})\1\1/iu.test(name)) return 'This does not look like a real name.'
  return ''
}

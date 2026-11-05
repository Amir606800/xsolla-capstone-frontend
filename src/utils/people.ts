/** "Leyla Hasanova" -> "LH" (first and last name), "Madonna" -> "M", "" -> "?" */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
  if (letters.length === 0) return '?'
  return letters.length === 1 ? letters[0] : letters[0] + letters[letters.length - 1]
}

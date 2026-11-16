let seq = 0

/** An id for something made in the app before the server gives it one ("ev-lq3k2a0"). */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`

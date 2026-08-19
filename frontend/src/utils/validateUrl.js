/**
 * Checks whether a string is a syntactically valid http/https URL.
 * Does not check whether the URL is reachable or from a supported platform.
 */
export function isValidHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return false
  }

  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

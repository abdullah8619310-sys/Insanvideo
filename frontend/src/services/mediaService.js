const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

/**
 * Requests normalized media information for an Instagram URL.
 * Throws an Error with a user-friendly message on network failure,
 * non-2xx responses, or malformed response bodies.
 */
export async function getMediaInfo(url) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/media/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    throw new Error('Unable to reach the server. Please check your connection and try again.')
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new Error('Received an unexpected response from the server.')
  }

  if (!response.ok) {
    throw new Error(body?.message || 'The server could not process this request.')
  }

  return body
}

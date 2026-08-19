// Thin HTTP client for SocialKit's Instagram Video Download API.
// https://docs.socialkit.dev/api-reference/instagram-download-api
// Request/response shape verified against SocialKit's own documented
// example (JSON body, access_key in body) — not assumed.
const SOCIALKIT_DOWNLOAD_URL = 'https://api.socialkit.dev/instagram/download'
const REQUEST_TIMEOUT_MS = 15000

function isConfigured() {
  return Boolean(process.env.SOCIALKIT_ACCESS_KEY)
}

// SocialKit reports a post with no video (e.g. a plain photo post) as a 404
// with this specific message — verified against a real request, not
// assumed. Distinguishing it from a generic "unavailable" gives users an
// accurate reason instead of the misleading "deleted or unavailable".
function isNoVideoMessage(json) {
  return typeof json?.message === 'string' && /no video in this post/i.test(json.message)
}

// Returns either { ok: true, media: { title, downloadUrl, thumbnail, quality, format } }
// or { ok: false, reason }. Never throws — every failure path (missing key,
// network error, timeout, non-2xx, malformed body) is converted to an
// honest reason so the caller never has to guess.
async function downloadMedia(url, { fetchFn = fetch } = {}) {
  const accessKey = process.env.SOCIALKIT_ACCESS_KEY
  if (!accessKey) {
    return { ok: false, reason: 'not_configured' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response
  try {
    try {
      response = await fetchFn(SOCIALKIT_DOWNLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_key: accessKey, url }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, reason: 'timeout' }
    }
    return { ok: false, reason: 'upstream_failure' }
  }

  if (response.status === 429) {
    return { ok: false, reason: 'blocked' }
  }

  let json = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (response.status === 404 || response.status === 422) {
    return { ok: false, reason: isNoVideoMessage(json) ? 'no_video' : 'unavailable' }
  }
  if (!response.ok) {
    return { ok: false, reason: 'upstream_failure' }
  }
  if (json === null) {
    return { ok: false, reason: 'upstream_failure' }
  }

  const downloadUrl = json?.data?.downloadUrl
  if (!json?.success || typeof downloadUrl !== 'string' || downloadUrl === '') {
    return { ok: false, reason: isNoVideoMessage(json) ? 'no_video' : 'unavailable' }
  }

  return {
    ok: true,
    media: {
      title: json.data.title || null,
      downloadUrl,
      thumbnail: json.data.thumbnail || null,
      // Real fields from SocialKit's documented response — never fabricated.
      // SocialKit returns exactly one quality per request (it's a request
      // parameter, not multiple simultaneous variants), so these describe
      // the single item, not a list to choose from.
      quality: typeof json.data.quality === 'string' ? json.data.quality : null,
      format: typeof json.data.format === 'string' ? json.data.format : null,
    },
  }
}

module.exports = { isConfigured, downloadMedia }

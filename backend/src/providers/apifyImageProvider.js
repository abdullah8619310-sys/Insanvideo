// Thin HTTP client for the "elis/instagram-downloader-api" Apify actor —
// used only as a fallback for Instagram posts with no video (SocialKit
// already confirmed that; this provider is never tried first). Request and
// response shape verified directly against the actor's own OpenAPI schema:
// https://apify.com/elis/instagram-downloader-api/api/openapi
const APIFY_RUN_URL =
  'https://api.apify.com/v2/actors/elis~instagram-downloader-api/run-sync-get-dataset-items'
const REQUEST_TIMEOUT_MS = 30000

function isConfigured() {
  return Boolean(process.env.APIFY_API_TOKEN)
}

// Returns either { ok: true, media: { url, thumbnail, quality } } or
// { ok: false, reason }. Never throws. The actor's dataset item shape is
// { inputUrl, platform, result: [ { url, type, quality, size, thumb }, ... ] }.
//
// Deliberately does NOT filter by `type === 'image'`: a real request against
// this actor for a confirmed photo post returned `type: "video"` with empty
// quality/size — the actor's own type label is unreliable. This function is
// only ever called (see instagramProvider.js) after SocialKit has already
// authoritatively confirmed the post has no video, which is a stronger,
// independently-verified signal than Apify's own mislabeled type field —
// so the first variant with a usable URL is trusted as the non-video media.
async function downloadImage(url, { fetchFn = fetch } = {}) {
  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    return { ok: false, reason: 'not_configured' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response
  try {
    try {
      response = await fetchFn(APIFY_RUN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: [url] }),
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
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'not_configured' }
  }
  if (!response.ok) {
    return { ok: false, reason: 'upstream_failure' }
  }

  let items
  try {
    items = await response.json()
  } catch {
    return { ok: false, reason: 'upstream_failure' }
  }

  const firstEntry = Array.isArray(items) ? items[0] : null
  const variants = Array.isArray(firstEntry?.result) ? firstEntry.result : []
  const mediaVariant = variants.find((variant) => typeof variant?.url === 'string' && variant.url !== '')

  if (!mediaVariant) {
    return { ok: false, reason: 'unavailable' }
  }

  return {
    ok: true,
    media: {
      url: mediaVariant.url,
      thumbnail: typeof mediaVariant.thumb === 'string' ? mediaVariant.thumb : null,
      quality: typeof mediaVariant.quality === 'string' && mediaVariant.quality !== '' ? mediaVariant.quality : null,
    },
  }
}

module.exports = { isConfigured, downloadImage }

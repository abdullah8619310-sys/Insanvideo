const { parseUrl, isHttpProtocol } = require('../utils/urlValidation')
const instagramProvider = require('../providers/instagramProvider')

function validationError(message) {
  return Object.assign(new Error(message), { statusCode: 400 })
}

// Maps a provider failure reason to a clean, user-facing response. Every
// reason here is exercised directly by unit tests; "not_configured" is
// currently reachable through the live route in this environment, since no
// SOCIALKIT_ACCESS_KEY is set (see docs/instagram-download-status.md).
// "not_implemented" is kept for the pre-provider code path and is no longer
// produced by fetchPublicMedia(), but is left mapped in case a future
// provider needs it again.
const FAILURE_RESPONSES = {
  not_implemented: {
    statusCode: 501,
    message: 'Public Instagram media retrieval is not implemented yet.',
  },
  not_configured: {
    statusCode: 503,
    message: 'Media provider is not configured.',
  },
  private: {
    statusCode: 403,
    message: 'Private Instagram content cannot be accessed.',
  },
  unavailable: {
    statusCode: 404,
    message: 'This Instagram content is unavailable or has been deleted.',
  },
  no_video: {
    statusCode: 422,
    message: "This Instagram post doesn't contain a video. InsanVideo currently supports Reels and video posts only.",
  },
  blocked: {
    statusCode: 502,
    message: 'Instagram blocked this request. Please try again later.',
  },
  timeout: {
    statusCode: 504,
    message: 'The request to Instagram timed out. Please try again.',
  },
  upstream_failure: {
    statusCode: 502,
    message: 'Instagram media could not be retrieved right now.',
  },
}

function mapFailure(reason, type) {
  const mapped = FAILURE_RESPONSES[reason] || {
    statusCode: 500,
    message: 'Media could not be processed.',
  }

  return {
    success: false,
    statusCode: mapped.statusCode,
    message: mapped.message,
    data: { platform: 'instagram', type },
  }
}

async function processDownload(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw validationError('Please provide a URL.')
  }

  const parsedUrl = parseUrl(rawUrl)
  if (!parsedUrl || !isHttpProtocol(parsedUrl) || parsedUrl.protocol !== 'https:') {
    throw validationError('Please provide a valid https://www.instagram.com URL.')
  }

  if (!instagramProvider.isInstagramUrl(parsedUrl)) {
    throw validationError('Only Instagram URLs are supported.')
  }

  const type = instagramProvider.detectMediaType(parsedUrl)
  const result = await instagramProvider.fetchPublicMedia(parsedUrl, type)

  if (!result.ok) {
    return mapFailure(result.reason, type)
  }

  return {
    success: true,
    statusCode: 200,
    message: 'Media found successfully.',
    data: result.data,
  }
}

module.exports = { processDownload, mapFailure }

const { parseUrl, isHttpProtocol } = require('../utils/urlValidation')
const instagramProvider = require('../providers/instagramProvider')

function validationError(message) {
  return Object.assign(new Error(message), { statusCode: 400 })
}

async function getMediaInfo(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw validationError('Please provide a URL.')
  }

  const parsedUrl = parseUrl(rawUrl)
  if (!parsedUrl || !isHttpProtocol(parsedUrl)) {
    throw validationError('Please provide a valid http:// or https:// URL.')
  }

  if (!instagramProvider.isInstagramUrl(parsedUrl)) {
    throw validationError('Only Instagram URLs are supported.')
  }

  const type = instagramProvider.detectMediaType(parsedUrl)
  const resolution = await instagramProvider.resolveMedia(parsedUrl, type)

  if (!resolution.implemented) {
    return {
      success: false,
      message: 'Instagram media resolution is not implemented yet.',
      data: { platform: 'instagram', type },
    }
  }

  // Reserved for when a provider actually resolves media.
  return {
    success: true,
    message: 'Media information retrieved.',
    data: resolution.data,
  }
}

module.exports = { getMediaInfo }

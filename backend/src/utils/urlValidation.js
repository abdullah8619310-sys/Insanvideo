function parseUrl(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }

  try {
    return new URL(trimmed)
  } catch {
    return null
  }
}

function isHttpProtocol(parsedUrl) {
  return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
}

module.exports = { parseUrl, isHttpProtocol }

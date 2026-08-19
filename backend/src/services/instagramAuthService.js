const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'
const SHORT_LIVED_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
const LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token'
const SCOPE = 'instagram_business_basic'
const DEFAULT_LONG_LIVED_TTL_SECONDS = 60 * 24 * 60 * 60 // 60 days, per Meta's documented default

function configError() {
  return Object.assign(
    new Error('Instagram OAuth is not configured (missing META_APP_ID / META_APP_SECRET / META_OAUTH_REDIRECT_URI).'),
    { statusCode: 503 }
  )
}

function upstreamError(message) {
  return Object.assign(new Error(message), { statusCode: 502 })
}

function getConfig() {
  return {
    clientId: process.env.META_APP_ID,
    clientSecret: process.env.META_APP_SECRET,
    redirectUri: process.env.META_OAUTH_REDIRECT_URI,
  }
}

function isConfigured() {
  const { clientId, clientSecret, redirectUri } = getConfig()
  return Boolean(clientId && clientSecret && redirectUri)
}

function buildAuthorizeUrl(state) {
  const { clientId, redirectUri } = getConfig()
  if (!clientId || !redirectUri) {
    throw configError()
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    response_type: 'code',
  })
  if (state) {
    params.set('state', state)
  }

  return `${AUTHORIZE_URL}?${params.toString()}`
}

async function exchangeCodeForShortLivedToken(code, fetchFn = fetch) {
  const { clientId, clientSecret, redirectUri } = getConfig()
  if (!clientId || !clientSecret || !redirectUri) {
    throw configError()
  }

  // Meta's own reference docs demonstrate this exchange as multipart form
  // data (curl -F), not application/x-www-form-urlencoded — using FormData
  // here matches the documented example exactly rather than assuming the
  // more common urlencoded style also works.
  const body = new FormData()
  body.append('client_id', clientId)
  body.append('client_secret', clientSecret)
  body.append('grant_type', 'authorization_code')
  body.append('redirect_uri', redirectUri)
  body.append('code', code)

  const response = await fetchFn(SHORT_LIVED_TOKEN_URL, { method: 'POST', body })
  const json = await response.json().catch(() => null)

  if (!response.ok || !json?.access_token) {
    throw upstreamError('Instagram rejected the authorization code.')
  }

  return { accessToken: json.access_token, igUserId: String(json.user_id) }
}

async function exchangeForLongLivedToken(shortLivedToken, fetchFn = fetch) {
  const { clientSecret } = getConfig()
  if (!clientSecret) {
    throw configError()
  }

  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: clientSecret,
    access_token: shortLivedToken,
  })

  const response = await fetchFn(`${LONG_LIVED_TOKEN_URL}?${params.toString()}`)
  const json = await response.json().catch(() => null)

  if (!response.ok || !json?.access_token) {
    throw upstreamError('Could not obtain a long-lived Instagram token.')
  }

  const ttlSeconds = json.expires_in || DEFAULT_LONG_LIVED_TTL_SECONDS
  return { accessToken: json.access_token, expiresAt: Date.now() + ttlSeconds * 1000 }
}

module.exports = {
  isConfigured,
  buildAuthorizeUrl,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
}

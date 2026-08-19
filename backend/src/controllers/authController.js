const crypto = require('node:crypto')
const {
  isConfigured,
  buildAuthorizeUrl,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
} = require('../services/instagramAuthService')
const { getDefaultTokenStore } = require('../db/tokenStore')
const { errorResponse, successResponse } = require('../utils/apiResponse')

// Stateless CSRF protection for the OAuth redirect: without this, anything
// that can make the site owner's browser load our callback URL with an
// attacker-supplied `code` could get us to store the attacker's Instagram
// connection instead of the site owner's. The cookie is a self-verifying
// HMAC (no server-side session store needed) that connect() sets and
// callback() must see an exact match for before exchanging any code.
const STATE_COOKIE_NAME = 'ig_oauth_state'
const STATE_TTL_MS = 10 * 60 * 1000

function signStatePayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function createStateCookie(secret) {
  const state = crypto.randomBytes(16).toString('hex')
  const payload = `${state}.${Date.now()}`
  return { state, cookieValue: `${payload}.${signStatePayload(payload, secret)}` }
}

function isStateCookieValid(cookieValue, expectedState, secret) {
  if (!cookieValue || !expectedState) {
    return false
  }
  const parts = cookieValue.split('.')
  if (parts.length !== 3) {
    return false
  }
  const [state, timestamp, signature] = parts
  const expectedSignature = signStatePayload(`${state}.${timestamp}`, secret)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return false
  }
  if (state !== expectedState) {
    return false
  }
  const age = Date.now() - Number(timestamp)
  return Number.isFinite(age) && age >= 0 && age <= STATE_TTL_MS
}

function readCookie(req, name) {
  const header = req.headers.cookie
  if (!header) {
    return null
  }
  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }
    if (part.slice(0, separatorIndex).trim() === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim())
    }
  }
  return null
}

function connect(req, res, next) {
  try {
    if (!isConfigured()) {
      return errorResponse(res, {
        statusCode: 503,
        message: 'Instagram OAuth is not configured on this server.',
      })
    }
    const { state, cookieValue } = createStateCookie(process.env.META_APP_SECRET)
    res.cookie(STATE_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: STATE_TTL_MS,
    })
    return res.redirect(buildAuthorizeUrl(state))
  } catch (err) {
    return next(err)
  }
}

async function callback(req, res, next) {
  try {
    const { code, state, error, error_description: errorDescription } = req.query

    if (error) {
      return errorResponse(res, {
        statusCode: 400,
        message: typeof errorDescription === 'string' ? errorDescription : 'Instagram authorization was denied.',
      })
    }

    const stateCookie = readCookie(req, STATE_COOKIE_NAME)
    res.clearCookie(STATE_COOKIE_NAME)

    if (
      typeof state !== 'string' ||
      !isStateCookieValid(stateCookie, state, process.env.META_APP_SECRET)
    ) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid or expired authorization request. Please try connecting again.',
      })
    }

    if (!code || typeof code !== 'string') {
      return errorResponse(res, { statusCode: 400, message: 'Missing authorization code.' })
    }

    const shortLived = await exchangeCodeForShortLivedToken(code)
    const longLived = await exchangeForLongLivedToken(shortLived.accessToken)

    getDefaultTokenStore().saveConnection({
      accessToken: longLived.accessToken,
      igUserId: shortLived.igUserId,
      expiresAt: longLived.expiresAt,
    })

    return successResponse(res, {
      message: 'Instagram account connected successfully.',
      data: { igUserId: shortLived.igUserId },
    })
  } catch (err) {
    return next(err)
  }
}

module.exports = { connect, callback }

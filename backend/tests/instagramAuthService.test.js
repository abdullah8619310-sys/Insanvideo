const test = require('node:test')
const assert = require('node:assert/strict')
const {
  isConfigured,
  buildAuthorizeUrl,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
} = require('../src/services/instagramAuthService')

// Must be async and await run(): the functions under test read process.env
// at various points, some after their first await, so a synchronous
// try/finally here would restore env vars before those reads happen.
async function withEnv(vars, run) {
  const original = {}
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key]
    if (vars[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = vars[key]
    }
  }
  try {
    return await run()
  } finally {
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = original[key]
      }
    }
  }
}

function fakeJsonResponse(ok, status, body) {
  return { ok, status, json: async () => body }
}

test('isConfigured is false when env vars are missing', async () => {
  await withEnv({ META_APP_ID: undefined, META_APP_SECRET: undefined, META_OAUTH_REDIRECT_URI: undefined }, () => {
    assert.equal(isConfigured(), false)
  })
})

test('isConfigured is true when all three env vars are set', async () => {
  await withEnv(
    { META_APP_ID: 'id', META_APP_SECRET: 'secret', META_OAUTH_REDIRECT_URI: 'http://localhost/cb' },
    () => {
      assert.equal(isConfigured(), true)
    }
  )
})

test('buildAuthorizeUrl throws a 503 when not configured', async () => {
  await withEnv({ META_APP_ID: undefined, META_OAUTH_REDIRECT_URI: undefined }, () => {
    assert.throws(() => buildAuthorizeUrl(), (err) => err.statusCode === 503)
  })
})

test('buildAuthorizeUrl produces the correct Instagram authorize URL', async () => {
  await withEnv({ META_APP_ID: 'APPID', META_OAUTH_REDIRECT_URI: 'https://example.com/cb' }, () => {
    const url = buildAuthorizeUrl()
    assert.match(url, /^https:\/\/www\.instagram\.com\/oauth\/authorize\?/)
    const parsed = new URL(url)
    assert.equal(parsed.searchParams.get('client_id'), 'APPID')
    assert.equal(parsed.searchParams.get('redirect_uri'), 'https://example.com/cb')
    assert.equal(parsed.searchParams.get('response_type'), 'code')
    assert.equal(parsed.searchParams.get('scope'), 'instagram_business_basic')
  })
})

test('exchangeCodeForShortLivedToken posts to the correct endpoint and returns token + user id', async () => {
  await withEnv(
    { META_APP_ID: 'id', META_APP_SECRET: 'secret', META_OAUTH_REDIRECT_URI: 'http://localhost/cb' },
    async () => {
      let calledUrl = null
      const fakeFetch = async (url) => {
        calledUrl = url
        return fakeJsonResponse(true, 200, { access_token: 'SHORT_TOKEN', user_id: 42 })
      }

      const result = await exchangeCodeForShortLivedToken('AUTH_CODE', fakeFetch)
      assert.equal(calledUrl, 'https://api.instagram.com/oauth/access_token')
      assert.equal(result.accessToken, 'SHORT_TOKEN')
      assert.equal(result.igUserId, '42')
    }
  )
})

test('exchangeCodeForShortLivedToken sends the request body as multipart form data, matching Meta\'s documented curl -F example', async () => {
  await withEnv(
    { META_APP_ID: 'id', META_APP_SECRET: 'secret', META_OAUTH_REDIRECT_URI: 'http://localhost/cb' },
    async () => {
      let capturedOptions = null
      const fakeFetch = async (url, options) => {
        capturedOptions = options
        return fakeJsonResponse(true, 200, { access_token: 'SHORT_TOKEN', user_id: 42 })
      }

      await exchangeCodeForShortLivedToken('AUTH_CODE', fakeFetch)
      assert.equal(capturedOptions.method, 'POST')
      assert.ok(capturedOptions.body instanceof FormData)
      assert.equal(capturedOptions.body.get('client_id'), 'id')
      assert.equal(capturedOptions.body.get('client_secret'), 'secret')
      assert.equal(capturedOptions.body.get('grant_type'), 'authorization_code')
      assert.equal(capturedOptions.body.get('redirect_uri'), 'http://localhost/cb')
      assert.equal(capturedOptions.body.get('code'), 'AUTH_CODE')
    }
  )
})

test('exchangeCodeForShortLivedToken throws a clean 502 when Instagram rejects the code', async () => {
  await withEnv(
    { META_APP_ID: 'id', META_APP_SECRET: 'secret', META_OAUTH_REDIRECT_URI: 'http://localhost/cb' },
    async () => {
      const fakeFetch = async () => fakeJsonResponse(false, 400, { error_message: 'bad code' })
      await assert.rejects(
        () => exchangeCodeForShortLivedToken('BAD_CODE', fakeFetch),
        (err) => err.statusCode === 502
      )
    }
  )
})

test('exchangeForLongLivedToken calls the graph.instagram.com long-lived endpoint', async () => {
  await withEnv({ META_APP_SECRET: 'secret' }, async () => {
    let calledUrl = null
    const fakeFetch = async (url) => {
      calledUrl = url
      return fakeJsonResponse(true, 200, { access_token: 'LONG_TOKEN', expires_in: 5184000 })
    }

    const result = await exchangeForLongLivedToken('SHORT_TOKEN', fakeFetch)
    assert.ok(calledUrl.startsWith('https://graph.instagram.com/access_token?'))
    assert.equal(result.accessToken, 'LONG_TOKEN')
    assert.ok(result.expiresAt > Date.now())
  })
})

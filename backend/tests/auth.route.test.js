// Isolate from the real persistent Instagram connection DB.
process.env.INSTAGRAM_DB_PATH = ':memory:'

const test = require('node:test')
const assert = require('node:assert/strict')
const app = require('../src/app')

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

async function withServer(run) {
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

function extractCookieValue(setCookieHeader, name) {
  if (!setCookieHeader) return null
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`))
  return match ? match[1] : null
}

test('GET /api/auth/instagram/connect returns 503 when Instagram OAuth is not configured', async () => {
  await withEnv({ META_APP_ID: undefined, META_APP_SECRET: undefined, META_OAUTH_REDIRECT_URI: undefined }, () =>
    withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/instagram/connect`, { redirect: 'manual' })
      assert.equal(response.status, 503)
      const json = await response.json()
      assert.equal(json.success, false)
    })
  )
})

test('GET /api/auth/instagram/connect redirects to Instagram with a state param and sets a signed state cookie', async () => {
  await withEnv(
    { META_APP_ID: 'APPID', META_APP_SECRET: 'SECRET', META_OAUTH_REDIRECT_URI: 'http://localhost/cb' },
    () =>
      withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/auth/instagram/connect`, { redirect: 'manual' })
        assert.equal(response.status, 302)

        const location = response.headers.get('location')
        assert.match(location, /^https:\/\/www\.instagram\.com\/oauth\/authorize\?/)
        const stateInUrl = new URL(location).searchParams.get('state')
        assert.ok(stateInUrl && stateInUrl.length > 0)

        const setCookie = response.headers.get('set-cookie')
        assert.match(setCookie, /ig_oauth_state=/)
        assert.match(setCookie, /HttpOnly/i)
      })
  )
})

test('GET /api/auth/instagram/callback with no state cookie at all is rejected', async () => {
  await withEnv(
    { META_APP_ID: 'APPID', META_APP_SECRET: 'SECRET', META_OAUTH_REDIRECT_URI: 'http://localhost/cb' },
    () =>
      withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/auth/instagram/callback?code=abc&state=anything`)
        assert.equal(response.status, 400)
        const json = await response.json()
        assert.equal(json.success, false)
        assert.match(json.message, /Invalid or expired/)
      })
  )
})

test('GET /api/auth/instagram/callback with a mismatched state is rejected even with a valid cookie', async () => {
  await withEnv(
    { META_APP_ID: 'APPID', META_APP_SECRET: 'SECRET', META_OAUTH_REDIRECT_URI: 'http://localhost/cb' },
    () =>
      withServer(async (baseUrl) => {
        const connectResponse = await fetch(`${baseUrl}/api/auth/instagram/connect`, { redirect: 'manual' })
        const cookieValue = extractCookieValue(connectResponse.headers.get('set-cookie'), 'ig_oauth_state')
        assert.ok(cookieValue)

        const callbackResponse = await fetch(
          `${baseUrl}/api/auth/instagram/callback?code=abc&state=totally-different-state`,
          { headers: { Cookie: `ig_oauth_state=${cookieValue}` } }
        )
        assert.equal(callbackResponse.status, 400)
        const json = await callbackResponse.json()
        assert.match(json.message, /Invalid or expired/)
      })
  )
})

test('GET /api/auth/instagram/callback with a valid matching state but no code is rejected for the code, not the state', async () => {
  await withEnv(
    { META_APP_ID: 'APPID', META_APP_SECRET: 'SECRET', META_OAUTH_REDIRECT_URI: 'http://localhost/cb' },
    () =>
      withServer(async (baseUrl) => {
        const connectResponse = await fetch(`${baseUrl}/api/auth/instagram/connect`, { redirect: 'manual' })
        const location = connectResponse.headers.get('location')
        const realState = new URL(location).searchParams.get('state')
        const cookieValue = extractCookieValue(connectResponse.headers.get('set-cookie'), 'ig_oauth_state')

        const callbackResponse = await fetch(
          `${baseUrl}/api/auth/instagram/callback?state=${encodeURIComponent(realState)}`,
          { headers: { Cookie: `ig_oauth_state=${cookieValue}` } }
        )
        assert.equal(callbackResponse.status, 400)
        const json = await callbackResponse.json()
        assert.equal(json.message, 'Missing authorization code.')
      })
  )
})

test('GET /api/auth/instagram/callback with an error param returns 400 with the description', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/auth/instagram/callback?error=access_denied&error_description=User%20denied%20access`
    )
    assert.equal(response.status, 400)
    const json = await response.json()
    assert.equal(json.message, 'User denied access')
  })
})

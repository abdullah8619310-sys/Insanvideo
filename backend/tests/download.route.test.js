// Make sure this process has no real SocialKit key configured.
delete process.env.SOCIALKIT_ACCESS_KEY

const test = require('node:test')
const assert = require('node:assert/strict')
const app = require('../src/app')

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

async function postDownload(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await response.json()
  return { status: response.status, json }
}

test('valid public Instagram URL: honest not_configured response (no SocialKit key in this test env)', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postDownload(baseUrl, {
      url: 'https://www.instagram.com/reel/abc123/',
    })
    assert.equal(status, 503)
    assert.equal(json.success, false)
    assert.equal(json.message, 'Media provider is not configured.')
    assert.deepEqual(json.data, { platform: 'instagram', type: 'reel' })
  })
})

test('invalid URL is rejected with 400', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postDownload(baseUrl, { url: 'not a url' })
    assert.equal(status, 400)
    assert.equal(json.success, false)
  })
})

test('non-Instagram URL is rejected with 400', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postDownload(baseUrl, {
      url: 'https://example.com/reel/abc',
    })
    assert.equal(status, 400)
    assert.match(json.message, /Instagram/)
  })
})

test('non-https Instagram URL is rejected with 400', async () => {
  await withServer(async (baseUrl) => {
    const { status } = await postDownload(baseUrl, {
      url: 'http://www.instagram.com/p/abc123/',
    })
    assert.equal(status, 400)
  })
})

test('malformed URL is rejected with 400', async () => {
  await withServer(async (baseUrl) => {
    const { status } = await postDownload(baseUrl, { url: 'https://' })
    assert.equal(status, 400)
  })
})

test('missing URL is rejected with 400', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postDownload(baseUrl, {})
    assert.equal(status, 400)
    assert.equal(json.success, false)
  })
})

test('response shape is normalized (success, message, data)', async () => {
  await withServer(async (baseUrl) => {
    const { json } = await postDownload(baseUrl, {
      url: 'https://www.instagram.com/p/abc123/',
    })
    assert.ok('success' in json)
    assert.ok('message' in json)
    assert.ok('data' in json)
  })
})

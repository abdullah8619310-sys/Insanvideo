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

async function postMediaInfo(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/media/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await response.json()
  return { status: response.status, json }
}

test('valid Instagram reel URL returns the honest not-implemented response', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postMediaInfo(baseUrl, {
      url: 'https://www.instagram.com/reel/abc123/',
    })
    assert.equal(status, 501)
    assert.equal(json.success, false)
    assert.equal(json.message, 'Instagram media resolution is not implemented yet.')
    assert.deepEqual(json.data, { platform: 'instagram', type: 'reel' })
  })
})

test('valid Instagram post URL returns the honest not-implemented response', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postMediaInfo(baseUrl, {
      url: 'https://www.instagram.com/p/abc123/',
    })
    assert.equal(status, 501)
    assert.equal(json.data.type, 'post')
  })
})

test('invalid URL is rejected with 400', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postMediaInfo(baseUrl, { url: 'not a url' })
    assert.equal(status, 400)
    assert.equal(json.success, false)
  })
})

test('non-Instagram URL is rejected with 400', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postMediaInfo(baseUrl, {
      url: 'https://example.com/reel/abc',
    })
    assert.equal(status, 400)
    assert.match(json.message, /Instagram/)
  })
})

test('malformed URL is rejected with 400', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postMediaInfo(baseUrl, { url: 'http://' })
    assert.equal(status, 400)
    assert.match(json.message, /valid http/)
  })
})

test('missing URL is rejected with 400', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postMediaInfo(baseUrl, {})
    assert.equal(status, 400)
    assert.equal(json.success, false)
  })
})

test('Instagram URL of unrecognized shape is still accepted and reported honestly', async () => {
  await withServer(async (baseUrl) => {
    const { status, json } = await postMediaInfo(baseUrl, {
      url: 'https://www.instagram.com/explore/',
    })
    assert.equal(status, 501)
    assert.equal(json.data.type, 'unknown')
  })
})

test('response shape is normalized (success, message, data)', async () => {
  await withServer(async (baseUrl) => {
    const { json } = await postMediaInfo(baseUrl, {
      url: 'https://www.instagram.com/reel/abc123/',
    })
    assert.ok('success' in json)
    assert.ok('message' in json)
    assert.ok('data' in json)
  })
})

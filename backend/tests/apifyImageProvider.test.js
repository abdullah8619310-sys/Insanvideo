const test = require('node:test')
const assert = require('node:assert/strict')
const { isConfigured, downloadImage } = require('../src/providers/apifyImageProvider')

// Must be async and await run(): a synchronous try/finally would revert
// env vars after the first suspension point inside an async run() body —
// safe for a single awaited call, but wrong for any test that calls the
// function under test more than once inside one withEnv block (later calls
// would silently see the env var already gone). See docs/instagram-download-status.md.
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

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

test('isConfigured reflects whether APIFY_API_TOKEN is set', async () => {
  await withEnv({ APIFY_API_TOKEN: undefined }, () => {
    assert.equal(isConfigured(), false)
  })
  await withEnv({ APIFY_API_TOKEN: 'token' }, () => {
    assert.equal(isConfigured(), true)
  })
})

test('downloadImage returns not_configured without calling fetch when the token is missing', async () => {
  await withEnv({ APIFY_API_TOKEN: undefined }, async () => {
    let called = false
    const fetchFn = async () => {
      called = true
      return jsonResponse(200, [])
    }
    const result = await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'not_configured' })
    assert.equal(called, false)
  })
})

test('downloadImage calls the correct actor endpoint with Bearer auth and the documented body shape', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    let capturedUrl = null
    let capturedOptions = null
    const fetchFn = async (url, options) => {
      capturedUrl = url
      capturedOptions = options
      return jsonResponse(200, [{ inputUrl: 'x', platform: 'instagram', result: [] }])
    }

    await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })

    assert.equal(
      capturedUrl,
      'https://api.apify.com/v2/actors/elis~instagram-downloader-api/run-sync-get-dataset-items'
    )
    assert.equal(capturedOptions.headers.Authorization, 'Bearer test-token')
    const body = JSON.parse(capturedOptions.body)
    assert.deepEqual(body.url, ['https://www.instagram.com/p/abc/'])
  })
})

test('downloadImage takes the first variant with a usable URL, ignoring the (unreliable) type field', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    const fetchFn = async () =>
      jsonResponse(200, [
        {
          inputUrl: 'https://www.instagram.com/p/abc/',
          platform: 'instagram',
          result: [
            { url: 'https://example.com/photo.jpg', type: 'image', quality: 'HD', size: '1MB', thumb: 'https://example.com/t.jpg' },
            { url: 'https://example.com/other.jpg', type: 'video', quality: 'SD', size: '2MB', thumb: null },
          ],
        },
      ])

    const result = await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })
    assert.deepEqual(result, {
      ok: true,
      media: { url: 'https://example.com/photo.jpg', thumbnail: 'https://example.com/t.jpg', quality: 'HD' },
    })
  })
})

test('downloadImage still succeeds when the actor mislabels a photo as type "video" with empty quality/size (real observed behavior)', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    const fetchFn = async () =>
      jsonResponse(200, [
        {
          inputUrl: 'https://www.instagram.com/p/DcN57SpsacU/',
          platform: 'instagram',
          result: [
            {
              url: 'https://dl.snapcdn.app/get?token=example',
              type: 'video',
              quality: '',
              size: '',
              thumb: 'https://i.snapcdn.app/photo?token=example',
            },
          ],
        },
      ])

    const result = await downloadImage('https://www.instagram.com/p/DcN57SpsacU/', { fetchFn })
    assert.equal(result.ok, true)
    assert.equal(result.media.url, 'https://dl.snapcdn.app/get?token=example')
    assert.equal(result.media.thumbnail, 'https://i.snapcdn.app/photo?token=example')
    // An empty string is not a real quality value — must not be fabricated as one.
    assert.equal(result.media.quality, null)
  })
})

test('downloadImage returns unavailable when the dataset has no usable variant at all', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    const fetchFn = async () =>
      jsonResponse(200, [{ inputUrl: 'x', platform: 'instagram', result: [] }])
    const result = await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'unavailable' })
  })
})

test('downloadImage returns unavailable when the dataset is empty', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    const fetchFn = async () => jsonResponse(200, [])
    const result = await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'unavailable' })
  })
})

test('downloadImage maps 401/403 to not_configured (invalid token)', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    for (const status of [401, 403]) {
      const fetchFn = async () => jsonResponse(status, {})
      const result = await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })
      assert.deepEqual(result, { ok: false, reason: 'not_configured' })
    }
  })
})

test('downloadImage maps 429 to blocked', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    const fetchFn = async () => jsonResponse(429, {})
    const result = await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'blocked' })
  })
})

test('downloadImage maps other non-2xx statuses to upstream_failure', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    const fetchFn = async () => jsonResponse(500, {})
    const result = await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'upstream_failure' })
  })
})

test('downloadImage maps a timed-out/aborted request to timeout', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    const fetchFn = async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }
    const result = await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'timeout' })
  })
})

test('downloadImage maps an unexpected network error to upstream_failure', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    const fetchFn = async () => {
      throw new Error('ECONNRESET')
    }
    const result = await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'upstream_failure' })
  })
})

test('downloadImage treats malformed (non-JSON) response bodies as upstream_failure', async () => {
  await withEnv({ APIFY_API_TOKEN: 'test-token' }, async () => {
    const fetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json')
      },
    })
    const result = await downloadImage('https://www.instagram.com/p/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'upstream_failure' })
  })
})

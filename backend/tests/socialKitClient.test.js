const test = require('node:test')
const assert = require('node:assert/strict')
const { isConfigured, downloadMedia } = require('../src/providers/socialKitClient')

// Must be async and await run(): a synchronous try/finally here would
// restore/delete env vars before an async run() body actually executes
// (this exact bug shipped once already in Step 9's auth tests).
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

test('isConfigured reflects whether SOCIALKIT_ACCESS_KEY is set', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: undefined }, () => {
    assert.equal(isConfigured(), false)
  })
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'key' }, () => {
    assert.equal(isConfigured(), true)
  })
})

test('downloadMedia returns not_configured without ever calling fetch when the key is missing', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: undefined }, async () => {
    let called = false
    const fetchFn = async () => {
      called = true
      return jsonResponse(200, {})
    }
    const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'not_configured' })
    assert.equal(called, false)
  })
})

test('downloadMedia posts JSON with access_key and url in the body, matching SocialKit\'s documented example', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    let capturedUrl = null
    let capturedOptions = null
    const fetchFn = async (url, options) => {
      capturedUrl = url
      capturedOptions = options
      return jsonResponse(200, {
        success: true,
        data: { title: 't', downloadUrl: 'https://example.com/v.mp4', thumbnail: 'https://example.com/t.jpg' },
      })
    }

    await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })

    assert.equal(capturedUrl, 'https://api.socialkit.dev/instagram/download')
    assert.equal(capturedOptions.method, 'POST')
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json')
    const body = JSON.parse(capturedOptions.body)
    assert.equal(body.access_key, 'test-key')
    assert.equal(body.url, 'https://www.instagram.com/reel/abc/')
  })
})

test('downloadMedia returns normalized media on success, including real quality/format fields', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () =>
      jsonResponse(200, {
        success: true,
        data: {
          title: 'Video by someone',
          downloadUrl: 'https://socialkit-downloads.s3.amazonaws.com/abc.mp4',
          thumbnail: 'https://cdn.example.com/thumb.jpg',
          quality: '720p',
          format: 'mp4',
        },
      })

    const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
    assert.deepEqual(result, {
      ok: true,
      media: {
        title: 'Video by someone',
        downloadUrl: 'https://socialkit-downloads.s3.amazonaws.com/abc.mp4',
        thumbnail: 'https://cdn.example.com/thumb.jpg',
        quality: '720p',
        format: 'mp4',
      },
    })
  })
})

test('downloadMedia does not fabricate quality/format when SocialKit omits them', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () =>
      jsonResponse(200, {
        success: true,
        data: {
          title: null,
          downloadUrl: 'https://socialkit-downloads.s3.amazonaws.com/abc.mp4',
          thumbnail: null,
          // quality/format intentionally absent
        },
      })

    const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
    assert.equal(result.media.quality, null)
    assert.equal(result.media.format, null)
  })
})

test('downloadMedia maps SocialKit\'s "no video in this post" 404 to no_video (real observed response — a photo post)', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () =>
      jsonResponse(404, {
        success: false,
        message: 'Download failed: ERROR: [Instagram] DcN57SpsacU: There is no video in this post\n',
      })
    const result = await downloadMedia('https://www.instagram.com/p/DcN57SpsacU/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'no_video' })
  })
})

test('downloadMedia maps a plain 404 (no "no video" message) to generic unavailable', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () => jsonResponse(404, { success: false, message: 'Post not found' })
    const result = await downloadMedia('https://www.instagram.com/p/deleted/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'unavailable' })
  })
})

test('downloadMedia maps 429 to blocked', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () => jsonResponse(429, { success: false })
    const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'blocked' })
  })
})

test('downloadMedia maps 404/422 to unavailable', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    for (const status of [404, 422]) {
      const fetchFn = async () => jsonResponse(status, { success: false })
      const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
      assert.deepEqual(result, { ok: false, reason: 'unavailable' })
    }
  })
})

test('downloadMedia maps other non-2xx statuses to upstream_failure', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () => jsonResponse(500, { success: false })
    const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'upstream_failure' })
  })
})

test('downloadMedia maps a timed-out/aborted request to timeout', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () => {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      throw err
    }
    const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'timeout' })
  })
})

test('downloadMedia maps an unexpected network error to upstream_failure', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () => {
      throw new Error('ECONNRESET')
    }
    const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'upstream_failure' })
  })
})

test('downloadMedia treats malformed (non-JSON) response bodies as upstream_failure', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token in JSON')
      },
    })
    const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'upstream_failure' })
  })
})

test('downloadMedia treats a 200 response missing downloadUrl as unavailable', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () => jsonResponse(200, { success: true, data: {} })
    const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'unavailable' })
  })
})

test('downloadMedia treats success:false with a 200 status as unavailable', async () => {
  await withEnv({ SOCIALKIT_ACCESS_KEY: 'test-key' }, async () => {
    const fetchFn = async () =>
      jsonResponse(200, { success: false, error: 'Content not found or private' })
    const result = await downloadMedia('https://www.instagram.com/reel/abc/', { fetchFn })
    assert.deepEqual(result, { ok: false, reason: 'unavailable' })
  })
})

const test = require('node:test')
const assert = require('node:assert/strict')
const { processDownload, mapFailure } = require('../src/services/downloadService')

// mapFailure() tests exercise the full failure-reason taxonomy directly.
// Only "not_configured" is currently reachable through the live route in
// this dev environment (no SOCIALKIT_ACCESS_KEY configured) — the others
// are tested here in isolation. See docs/instagram-download-status.md.

test('mapFailure: not_implemented -> 501', () => {
  const result = mapFailure('not_implemented', 'reel')
  assert.equal(result.success, false)
  assert.equal(result.statusCode, 501)
  assert.equal(result.message, 'Public Instagram media retrieval is not implemented yet.')
})

test('mapFailure: not_configured -> 503', () => {
  const result = mapFailure('not_configured', 'reel')
  assert.equal(result.statusCode, 503)
  assert.equal(result.message, 'Media provider is not configured.')
})

test('mapFailure: private -> 403 with the exact required message', () => {
  const result = mapFailure('private', 'post')
  assert.equal(result.statusCode, 403)
  assert.equal(result.message, 'Private Instagram content cannot be accessed.')
})

test('mapFailure: unavailable -> 404', () => {
  const result = mapFailure('unavailable', 'post')
  assert.equal(result.statusCode, 404)
})

test('mapFailure: no_video -> 422 with an accurate (non-misleading) message', () => {
  const result = mapFailure('no_video', 'post')
  assert.equal(result.statusCode, 422)
  assert.equal(
    result.message,
    "This Instagram post doesn't contain a video. InsanVideo currently supports Reels and video posts only."
  )
})

test('mapFailure: blocked -> 502', () => {
  const result = mapFailure('blocked', 'reel')
  assert.equal(result.statusCode, 502)
})

test('mapFailure: timeout -> 504', () => {
  const result = mapFailure('timeout', 'reel')
  assert.equal(result.statusCode, 504)
})

test('mapFailure: upstream_failure -> 502', () => {
  const result = mapFailure('upstream_failure', 'post')
  assert.equal(result.statusCode, 502)
})

test('mapFailure: unrecognized reason falls back to 500', () => {
  const result = mapFailure('something_new', 'post')
  assert.equal(result.statusCode, 500)
})

test('mapFailure: data always carries platform and type', () => {
  const result = mapFailure('private', 'carousel')
  assert.deepEqual(result.data, { platform: 'instagram', type: 'carousel' })
})

test('processDownload rejects a missing URL', async () => {
  await assert.rejects(() => processDownload(undefined), (err) => err.statusCode === 400)
})

test('processDownload rejects a non-https URL', async () => {
  await assert.rejects(
    () => processDownload('http://www.instagram.com/p/abc123/'),
    (err) => err.statusCode === 400
  )
})

test('processDownload rejects a non-Instagram URL', async () => {
  await assert.rejects(
    () => processDownload('https://example.com/p/abc123/'),
    (err) => err.statusCode === 400
  )
})

test('processDownload rejects a malformed URL', async () => {
  await assert.rejects(() => processDownload('https://'), (err) => err.statusCode === 400)
})

test('processDownload on a valid Instagram URL: honestly reports not_configured when no SocialKit key exists', async () => {
  const result = await processDownload('https://www.instagram.com/reel/abc123/')
  assert.equal(result.success, false)
  assert.equal(result.statusCode, 503)
  assert.equal(result.data.type, 'reel')
})

const test = require('node:test')
const assert = require('node:assert/strict')
const { isInstagramUrl, detectMediaType, resolveMedia } = require('../src/providers/instagramProvider')

test('isInstagramUrl accepts known Instagram hostnames', () => {
  assert.equal(isInstagramUrl(new URL('https://www.instagram.com/reel/abc/')), true)
  assert.equal(isInstagramUrl(new URL('https://instagram.com/reel/abc/')), true)
  assert.equal(isInstagramUrl(new URL('https://m.instagram.com/reel/abc/')), true)
})

test('isInstagramUrl rejects lookalike/non-Instagram hostnames', () => {
  assert.equal(isInstagramUrl(new URL('https://evilinstagram.com/reel/abc')), false)
  assert.equal(isInstagramUrl(new URL('https://instagram.com.evil.com/reel/abc')), false)
  assert.equal(isInstagramUrl(new URL('https://example.com/')), false)
})

test('detectMediaType identifies reels', () => {
  assert.equal(detectMediaType(new URL('https://www.instagram.com/reel/abc123/')), 'reel')
  assert.equal(detectMediaType(new URL('https://www.instagram.com/reels/abc123/')), 'reel')
})

test('detectMediaType identifies posts', () => {
  assert.equal(detectMediaType(new URL('https://www.instagram.com/p/abc123/')), 'post')
})

test('detectMediaType identifies profiles', () => {
  assert.equal(detectMediaType(new URL('https://www.instagram.com/someusername/')), 'profile')
})

test('detectMediaType falls back to unknown', () => {
  assert.equal(detectMediaType(new URL('https://www.instagram.com/')), 'unknown')
  assert.equal(detectMediaType(new URL('https://www.instagram.com/explore/')), 'unknown')
})

test('resolveMedia honestly reports it is not implemented', async () => {
  const result = await resolveMedia()
  assert.equal(result.implemented, false)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const { parseUrl, isHttpProtocol } = require('../src/utils/urlValidation')

test('parseUrl returns null for empty or non-string input', () => {
  assert.equal(parseUrl(''), null)
  assert.equal(parseUrl('   '), null)
  assert.equal(parseUrl(undefined), null)
  assert.equal(parseUrl(123), null)
})

test('parseUrl returns null for malformed URLs', () => {
  assert.equal(parseUrl('not a url'), null)
  assert.equal(parseUrl('http://'), null)
  assert.equal(parseUrl('http://exa mple.com'), null)
})

test('parseUrl returns a URL instance for well-formed URLs', () => {
  const parsed = parseUrl('https://www.instagram.com/reel/abc123/')
  assert.ok(parsed instanceof URL)
  assert.equal(parsed.hostname, 'www.instagram.com')
})

test('isHttpProtocol accepts only http/https', () => {
  assert.equal(isHttpProtocol(new URL('https://example.com')), true)
  assert.equal(isHttpProtocol(new URL('http://example.com')), true)
  assert.equal(isHttpProtocol(new URL('ftp://example.com')), false)
})

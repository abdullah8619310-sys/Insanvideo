const test = require('node:test')
const assert = require('node:assert/strict')
const { fetchPublicMedia } = require('../src/providers/instagramProvider')

const URL_REEL = new URL('https://www.instagram.com/reel/abc123/')
const URL_POST = new URL('https://www.instagram.com/p/abc123/')

test('normalizes a successful SocialKit response into the standard contract, including real quality/format', async () => {
  const fakeSocialKit = {
    downloadMedia: async () => ({
      ok: true,
      media: {
        title: 'Video by someone',
        downloadUrl: 'https://socialkit-downloads.s3.amazonaws.com/abc.mp4',
        thumbnail: 'https://cdn.example.com/thumb.jpg',
        quality: '720p',
        format: 'mp4',
      },
    }),
  }

  const result = await fetchPublicMedia(URL_REEL, 'reel', { socialKit: fakeSocialKit })
  assert.equal(result.ok, true)
  assert.equal(result.data.platform, 'instagram')
  assert.equal(result.data.type, 'reel')
  assert.equal(result.data.title, 'Video by someone')
  assert.deepEqual(result.data.items, [
    {
      type: 'video',
      url: 'https://socialkit-downloads.s3.amazonaws.com/abc.mp4',
      thumbnail: 'https://cdn.example.com/thumb.jpg',
      quality: '720p',
      format: 'mp4',
    },
  ])
})

test('does not fabricate a quality/format value when SocialKit did not provide one', async () => {
  const fakeSocialKit = {
    downloadMedia: async () => ({
      ok: true,
      media: {
        title: null,
        downloadUrl: 'https://example.com/video.mp4',
        thumbnail: null,
        quality: null,
        format: null,
      },
    }),
  }

  const result = await fetchPublicMedia(URL_REEL, 'reel', { socialKit: fakeSocialKit })
  assert.equal(result.data.items[0].quality, null)
  assert.equal(result.data.items[0].format, null)
})

test('always returns exactly one item — SocialKit has no multi-variant response shape to normalize', async () => {
  const fakeSocialKit = {
    downloadMedia: async () => ({
      ok: true,
      media: { title: null, downloadUrl: 'https://example.com/video.mp4', thumbnail: null, quality: '480p', format: 'mp4' },
    }),
  }

  const result = await fetchPublicMedia(URL_REEL, 'reel', { socialKit: fakeSocialKit })
  assert.equal(result.data.items.length, 1)
})

test('passes the URL-shape type through unchanged for a video post', async () => {
  const fakeSocialKit = {
    downloadMedia: async () => ({
      ok: true,
      media: { title: null, downloadUrl: 'https://example.com/video.mp4', thumbnail: null, quality: null, format: null },
    }),
  }

  const result = await fetchPublicMedia(URL_POST, 'post', { socialKit: fakeSocialKit })
  assert.equal(result.data.type, 'post')
  assert.equal(result.data.title, null)
})

test('passes through a SocialKit failure reason unchanged', async () => {
  const fakeSocialKit = {
    downloadMedia: async () => ({ ok: false, reason: 'not_configured' }),
  }

  const result = await fetchPublicMedia(URL_REEL, 'reel', { socialKit: fakeSocialKit })
  assert.deepEqual(result, { ok: false, reason: 'not_configured' })
})

test('passes through each documented failure reason unchanged', async () => {
  for (const reason of ['unavailable', 'blocked', 'timeout', 'upstream_failure']) {
    const fakeSocialKit = { downloadMedia: async () => ({ ok: false, reason }) }
    const result = await fetchPublicMedia(URL_REEL, 'reel', { socialKit: fakeSocialKit })
    assert.equal(result.ok, false)
    assert.equal(result.reason, reason)
  }
})

test('falls back to Apify for an image when SocialKit reports no_video', async () => {
  const fakeSocialKit = { downloadMedia: async () => ({ ok: false, reason: 'no_video' }) }
  const fakeApify = {
    downloadImage: async () => ({
      ok: true,
      media: { url: 'https://example.com/photo.jpg', thumbnail: 'https://example.com/thumb.jpg', quality: 'HD' },
    }),
  }

  const result = await fetchPublicMedia(URL_POST, 'post', { socialKit: fakeSocialKit, apify: fakeApify })
  assert.equal(result.ok, true)
  assert.equal(result.data.title, null)
  assert.deepEqual(result.data.items, [
    {
      type: 'image',
      url: 'https://example.com/photo.jpg',
      thumbnail: 'https://example.com/thumb.jpg',
      quality: 'HD',
      format: null,
    },
  ])
})

test('reports unavailable (not the stale no_video reason) when the Apify fallback also fails', async () => {
  const fakeSocialKit = { downloadMedia: async () => ({ ok: false, reason: 'no_video' }) }
  const fakeApify = { downloadImage: async () => ({ ok: false, reason: 'unavailable' }) }

  const result = await fetchPublicMedia(URL_POST, 'post', { socialKit: fakeSocialKit, apify: fakeApify })
  assert.deepEqual(result, { ok: false, reason: 'unavailable' })
})

test('never calls Apify when SocialKit succeeds', async () => {
  let apifyCalled = false
  const fakeSocialKit = {
    downloadMedia: async () => ({
      ok: true,
      media: { title: null, downloadUrl: 'https://example.com/v.mp4', thumbnail: null, quality: null, format: null },
    }),
  }
  const fakeApify = { downloadImage: async () => { apifyCalled = true; return { ok: false, reason: 'unavailable' } } }

  await fetchPublicMedia(URL_REEL, 'reel', { socialKit: fakeSocialKit, apify: fakeApify })
  assert.equal(apifyCalled, false)
})

test('never calls Apify for a SocialKit failure reason other than no_video', async () => {
  for (const reason of ['not_configured', 'unavailable', 'blocked', 'timeout', 'upstream_failure']) {
    let apifyCalled = false
    const fakeSocialKit = { downloadMedia: async () => ({ ok: false, reason }) }
    const fakeApify = { downloadImage: async () => { apifyCalled = true; return { ok: false, reason: 'unavailable' } } }

    const result = await fetchPublicMedia(URL_REEL, 'reel', { socialKit: fakeSocialKit, apify: fakeApify })
    assert.equal(apifyCalled, false)
    assert.equal(result.reason, reason)
  }
})

test('calls socialKit.downloadMedia with the full URL string', async () => {
  let calledWith = null
  const fakeSocialKit = {
    downloadMedia: async (url) => {
      calledWith = url
      return {
        ok: true,
        media: { title: null, downloadUrl: 'https://example.com/v.mp4', thumbnail: null, quality: null, format: null },
      }
    },
  }

  await fetchPublicMedia(URL_REEL, 'reel', { socialKit: fakeSocialKit })
  assert.equal(calledWith, 'https://www.instagram.com/reel/abc123/')
})

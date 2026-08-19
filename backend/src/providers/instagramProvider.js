const socialKitClient = require('./socialKitClient')
const apifyImageProvider = require('./apifyImageProvider')

// Exact-match allowlist. Deliberately not a suffix/endsWith check, which
// would be bypassable by hosts like "evilinstagram.com" or
// "instagram.com.evil.com" — this is the SSRF-relevant boundary before any
// request is ever made.
const ALLOWED_HOSTNAMES = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com'])

const RESERVED_PATH_SEGMENTS = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'explore',
  'accounts',
  'direct',
])

function isInstagramUrl(parsedUrl) {
  return ALLOWED_HOSTNAMES.has(parsedUrl.hostname.toLowerCase())
}

function detectMediaType(parsedUrl) {
  const segments = parsedUrl.pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return 'unknown'
  }

  const [first, second] = segments

  if ((first === 'reel' || first === 'reels') && second) {
    return 'reel'
  }

  if (first === 'tv' && second) {
    return 'video'
  }

  if (first === 'p' && second) {
    return 'post'
  }

  if (segments.length === 1 && !RESERVED_PATH_SEGMENTS.has(first.toLowerCase())) {
    return 'profile'
  }

  return 'unknown'
}

// Actual Instagram media resolution is not implemented yet. This function
// intentionally makes no outbound network requests.
async function resolveMedia() {
  return { implemented: false }
}

// Retrieves media via SocialKit's third-party Instagram Video Download API
// (https://docs.socialkit.dev/api-reference/instagram-download-api) —
// InsanVideo's own credentials/server never contact Instagram directly for
// this path. SocialKit works for any public Reel/video URL, not just one
// connected account's own media (unlike the earlier Graph API approach,
// still present in instagramAuthService.js/authController.js/tokenStore.js
// but no longer called from here). `type` (the URL-shape guess from
// detectMediaType) is passed through as-is since SocialKit's response
// doesn't distinguish reel/post/video itself.
async function fetchPublicMedia(
  parsedUrl,
  type,
  { socialKit = socialKitClient, apify = apifyImageProvider } = {}
) {
  const result = await socialKit.downloadMedia(parsedUrl.href)

  if (result.ok) {
    return {
      ok: true,
      data: {
        platform: 'instagram',
        type,
        title: result.media.title,
        items: [
          {
            type: 'video',
            url: result.media.downloadUrl,
            thumbnail: result.media.thumbnail,
            quality: result.media.quality,
            format: result.media.format,
          },
        ],
      },
    }
  }

  if (result.reason !== 'no_video') {
    return result
  }

  // SocialKit (video-only) confirmed this post has no video — try an
  // image-capable fallback before giving up. Only triggers for exactly
  // this case; every other SocialKit failure reason is returned unchanged.
  const imageResult = await apify.downloadImage(parsedUrl.href)
  if (!imageResult.ok) {
    // The image fallback also failed — report the generic, honest
    // "nothing found" reason rather than the now-stale "no_video", since
    // we did in fact look for non-video media and didn't find it either.
    return { ok: false, reason: 'unavailable' }
  }

  return {
    ok: true,
    data: {
      platform: 'instagram',
      type,
      title: null,
      items: [
        {
          type: 'image',
          url: imageResult.media.url,
          thumbnail: imageResult.media.thumbnail,
          quality: imageResult.media.quality,
          format: null,
        },
      ],
    },
  }
}

module.exports = { isInstagramUrl, detectMediaType, resolveMedia, fetchPublicMedia }

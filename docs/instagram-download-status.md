# Instagram media extraction — current status

`backend/src/providers/instagramProvider.js` (`fetchPublicMedia`) retrieves
media using two providers, verified working end-to-end for real, on real
Instagram content:

- **SocialKit** (https://socialkit.dev) — primary, handles video/Reel downloads
- **Apify** (`elis/instagram-downloader-api` actor) — fallback, used only
  when SocialKit reports a post has no video (e.g. a photo post)

Both replace the earlier Meta Graph API approach, which is still present
but no longer called.

## Why the change from Meta Graph API

The Graph API approach (`instagramAuthService.js`, `authController.js`,
`authRoutes.js`, `tokenStore.js`) only ever worked for **one connected
account's own media**, because that API has no way to look up an arbitrary
public post by URL. It structurally could not satisfy this project's
actual requirement — "paste any public Reel/video URL, download it" — no
matter how it was configured, and required Meta OAuth the project owner
did not want as a prerequisite. Full research and reasoning is in
`docs/media-provider-options.md`.

Neither SocialKit nor Apify is a Meta partner — like every option capable
of doing this, they work by reading the same public page data a browser
would, not through a sanctioned API. Using them outsources that ToS risk
to a vendor rather than this project performing the technique itself; see
`docs/media-provider-options.md` for the full risk discussion.

## Real end-to-end verification (2026-08-19/20)

Both providers have been verified with real requests against real public
Instagram content, through the actual running application — not mocks,
not documentation assumptions:

**Video** (`instagram.com/reel/Dbzne9puxKc/`): `POST /api/download`
returned a real SocialKit-hosted download URL. The URL was fetched
directly (a partial byte-range request, not just a HEAD check) and the
response was confirmed as `Content-Type: video/mp4`, ~929KB, and
independently verified by the `file` utility as genuine `ISO Media, MP4
Base Media v1` — an actual playable video.

**Photo** (`instagram.com/p/DcN57SpsacU/`): SocialKit correctly reported
`no_video` (see below), triggering the Apify fallback, which returned a
real download URL. That URL was fetched directly and confirmed as
`Content-Type: image/webp`, 85,742 bytes, and independently verified by
`file` as a genuine `RIFF ... Web/P image`, 1439×959px.

**A real integration bug was found and fixed via this testing:** the Apify
actor's own `type` field is unreliable — a real request for the photo
above returned `"type": "video"` with empty `quality`/`size`, even though
the file it pointed to was genuinely a `.jpg`. The code originally filtered
strictly on `type === 'image'` (matching the actor's documented schema)
and so found nothing. Fixed by no longer trusting Apify's `type` label at
all: this fallback is only ever invoked after SocialKit has already
authoritatively confirmed the post has no video, so the first variant with
a usable URL is trusted directly, regardless of what Apify calls it.

## Current live behavior

With both `SOCIALKIT_ACCESS_KEY` and `APIFY_API_TOKEN` configured, a
request for a video URL is handled entirely by SocialKit; a request for a
photo-only post transparently falls back to Apify. Without either key
configured, requests return:

```json
{ "success": false, "message": "Media provider is not configured.", "data": { "platform": "instagram", "type": "reel" } }
```
(HTTP 503, reason `not_configured`).

If both providers genuinely find nothing (e.g. a deleted post, or a
private one — private-content bypass is not implemented and never will
be), the response is:

```json
{ "success": false, "message": "This Instagram content is unavailable or has been deleted.", "data": { "platform": "instagram", "type": "post" } }
```
(HTTP 404, reason `unavailable`).

## One-time setup required

1. Create a SocialKit account at [socialkit.dev](https://www.socialkit.dev) and get an access key
2. Create an Apify account at [apify.com](https://apify.com) and get an API token
3. Set `SOCIALKIT_ACCESS_KEY` and `APIFY_API_TOKEN` in `backend/.env` (see `.env.example`) — never commit real values
4. `POST /api/download` then works for any public Instagram Reel, video post, or photo post

## Architecture

```
POST /api/download
  → downloadController
    → downloadService.processDownload(url)   [URL/hostname validation — unchanged]
      → instagramProvider.fetchPublicMedia(url, type)
        → socialKitClient.downloadMedia(url)          [tried first, video]
          → POST https://api.socialkit.dev/instagram/download { access_key, url }
        → (if no_video) apifyImageProvider.downloadImage(url)   [fallback, photo]
          → POST https://api.apify.com/v2/actors/elis~instagram-downloader-api/run-sync-get-dataset-items
    → normalized { success, message, data: { platform, type, title, items[] } }
  → frontend DownloadResult
```

Both providers return a temporary, pre-signed download link — returned
directly to the frontend, not proxied through this backend. No media is
ever stored on InsanVideo's own server. See `docs/media-provider-options.md`
and the Step 11 implementation plan for why pass-through was chosen over a
backend proxy.

## Failure reasons (all implemented and unit-tested)

| Reason | HTTP | Meaning | Observed live? |
|---|---|---|---|
| `not_configured` | 503 | No API key set for the required provider | Yes |
| `no_video` | 422 | SocialKit confirmed no video, and no image fallback was attempted/available (rare — usually resolves via Apify instead) | Yes (before the Apify fallback existed) |
| `unavailable` | 404 | Neither provider found anything (deleted/private/malformed) | Not yet |
| `blocked` | 502 | A provider rate-limited the request (HTTP 429) | Not yet |
| `timeout` | 504 | A provider request timed out | Not yet |
| `upstream_failure` | 502 | Any other provider error, network failure, or malformed JSON | Not yet |

## Meta/OAuth code status

Not deleted yet, per the approved migration plan. `instagramAuthService.js`,
`authController.js`, `authRoutes.js`, `tokenStore.js`, and their test files
remain in the codebase but are no longer called by the download flow.

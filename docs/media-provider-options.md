# Instagram media provider options — researched, verified August 2026

This document evaluates every currently legitimate route to Instagram media
for InsanVideo, and recommends where InsanVideo goes from here. All claims
below were checked against current sources this month (August 2026), not
recalled from training data — Meta has changed this API surface twice in the
last year, so anything older is unreliable.

**Bottom line, stated up front:** no option below can legitimately do what
the current `/api/download` UX implies — paste any public Instagram URL,
get a downloadable file. The only verified-working, ToS-compliant official
path only works for content the authenticated user owns. See
[Recommendation](#recommendation).

---

## Option 1 — Instagram Graph API (own/managed account)

| | |
|---|---|
| **Content it can access** | Media belonging to the *authenticated* Instagram account only |
| **Authentication required** | Yes — OAuth 2.0 ("Business Login for Instagram") |
| **Own account** | ✅ Yes — this is its purpose |
| **Arbitrary public URLs (other users)** | ❌ No — not a capability of this API at all |
| **Images** | ✅ Yes (`media_url` field) |
| **Videos/Reels** | ✅ Yes (`media_url` field) |
| **Carousels** | ✅ Yes (`children` field lists each child media item) |
| **Account requirement** | Must be a **Business or Creator** account — personal accounts cannot use it |
| **Limitations** | Media endpoint returns only the connected account's own media; no lookup-by-permalink for arbitrary posts; max 10K most recent items; Story media not supported |
| **Cost / rate limits** | Free; standard Meta app-level rate limiting; production use beyond 25 test users requires Meta App Review (use-case writeup + screencast per permission) |
| **Env vars needed** | `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI` |
| **Implementation complexity** | Medium-high — OAuth flow, token storage/refresh, Meta App Review process, requires a database (not yet in this project) |

**Status: SUPPORTED (own account only) — REQUIRES AUTHENTICATION**

## Option 2 — Instagram oEmbed API

| | |
|---|---|
| **Content it can access** | Embed markup for any public post URL |
| **Authentication required** | No, as of **June 15, 2026** — Meta reversed the token requirement; tokenless calls work with no App Review |
| **Own account** | N/A |
| **Arbitrary public URLs (other users)** | ✅ Yes, for the embed HTML only |
| **Images** | ⚠️ Preview only, via Instagram's own embed script — no raw file URL |
| **Videos/Reels** | ⚠️ Same — embed only |
| **Carousels** | ⚠️ Embed renders the whole carousel; no per-item file access |
| **Critical limitation** | Returns a `<blockquote class="instagram-media">` + `embed.js` for *display*, not a downloadable file. As of **November 2025**, Meta also removed `thumbnail_url` and `author_name` from the response — those fields are gone. There is no `video_url`/`image_url` field in this response at all. |
| **Cost / rate limits** | Free; token-based calls get higher limits than tokenless, but token isn't required |
| **Env vars needed** | None (tokenless) |
| **Implementation complexity** | Low — but it cannot produce a "Download" button that saves a file, only a legitimate embedded preview |

**Status: SUPPORTED for embedding/preview only — NOT SUPPORTED for file download**

## Option 3 — Instagram Basic Display API

**Status: NOT SUPPORTED — deprecated and shut off entirely on December 4, 2024.** Any personal-account integration built on it fails outright today. Its replacement (Instagram API with Instagram Login, folded into Option 1 above) also requires a Business/Creator account. There is no official path left for personal-account self-access.

## Option 4 — Meta Content Library API

Meta's research-partnership API for approved academic/civic researchers studying public content at scale. Requires a formal research partnership application and institutional review; not available to a consumer product like InsanVideo.

**Status: NOT SUPPORTED for this use case**

## Option 5 — Third-party "Instagram downloader" APIs (RapidAPI and similar)

Commercially available paid APIs exist that return direct media file URLs for arbitrary Instagram posts, including reels/stories. Checked their own marketing copy: several explicitly advertise access to content from private accounts you follow, and to Stories/Highlights — capabilities the official Graph/oEmbed APIs do not have. That is only possible if the vendor itself is doing exactly the unofficial-endpoint/browser-impersonation scraping this project has ruled out — they've just packaged it as a paid subscription. Using one doesn't make the underlying technique compliant with Instagram's Terms of Service; it outsources the ToS risk to a vendor whose own access could be cut off at any time, and adds a new cost + trust dependency (the vendor sees every URL your users submit).

**Status: REQUIRES EXTERNAL PROVIDER — not verified as ToS-legitimate; same underlying restriction this project has already ruled out, one layer removed**

---

## Recommendation

There is no option that legitimately supports InsanVideo's current core use case as designed — "paste any public Instagram URL, get the file." Saying otherwise would misrepresent verified capabilities, which the project has explicitly asked me not to do.

Two honest paths forward, and they lead to different products:

1. **Pivot the product's actual capability to match Option 1.** InsanVideo would become "connect your own Instagram Business/Creator account, then download/back up media that account owns" — not an arbitrary-link downloader. This is fully legitimate, OAuth-based, and buildable, but is a materially different feature (and requires a database for token storage, which this project has deliberately deferred so far).
2. **Knowingly adopt a vetted third-party API (Option 5)** if the project owner wants to keep the current "paste any link" UX and is willing to accept the same category of ToS/reliability risk already discussed in Step 6, now scoped to a specific named vendor they've chosen and vetted themselves, with its own cost and terms.

Nothing here recommends staying on the current unofficial-scraping path this project already ruled out — that assessment is unchanged.

---

## Recommended architecture (design only — nothing below is implemented this step)

The existing seam is already correctly placed and needs no restructuring:

```
POST /api/download
  → downloadController.requestDownload
    → downloadService.processDownload(url)     [URL validation — unchanged]
      → provider.isInstagramUrl / detectMediaType   [unchanged]
      → provider.fetchMedia(parsedUrl, type, authContext)   ← real extraction plugs in HERE
    → normalized { success, platform, type, items[] }
  → frontend DownloadResult
```

`instagramProvider.fetchPublicMedia()` is that seam today. If Option 1 is chosen, it becomes two things instead of one — a per-user OAuth token lookup (`authContext`, new) plus a Graph API call scoped to that token's account — because the official API is account-scoped, not URL-scoped. That's a meaningful shape change from "anonymous URL in, media out" to "authenticated user + URL in (URL must belong to their own account), media out," and is worth designing deliberately rather than forcing into the current anonymous-request shape.

### Normalized response contract (target, for the next real implementation)

```json
{
  "success": true,
  "platform": "instagram",
  "type": "carousel",
  "items": [
    { "type": "image", "url": "https://...", "thumbnail": "https://...", "filename": "instagram-1.jpg" },
    { "type": "video", "url": "https://...", "thumbnail": "https://...", "filename": "instagram-2.mp4" }
  ]
}
```

Supports single image (`items.length === 1`, `type: "image"`), single video/reel (`type: "video"`/`"reel"`), and carousel (`items.length > 1`, `type: "carousel"`).

**Note for whoever implements the real provider next:** the current placeholder shape uses `data.media[]` (no `filename`) rather than `data.items[]`. This doc proposes renaming to the contract above at that time — not changed now, since there's no real data yet to validate the rename against, and this step is documentation-only.

### Authentication model (Option 1, OAuth — no passwords, ever)

1. User clicks "Connect Instagram Account" (Business/Creator only) in InsanVideo
2. Backend redirects to Instagram's Business Login authorize URL with `client_id`, `redirect_uri`, requested scopes
3. User authenticates **on Instagram's own page** — InsanVideo never sees the password
4. Instagram redirects back with a short-lived authorization `code`
5. Backend exchanges `code` for an access token server-to-server, using the app secret (never sent to the frontend)
6. Backend exchanges that for a long-lived token (~60 days) and stores **only the opaque token**, not credentials — this requires a database, not yet part of this project
7. Frontend never receives the raw token; all Graph API calls happen server-side
8. User can revoke access anytime from their own Instagram settings, instantly invalidating the token

Env vars this would need: `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI`.

---

## Additional considerations (per option)

| | Graph API (own account) | oEmbed | Third-party paid API |
|---|---|---|---|
| **Suitable for a student project?** | Yes technically, but requires Meta App Review for production use beyond 25 test users — a real bureaucratic hurdle (use-case writeup + screencast per permission), plus a database this project doesn't have yet | Yes — zero setup, tokenless, but can't produce a downloadable file, only an embed | Yes to build, but ongoing cost and a vendor whose Instagram access could disappear without notice |
| **Private/unavailable content** | Graph API simply won't return media outside the connected account — no special-casing needed, the existing `private`/`unavailable` failure responses in `downloadService.js` still apply for anything out of scope | N/A — oEmbed either renders the public embed or fails; private posts return an oEmbed error, mapped the same way | Vendor-dependent; most claim to detect private content and error out, but this is unverified per-vendor behavior, not a guarantee |
| **What happens when Instagram changes implementation?** | Low fragility — it's a versioned, documented, officially supported API; Meta gives deprecation notice (see Basic Display API's 90-day notice in 2024) | Low fragility, same reason — though Meta already changed this twice in under a year (Nov 2025 field removal, June 2026 token reversal), so "stable" still means "check every few months" | High fragility — these vendors depend on the exact unofficial technique Instagram actively fights; expect breakage with no notice, by design this project can't verify or fix it (it's the vendor's black box) |

## Security considerations

- Whichever path is chosen, `downloadService.processDownload`'s existing URL/hostname validation stays in place unchanged — no arbitrary domain ever reaches a provider
- OAuth tokens (if Option 1 is pursued) must never be exposed to the frontend or logged
- A third-party API key (if Option 5 is pursued) must live server-side only, via `.env`, never committed, never sent to the frontend
- Neither option involves storing an Instagram password, session cookie, or any credential belonging to the end user

## Sources

- [Instagram Graph API: Complete Developer Guide for 2026](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/)
- [Media - Instagram Platform - Meta for Developers](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/)
- [Instagram oEmbed Endpoint - Meta for Developers](https://developers.facebook.com/docs/instagram-platform/oembed/)
- [Meta oEmbed Read Explained](https://www.bluehost.com/blog/meta-oembed-read-explained/)
- [Meta Just Quietly Undid the Change That Broke Instagram Embeds in WordPress](https://wpmayor.com/meta-tokenless-oembed-wordpress/)
- [Facebook & Instagram oEmbed thumbnail deprecation - Iframely](https://iframely.com/updates/193071-facebook-and-instagram-oembed-thumbnail-deprecation)
- [Instagram Basic Display API (Deprecated): What Replaced It in 2026?](https://www.keyapi.ai/blog/instagram-basic-display-api/)
- [Instagram API Integration Guide 2026 - Phyllo](https://www.getphyllo.com/post/instagram-api-integration-101-for-developers-of-the-creator-economy)

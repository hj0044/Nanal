# Nanal integrated image submission, QA and game delivery (2026-10-24)

## What is automated in this repository

1. A **trusted host** can call `handoffGeneratedArtifact(...)` with **real ChatGPT PNG Buffer objects**. A connector-facing first portrait+full-body pair is sent to the official Nanal connector only when `getReservation` and `submitReservedImages` adapters are actually provided. Existing AP identity variants route to the independent **game-side** D1/R2 API; the official connector does not expose a variant upload operation.
2. The existing game-side `submitChatGptFile` or `submitChatGptPngBytes` validates 1024×1024/1024×1536 PNG CRC and an actual transparent/visible alpha region with sharp. Master source SHA-256 and official reviewed profile metadata are mandatory.
3. Original source is written to immutable local backup; by default it is also backed up to private Google Drive with MD5 and size verification **before** any game-side upload.
4. Game-side D1/R2 persists the source PNG as `awaiting_review`. Responsive WebPs (160, 320, 640, 1024 pixels wide) are generated and uploaded to private R2 derivative keys bound to the original SHA-256 and asset ID; replays cannot silently overwrite different bytes.
5. Mechanical QA (format, RGBA, alpha, dimensions, provenance) is automated. Face identity, height/physique and same-person match **cannot be established reliably by hashes**. The existing authenticated review endpoint requires an independently supported QA report to approve. The game NEVER auto-approves generated art or treats PNG validation as a visual match.
6. After approval, the existing public catalog makes the asset eligible. The game refreshes the public catalog at initial load, on returning to a visible tab and every 60 seconds while visible. Newly approved portraits populate contact avatars without reloading the app; fullbody images are not assigned as portraits. The approved image endpoint serves width-specific optimized WebP when available and falls back to PNG for legacy assets.

## Hosting and limits

The ChatGPT `image_gen` tool **does not promise that image output bytes or a generation-completed callback can be passed directly to arbitrary GitHub/Cloudflare code**. The host callback is ready to accept a Buffer, but the event/byte transport is **not installed** by repository changes. In particular, ChatGPT rendering an image in a chat is NOT an automatic upload or game registration. No additional OpenAI image-generation API or silent paid generation is used.

Official Nanal connector initial pair and game-side existing-ID variants are DIFFERENT databases. Neither is automatically synchronized to the other. Existing AP IDs cannot be uploaded as official connector variants until the connector exposes that authorized operation.

Cloudflare Worker binding requirements:
- `NANAL_APPEARANCE_DB` with `migrations/001_appearance_assets.sql`
- `NANAL_APPEARANCE_IMAGES` R2 bucket
- `NANAL_APPEARANCE_ADMIN_TOKEN` secret (32+ random chars)
- `NANAL_GAME_API_ORIGIN` public deployed Worker origin (CLI only)
- For remote original backup: private Google Drive folder, OAuth refresh credentials
- `npm run images:batch -- --source .nanal-private/inbox --registry .nanal-private/identity-registry.json --destination game-db --apply`

Credentials must never be stored under `VITE_`, committed to GitHub or sent to the chat. Each individual `submitChatGptFile` now uploads four responsive WebPs automatically after the original R2 record. If derivative upload fails, repeat the same submission: the original source request is idempotent and existing identical derivatives are reused. The pending image does not become public until a separate verified review.

The companion ImageKit pipeline remains optional, with its own Git-tracked catalog. Game-side assets are served from Cloudflare R2; this avoids accidentally exposing unapproved candidates in public ImageKit delivery. Both pathways use original backups; do not double-count them as synchronized stores.

## API security and compatibility

`PUT /api/appearance/variants/:assetId/derivatives/:width` requires the existing bearer admin token plus `Content-Type: image/webp` and `x-source-sha256` matching the stored PNG. Width is limited to 160, 320, 640 or 1024. R2 derivative writes are immutable for a given asset/width. Blocked images cannot accept derivatives.

`GET /api/appearance/assets/:assetId?w=320` remains **approved-only**; it responds as WebP when the derivative is present, otherwise as legacy PNG. The same authorization checks apply to every width. `/api/appearance/catalog` returns only approved rows. The game uses `?w=160`/ `?w=320` for avatar 1x/2x, and polls once per minute. No artificial image-per-day count is introduced; provider limits and real resource/compute costs still apply.

## Verification boundaries

GitHub CI tests mock D1/R2 and provider responses; `npm test`, `npm run build` and `npm run verify:site` validate code and behavior. They do **not** verify live Google OAuth, an actual production Worker/R2 database, an ImageKit account, the ChatGPT host image bytes event, or independent visual identity QA. Do not describe those as completed without a real test and acknowledgement.

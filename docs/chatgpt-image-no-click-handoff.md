# ChatGPT Images → Nanal zero-click image handoff: integration boundary (2026-10-24)

## Completed code
- `server/chatgpt-import/auto-submit.mjs`: `autoSubmitGeneratedImage({appearanceId, slot, pngBytes}, {baseUrl, ownerToken, fetcher})`.
- Given actual ChatGPT-generated RGBA PNG **binary bytes** in a trusted host context, no additional manual upload/click is needed from the user. The helper:
  1. Takes the explicit existing AP ID and portrait/fullBody slot.
  2. Validates PNG chunk CRC/dimensions, decodes RGBA pixels, rejects opaque/magenta technical background.
  3. Uses authenticated `GET /api/appearance/identities/APxxx` to obtain registered canonical profile/anchor hashes.
  4. Posts authenticated multipart PNG to `POST /api/appearance/identities/APxxx/variants`; generates a deterministic idempotency key from real SHA-256 bytes.
  5. Returns receipt only when server acknowledges a persisted `assetId`. State is `awaiting_review` until visual QA, not `approved`.
- No call to OpenAI Images API or the legacy Nanal `appearance_generate_reserved_batch` queue. No independent app-side daily generation count cap.
- `server/chatgpt-import/auto-submit.node-test.mjs` tests actual RGBA PNG bytes against authenticated mock HTTP endpoints, bad inputs, wrong ID, opaque/magenta backgrounds, duplicate handling, server failure.

## Actual blocking boundary (NOT implemented by ChatGPT host)
- The ChatGPT Images tool available to this project returns a **rendered chat image**, not a public, persistent, signed PNG link or data bytes consumable by connector tools.
- ChatGPT's Images/Library UI can show generated images but **file metadata is not raw image bytes**. Files.Library metadata listed generated images; `files.materialize` on actual generated items returned `This Project file does not have an authorized raw-byte materialization path.`
- There is currently no exposed "new ChatGPT image generated" event stream, tool result byte handle, or user-approved native plugin handoff for this project's installed Nanal connector. No code inside this public GitHub frontend can grant that ChatGPT host permission or extract protected image data.
- This repository likewise cannot set the official Nanal generator's remote `dailyJobLimit: 2`, though it avoids that path.
- The game-side D1/R2 backend is **not deployed** here. An owner-provided Worker endpoint, D1/R2 credentials/bindings, and 32+ character bearer token are required. Keep bearer secret out of browser, GitHub commits, prompts, and issue logs.
- Official Nanal plugin DB and new game-side D1 DB are separate. This helper submits to game-side DB, not the official Nanal plugin's existing ID variant store.

## To achieve truly hands-free delivery
1. ChatGPT host / plugin owner must expose a permissioned **image-generation completion callback** or a secure raw-file-handle resolver to a trusted connector app (not a model-supplied arbitrary URL).
2. On success, pass exact image byte buffer, AP ID and portrait/fullBody role to `autoSubmitGeneratedImage`. If not available, fail visibly and leave image in Images; never claim success.
3. Server-side adapter must hold the Nanal admin token privately and call the configured HTTPS game-side API.
4. Deploy the game-side D1/R2 backend, run migration, verify admin route and storage access.
5. Perform a real ChatGPT-image result → image bytes → deployed Nanal asset → independent visual QA → approved in-game image end-to-end test.
6. For **initial reserved pairs** in official Nanal plugin DB, use `appearance_submit_reserved_images` with both actual images once host exposes them; for existing-ID variants, plugin owner must add a corresponding upload tool or sync with game-side DB.

**Current achievable status: helper and code tests ready, actual zero-click ChatGPT host handoff not available through installed tools.** The user's subscription image limits and platform safety policies still apply; no extra image API is used in this helper.

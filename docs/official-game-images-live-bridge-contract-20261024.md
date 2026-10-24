# Official Nanal → game image integration: deploy/run contract (2026-10-24)

Scope: AP001–AP020 **and all future AP IDs**. Code branch: `work/ap008-canonical-automation-rfc`. This is a trust-separated integration, NOT a claim that the official plugin backend has been modified.

## Implemented on the GAME repository

- `server/image-pipeline/official-backend-client.mjs` provides a secret-authenticated, HTTPS-origin-locked, no-redirect client for official roster, reservations, canonical PNG bytes and existing-AP image variants. Original bytes are streamed with a 16-MiB bound and verified against their official SHA-256. Arbitrary external image URLs/paths are refused.
- `createOfficialHostAdapters()` adapts this client to the existing `handoffGeneratedArtifact` and `recoverCanonicalSource` trusted host code without creating a new character ID.
- `scripts/sync-official-appearance-targets.mjs` reads the full official roster and every reported per-character image target, verifies the previously reviewed matching game identity/profile hash, then updates targets in protected game APIs.
- `.github/workflows/sync-official-appearance-targets.yml` runs hourly on the default branch **only after explicit owner opt-in** via repository variable `NANAL_OFFICIAL_SYNC_ENABLED=true` and secure secrets. Missing authority or target yields a failed/partial result, not fabricated success.
- `src/appearance-pixel-qa.ts` decodes real RGBA PNG IDAT scanlines, unfilters PNG rows and checks transparency, visible foreground, obvious full-body crop and saturated technical magenta artifacts before accepting either game upload path.
- `src/approved-fullbody.ts`, `src/main.tsx` and `src/style.css` render only game-approved, same-origin full-body assets on player/NPC detailed profiles, loaded through the existing minute-level approved-catalog refresh. Full-body image is never substituted for a face portrait. If a character is not bound to an approved face asset, the game profile does not yet show that character's full-body gallery.
- All new files are covered by GitHub Actions tests; CI does not verify a real upstream official API or deployed Cloudflare D1/R2 environment.

## Missing upstream work: must be implemented by the ACTUAL official Nanal backend operator

The existing Nanal ChatGPT plugin currently exposes only `appearance_get_reservation` and first-pair reservation upload; it does **not** expose a trusted raw canonical-file read or existing-ID variant submission tool. The game's service-to-service bridge cannot grant itself this authorization.

Implement the following HTTPS API contract in the **official** server (or a genuinely authorized trusted backend backed by the same original DB); the names here are newly defined, NOT confirmed existing Nanal endpoints:

| Method / path | Expected behavior |
| --- | --- |
| `GET /v1/appearance/identities` | Authenticated list of ALL current/future official `AP\d{3,5}` IDs, e.g. `{"appearanceIds":["AP008","AP021"]}` |
| `GET /v1/appearance/identities/AP008/reservation` | Existing locked original reservation, including `brief.fullBodyTarget`, current status, original relative file paths |
| `GET /v1/appearance/identities/AP008/canonical` | Locked identity data + identity SHA-256 + official source-approved portrait/fullBody metadata + independent visual QA evidence, no raw public links |
| `GET /v1/appearance/approved-assets/{assetId}/original` | Owner-authenticated, no-cache `image/png` original bytes. Return only real immutable approved source bytes |
| `POST /v1/appearance/identities/AP008/variants` | `multipart/form-data` existing-ID supplemental image upload: `role`, `index>=2`, `requestKey`, `anchorSha256`, `originalSha256`, `file`. Reply actual `{"appearanceId":"AP008","assetId":"...","status":"awaiting_review","originalSha256":"..."}` |
 
Server MUST independently authorize caller scope, enforce immutable checksum/identity/role/index/idempotency and return proper 401/403/404/409/413/422/429/5xx. It MUST NOT automatically approve art based on mechanical checks. The game D1/R2 is a separate database.

The canonical response for `recoverCanonicalSource` additionally requires:
- `appearanceId`, `designVersion`, `identity`, `identitySha256` canonical SHA (stable field serialization), `portrait` and `fullBody` each with `assetId`, `role`, `approved:true`, `sha256`, `sourcePath`, `downloadPath`;
- `sourcePath` must match the locked reservation `images.portrait` / `images.fullBody` exactly;
- `approvalEvidence` with `appearanceId`, `reviewer`, `reviewedAt`, 30+ char notes, matching portrait/fullBody checksums and all five explicit true QA fields: `faceIdentityPass`, `heightScalePass`, `bodyProfilePass`, `chestSilhouettePass`, `referencePairIdentityPass`.
- The actual canonical face/body PNGs are retrieved only via the trusted official authorized originals endpoint and must independently pass PNG+alpha QA before the host can edit the same person.

## Secret/activation policy

Never put a service token in GitHub code, `VITE_` variables, public artifacts, ChatGPT messages or image prompts.

| GitHub Actions secret | Value type |
| --- | --- |
| `NANAL_OFFICIAL_API_ORIGIN` | Actual deployed official service HTTPS origin, no path/query |
| `NANAL_OFFICIAL_SERVICE_TOKEN` | 32+ character **official** least-privilege service credential |
| `NANAL_GAME_API_ORIGIN` | Actual deployed Nanal game Worker HTTPS origin |
| `NANAL_APPEARANCE_ADMIN_TOKEN` | 32+ character game Worker secret (already stored on game server) |
| Repository variable `NANAL_OFFICIAL_SYNC_ENABLED` | Set to `true` **only after** upstream/API verification |

The official service and game deployment are **not** known to be ready, and these credentials are not present in this conversation. An opt-in workflow is not itself a completed live sync.

## End-to-end operational gate

1. Check live official roster, locked AP reservation and official canonical original bytes; compare SHA-256 and visual QA evidence.
2. Run `recoverCanonicalSource` on the original AP. If no source PNG and QA proof, do not generate substitute images.
3. Edit **directly** from that AP's approved anchors using ChatGPT Images; host must supply the real generated PNG bytes. No unauthorized independent paid image API.
4. Use `createOfficialHostAdapters` for official existing-AP variant submission **only if official endpoint is live**. Independently submit to game D1/R2 through its existing verified backup-first path; record both receipts without conflating the stores.
5. Both new game ingestion routes now perform structural and pixel-level PNG QA before pending storage. Face/height/build/same-person match requires independent visual review and owner decision. Approval then feeds the public catalog and game UI automatically on its next refresh.
6. Deploy migration 001 then 002 to real D1, provision R2 and administer secrets. Verify two distinct new AP008 approved IDs, both SHA checksums, private backups, game pending→approved transitions and actual mobile rendering.
7. Reconcile legacy and future AP assets using official roster/target sync; compare hashes and approval states between sources, not counts alone. Until the original official server permits reading and uploading, **the upstream piece remains blocked**.

## Automated limits and error handling

No invented application-level 2-images-per-day cap. Respect actual provider rate limits, manual QA requirements, idempotency and 429 retry-after. Private pending files never enter the game catalog. Future identity enrollment needs validated official canonical references first; a roster response **alone** is not permission to create game identity rows.

## Remaining limitation

The current game catalog endpoint serves a fixed page of at most 500 approved files. Before shipping to a very large roster, implement cursor pagination and complete-client refresh so older approved art is not missed. The existing full-body gallery also requires the relevant approved portrait to be associated with a game character.

**Do not merge or claim production E2E success solely on mock-backed CI.**

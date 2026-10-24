# Nanal original backup + ImageKit game image pipeline

## Behavior
Image generation stays in ChatGPT Images; this importer **does not generate images**. The supplied source file must be obtained from a real approved image-generation response or authenticated source. The CLI never bypasses image-generation rate limits or safety review.

The importer, for each `APxxx` image:
1. Validate explicit ID, variant, source, actual source metadata, and SHA-256 master anchor on supplemental images.
2. Make an immutable local source backup under ignored `.nanal-private/originals/APxxx/`.
3. Convert to WebP using sharp (transparent alpha is preserved) and store an optimized local candidate.
4. By default, upload original source to an independent private Google Drive backup folder; verify MD5 and byte length. Abort if missing or mismatched.
5. Upload **only optimized WebP** to ImageKit using a server-side private API key, with overwrite disabled.
6. Atomically stage a catalog record as `status: "awaiting_review"` and `runtimeEligible: false`. No automatic game approval.

A pre-existing asset ID with identical source SHA-256 is safe to retry after registration. Different source hashes for the same ID are rejected. Concurrent catalog writes are serialized with a lock. If the process dies during upload before catalog registration, reconcile the existing ImageKit file manually before retrying; never overwrite an existing original or CDN file.

## Local command

```sh
npm install
npm run images:import -- --file /safe/source/AP017-fullbody.png --character AP017 --kind fullbody --index 1 --gender 여성 --age-min 20 --age-max 29 --dry-run
```

Once source content and final metadata have been checked, configure **server-side only** secrets in a secure terminal or trusted CI environment:

```sh
export GOOGLE_DRIVE_BACKUP_FOLDER_ID=...
export GOOGLE_DRIVE_ACCESS_TOKEN=... # or use GOOGLE_DRIVE_REFRESH_TOKEN + GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET
export IMAGEKIT_PRIVATE_KEY=...
export IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/YOUR_ENDPOINT/nanal
npm run images:import -- --file /safe/source/AP017-fullbody.png --character AP017 --kind fullbody --index 1 --gender 여성 --age-min 20 --age-max 29
```

The Google Drive OAuth credential must have permission to upload into the designated **private** parent folder. Prefer refresh-token authorization for unattended use; never put secrets into `VITE_` variables, public GitHub files or the browser. The only Vite variable is the public `VITE_IMAGEKIT_URL_ENDPOINT`. The ImageKit file folder for this uploader is `/nanal/APxxx`; the configured CDN endpoint must resolve this folder in its path.

For a supplemental `--index 2` or later, supply the known and verified 64-character master `--anchor-sha256`, otherwise import is rejected. SHA-256 records provenance but cannot itself prove visual identity, face similarity, pose quality, physique consistency or transparent-background quality; human/visual QA remains mandatory before `approved` and `runtimeEligible:true`.

An explicit `--local-only` flag permits uploading without independent Drive backup; this is an operator exception, **not the default**. Never rely on only local files for disaster recovery. A dry run validates and converts but does not upload or alter the catalog.

## Frontend delivery
`src/portrait-image.ts` builds `tr=w-160,q-75,f-auto` and `tr=w-320,q-75,f-auto` URLs for 1×/2× avatars. Other approved profile/full-body displays may request widths 640/1024. CSS must use `object-fit: contain` for full-body image views. Unreviewed files and `fullbody` records do not enter the face selection catalog.

## Verification
`npm test` includes mocked network tests of backup-first ordering, checksum gate, no overwrite, dry run, and reimport idempotency; `npm run build` verifies React/TS. Remote Google Drive OAuth, account quotas, live ImageKit uploads, and final game display cannot be confirmed without real credentials and a visually approved asset. Never mark those steps finished based on mocks.

Official docs: https://imagekit.io/docs/api-keys · https://imagekit.io/docs/image-transformation · https://developers.google.com/workspace/drive/api/guides/manage-uploads

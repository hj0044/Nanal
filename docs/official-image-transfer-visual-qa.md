# Nanal official DB handoff and reference-image visual QA

## Official database versus game appearance store

Two distinct destinations exist:
- **Official Nanal connector database:** presently supports locked ID reservation and uploading the first portrait+full-body pair using `appearance_submit_reserved_images`. The connected tool **does not currently expose** uploading extra images to already approved AP IDs. This repository cannot grant that missing connector permission.
- **Game-side Cloudflare D1/R2:** `POST /api/appearance/actions/ingest` can receive the GPT Action's real `openaiFileIdRefs` for one image, when supported by the host runtime. The file is stored under `awaiting_review`. This does not sync to the official Nanal connector database.

The new `handoffGeneratedArtifact({mode:"official-existing-variant",...})` contract accepts an **optional authorized** `submitOfficialVariant` adapter, but **fails with** `official_variant_submission_action_not_exposed` when absent. It never silently routes an official upload to the game DB or claims success. An official connector publisher must implement a real authenticated `appearance_submit_variant` server action, with AP ID/locked metadata, immutable source file hashes, duplicate handling, and review-pending acknowledgements. Do not publish a fake Action in the OpenAPI schema before it exists.

Custom GPT Actions support `openaiFileIdRefs` as expiring file references from the conversation and the official documentation explicitly discusses DALL-E-generated images. Compatibility of the **current ChatGPT Images output** has **not yet been live-tested** for this configuration. The existing `integrations/gpt-actions/nanal-images.openapi.yaml` path is the *game-side* route only. A Custom GPT owner must install/update its Action and configure the live HTTPS Worker endpoint and owner token; repository commits cannot perform account-level setup.

## Automated image consistency checks

`server/image-pipeline/visual-consistency.mjs` performs mechanical comparison of actual PNG bytes with a private verified master PNG:
- SHA-256 of source and reference (index 1 must exactly match official anchor)
- PNG dimensions and alpha quality; transparent background and visible opaque character
- normalized foreground bounding box, foreground scale and 24-point width/silhouette profile
- upper part of the foreground's difference hash, **not** a biometric/face identity recognition embedding
- documented consistency flags and priority for a visual reviewer

It produces `approved:false`, `automatedIdentityConfirmed:false` **always**. It can find duplicate image bytes, large silhouette/canvas-scale discrepancies and conspicuous upper-image differences, but cannot establish that a face, height, weight, chest silhouette or body pose matches the intended person without separate visual evidence. Never convert this into an auto-approval score; preserve the existing authenticated review endpoint's requirement for positive evidence.

### Strict automatic comparison while submitting a saved/generated file

Pass `referenceFilePath` and `visualQaRequired:true` to the trusted `submitChatGptFile` / `submitChatGptBytes` or game-variant host handoff, together with the verified `profile.heightCm` and `profile.weightKg`. The reference PNG is SHA-256 checked against the locked `portraitAnchorSha256` or `fullBodyAnchorSha256`. For subsequent images (index 2+), this triggers a reference comparison **before** remote import and saves an immutable private JSON report under `.nanal-private/qa/ASSET_UUID.json`. When no verified reference is available, the input cannot pass strict comparison; ordinary awaiting-review upload without comparison is still available to preserve existing workflow.

**Do not claim visual QA ran** when `visualQaStatus:reference_not_provided`.

### Compare an existing ChatGPT Actions candidate without manually downloading it

The game-side admin image endpoint `GET /api/appearance/admin/assets/:assetId` already retrieves the private original PNG via owner token. The new CLI securely fetches it and compares it to the locked local reference. It never approves assets automatically.

```bash
export NANAL_APPEARANCE_ADMIN_TOKEN=YOUR_SECRET_IN_SECURE_ENV
npm run images:visual-qa -- \
  --appearance AP008 --role portrait \
  --reference .nanal-private/originals/AP008/LOCKED-PORTRAIT.png \
  --anchor-sha256 YOUR_64_CHAR_VERIFIED_SHA256 \
  --height-cm 162 --weight-kg 49 \
  --game-origin https://YOUR_DEPLOYED_GAME_ORIGIN/ \
  --asset-id YOUR_ACTUAL_36_CHAR_ASSET_UUID
```

Local candidate alternative: replace `--game-origin` / `--asset-id` with `--candidate .nanal-private/inbox/AP008-portrait-002.png`.

The resulting JSON contains `flags`, `recommendedAction`, and explicit limitations. If discrepancies are detected, prioritize manual visual reference checks (eyes, face shape, hairstyle, shoulder/waist/hip silhouette, known locked body statistics). Only a confirmed approved review can make it visible in the game. Store private body reference assets and credentials outside public GitHub. No existing AP imagery was downloaded/reviewed by this code change.

## Steps to complete true hands-free operation

1. Deploy Cloudflare Worker with D1/R2 and verified official character identity anchors. Enable the HTTPS GPT Action and its server-side bearer token.
2. In the actual Custom GPT context, confirm one **currently generated** image appears as a valid `openaiFileIdRefs` item and receives HTTP 201/200 from the deployed endpoint (no invented file ref/URL).
3. Grant an official connector action for **existing AP variants** on the official plugin backend; provide the corresponding trusted `submitOfficialVariant` adapter. Until then these uploads cannot directly enter that official plugin DB.
4. Provision accessible private canonical portrait/full-body originals and a trusted worker trigger running reference comparison for each newly ingested asset; otherwise `npm run images:visual-qa` is an explicit CLI trigger rather than unattended execution.
5. Use a separate actual reviewer or validated vision model with real reference evidence before the approval API runs. Check game catalog/asset after approval. Never misrepresent mock tests as live image matches.

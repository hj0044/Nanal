# Optional AI event generation contract v1

## Current behavior

The current game uses 60 curated event definitions and makes no model/API calls. AI is used during development to draft content; the event library is reviewed, checked in, and available offline. This keeps player-side API cost at zero and game behavior deterministic.

## Extension boundary

`src/event-generation.ts` defines the future provider interface and validates untrusted model output. A later server adapter may implement `EventGenerationProvider`; the game loop should continue to select curated events first and request a generated event only when the player has opted in and the curated pool is exhausted or a requested narrative mode needs one.

The browser must never contain provider credentials. Any provider call belongs behind a server endpoint, for example `POST /api/events/generate`. The endpoint and live model integration do not exist yet.

## Request contract

Send only the minimum context needed to write a relevant scene:

- `background`: student, jobseeker, or worker
- `year`, `ageBand`, `week`, and `day`
- recent event IDs for repetition avoidance
- enabled sensitive-topic flags
- broad relationship signals such as `close-friend` or `coworker`

Do not send player names, NPC names, free-text memories, contact details, exact balances, save files, or unrelated personal data. The current client type intentionally has no fields for those values.

## Response contract

Return one JSON object shaped like `LifeEvent`: `id`, `title`, `eyebrow`, `body`, optional `topic`, and two or three `choices`. Each choice contains `id`, `title`, `detail`, `result`, and a bounded `effect`. Do not return HTML, executable code, URLs, or instructions to the player.

`validateGeneratedEvent()` rejects malformed JSON, unknown topics, disabled sensitive topics, duplicate/invalid IDs, overlong text, unknown effect keys, and excessive numeric effects. Rejected output falls back to the curated pool; it must never block time progression or corrupt a save.

## Operational rules for a future live mode

1. Keep live generation off by default and let the player explicitly enable it.
2. Show a clear cost/availability notice before enabling any provider that may charge.
3. Set a short timeout, strict output-token cap, per-player rate limit, and cache key based on non-identifying context.
4. Validate output on the server and client; never execute model-provided code or trust model-selected effects.
5. On timeout, provider error, invalid content, or exhausted quota, use the curated event library and preserve deterministic game progress.
6. Add provider-specific code only behind the interface. Do not tie game logic to one model vendor.

## Acceptance checks

- No provider request is made while live generation is disabled.
- API keys are absent from browser bundles and saves.
- Valid output passes the validator; invalid, extreme, duplicate-ID, and disabled-topic output is rejected.
- Failure falls back to curated events without duplicating the same event or advancing a day twice.

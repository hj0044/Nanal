# Narrative generation contract v1

## Current behavior

The game engine selects and resolves curated events. When the host exposes `GET /api/narrative-status` and reports `available: true`, the client may ask `POST /api/narrative-event` to rewrite the wording of the already-selected event. This is a text-only pass: event IDs, choice IDs, NPC targets, choice effects, time progression, and save data remain controlled by the game engine.

When the endpoint is missing, unavailable, slow, or returns invalid output, the authored event remains playable without interruption. Local Vite development therefore uses curated copy unless a compatible server route is provided.

`src/event-generation.ts` retains a validator for a separate future experiment that would generate complete events. It is not used by this live narrative-rewrite path; generated mechanics must not be added to the current endpoint contract.

## Request contract

The browser sends a schema version, the selected event's sanitized copy, and a small context object. The request excludes:

- player and NPC names, stable NPC IDs, and portrait identifiers
- free-text memories and goals
- exact balances, full saves, or unrelated profile data
- gameplay effects and internal contact indices

Context contains broad categories only: background, decade, month/season, region type, housing category, a pressure band, up to three relationship/character signal summaries, and recently used event families. Memory text is classified locally into a small fixed set of signals before transmission.

The server must keep provider credentials outside the browser and validate all inputs. The model receives the authored choices' IDs and words but never their effects.

## Response contract

The endpoint returns `title`, `eyebrow`, `body`, the same two or three choice IDs with rewritten `title`, `detail`, and `result`, and `npcDialogueLine` when a speaker is present. The client rejects missing, duplicate, or changed choice IDs and malformed or overlong text. It then merges only those strings into the authored event.

The client also re-sanitizes returned prose to prevent names or NPC goal text from being reintroduced. It preserves the NPC speaker name locally and never accepts a model-provided effect or event structure.

## Operational rules

1. Never place provider credentials in browser assets, local storage, or exported saves.
2. Keep curated text visible and choices usable while rewriting is pending.
3. Abort a slow client request and use the curated text on timeout, endpoint failure, invalid content, or quota exhaustion.
4. Apply a response only if the same event is still open; never advance a day twice.
5. Keep sensitive-topic policy and relationship mechanics in the game engine.
6. Preserve the host's server routes when packaging a new frontend build. The current Nanal Site owns the Gemini route and its secret; this repository owns the maintainable game source.

## Acceptance checks

- No API request occurs when the status endpoint is unavailable or reports `available: false`.
- Request construction does not include names, stable NPC IDs, free-text memories/goals, or effects.
- Valid response text can change while choice IDs, targets, effects, and event metadata stay unchanged.
- Invalid response, network failure, and abort leave the authored event playable.
- A stale response cannot replace a later event.
- Existing version 1 saves remain loadable.

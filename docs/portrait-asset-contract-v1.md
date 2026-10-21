# Portrait asset contract

Portrait files are reusable art assets, not identities. Never bind an asset to an NPC name or role.

## Adding an asset

1. Add the approved `.webp` image to `src/assets/character-portraits/`.
2. Add a record to `src/assets/character-portraits/catalog.json` with a unique `assetId`, a `characterId`, visually reviewed `gender`, estimated age range, matching `filename`, and `runtimeEligible: true`.
3. Use the same `characterId` for alternate images of the same depicted person. The runtime de-duplicates these so one game does not treat obvious variants as different people.
4. Keep names, NPC IDs, occupations, and relationship data out of this manifest. They belong to the game simulation.

The Vite asset glob discovers new WebP files automatically; no portrait-specific code edit is needed. Catalog metadata must match the visible image. `gender` is used for the current game's male/female character setup and `ageEstimate` is used to prefer an age-compatible face. Art outside a character's age range is not selected unless there is no closer eligible option.

## Assignment and save behavior

- A new game receives a fresh seed. The seed selects age- and gender-compatible, non-duplicate portraits for the player and contacts.
- Replaying or reloading the same save preserves each `portraitId`.
- Creating a new game with a different seed reassigns portraits. Reused names do not carry portraits between games.
- If catalog metadata is corrected or an old saved portrait no longer matches its character's gender, save normalization repairs that assignment.

When assets arrive from another conversation, copy them into this repository and update the manifest using this contract. Adding files alone is insufficient because the engine needs reviewed age and gender metadata.

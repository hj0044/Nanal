# Portrait asset contract (historical v1)

> Current canonical uploader/delivery instructions: [character-image-pipeline.md](character-image-pipeline.md).
> The old local-WebP asset glob rules below are superseded by the ImageKit manifest integration in src/portrait-catalog.ts. As of 2026-10-24, no asset is approved in catalog.json.

# Portrait asset contract

Portrait files are reusable art assets, not identities. Never bind an asset to an NPC name or role.

## Adding an asset

1. Add the approved `.webp` image to `src/assets/character-portraits/`.
2. Add a record to `src/assets/character-portraits/catalog.json` with a unique `assetId`, a `characterId`, visually reviewed `gender`, estimated age range, matching `filename`, and `runtimeEligible: true`.
3. Use the same `characterId` for every image of the same depicted person. The face picker shows one representative image per identity, while the age-stage resolver can switch to another approved image in that identity when its `ageEstimate` matches the character's new age. Same-age crops or alternate expressions do not create extra identities and are not age stages.
4. Keep names, NPC IDs, occupations, and relationship data out of this manifest. They belong to the game simulation.

The Vite asset glob discovers new WebP files automatically; no portrait-specific code edit is needed. Catalog metadata must match the visible image. `gender` is used for the current game's male/female character setup and `ageEstimate` is used to prefer an age-compatible face. Art outside a character's age range is not selected unless there is no closer eligible option.

## Assignment and save behavior

- A new game receives a fresh seed. The seed selects age- and gender-compatible, non-duplicate portraits for the player and contacts.
- Replaying or reloading the same save preserves each `portraitId`.
- Creating a new game with a different seed reassigns portraits. Reused names do not carry portraits between games.
- If catalog metadata is corrected or an old saved portrait no longer matches its character's gender, save normalization repairs that assignment.
- Only individually registered WebP portraits in this catalog are active. The old NPC atlas (`npc-01`–`npc-16`) and `people-portraits.webp` are retired and excluded from gameplay. Saves that reference those IDs receive a newly seeded catalog portrait on load, including archived NPCs.
- A character's age increases once every 52 simulated weeks. A same-identity image is used for an age stage only when its reviewed age range fits. Without a matching image, the current face is preserved.
- Manual face choices are saved per player/NPC, never copied between saves, and reserve that visual identity for the chosen character for the rest of that save, including while the NPC is archived.
- Previous face images are retained in the character's appearance history when a manual change or approved age-stage change occurs.

## Age-stage art to add later

To enable visible age evolution, add an age-appropriate portrait for the existing `characterId` and give it a reviewed age range in the manifest. Keep identity metadata stable across life stages. The runtime does not invent or morph facial features. Seasonal clothing and hairstyle changes need their own reviewed, identity-linked art layers; they are not inferred from face portraits.

When assets arrive from another conversation, copy them into this repository and update the manifest using this contract. Adding files alone is insufficient because the engine needs reviewed age and gender metadata.

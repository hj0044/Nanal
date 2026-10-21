# NPC personal stories v1

NPC personal stories are a deterministic layer on top of the 60-event curated pool. They use the existing relationship warmth, profile goal, role, and memory fields. No model or network request is involved.

## Player flow

1. A sufficiently close NPC brings up a personal concern tied to their role and current goal.
2. The player can listen, help make a plan, or give the NPC room to decide.
3. The selected response is stored against that NPC. The NPC's detail page updates its recent-memory text.
4. The NPC returns in a later week with a follow-up whose narration reflects the earlier response.
5. A final scene closes the arc while allowing the relationship to continue changing.

## Guardrails

- Only the closest currently eligible NPC gets a personal-story event candidate, avoiding a flood of simultaneous arcs.
- Each stage is separated by at least one week; the first stage requires warmth 63, follow-up 52, and closing stage 58.
- Story stage, last story week, and the player's prior response are saved as optional fields. Older v1 saves default to an empty story state.
- Personal-story events receive higher selection weight than ordinary events, but still use the same seeded event roll and pause/choice flow.
- Choices affect the same NPC's relationship and recorded memory; other contacts are unchanged.
- A story can include unresolved outcomes. The NPC's goal is not treated as an automatic success condition.

## QA cases

- Replaying the same save and seed yields the same story candidate.
- Stage 1 cannot appear again in the same week as stage 0.
- The next stage includes the previous response in its narrative.
- An old save with no story fields remains playable and gains story state after the first arc.

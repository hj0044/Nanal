import { officialReservationTargetUpdates } from "../../src/appearance-inventory.ts";

/**
 * Trusted host only. This does not access the official Nanal server by itself.
 * listOfficialAppearanceIds must include ALL current and future AP characters;
 * appearanceIds may be passed for an explicit one-time backfill.
 *
 * A missing official list/read permission does not silently produce an empty
 * "fully synchronized" result. It fails with a clear external dependency.
 */
export async function synchronizeOfficialImageTargets(
  { appearanceIds } = {},
  adapters = {}
) {
  const { listOfficialAppearanceIds, getOfficialReservation, getGameIdentity, submitGameTarget } = adapters;
  if (![getOfficialReservation,getGameIdentity,submitGameTarget].every(fn => typeof fn === "function"))
    throw Error("official_target_sync_adapters_missing");
  if (appearanceIds == null && typeof listOfficialAppearanceIds !== "function")
    throw Error("official_character_list_action_not_exposed");
  const rawIds = appearanceIds == null ? await listOfficialAppearanceIds() : appearanceIds;
  if (!Array.isArray(rawIds)) throw Error("official_character_index_invalid");
  const ids = [...new Set(rawIds)];
  if (ids.some(id => typeof id !== "string" || !/^AP[0-9]{3,5}$/.test(id)))
    throw Error("official_character_index_invalid");

  const entries = [];
  for (const appearanceId of ids.sort()) {
    try {
      const reservation = await getOfficialReservation({ appearanceId });
      const targets = officialReservationTargetUpdates(reservation);
      if (!targets.length) {
        entries.push({appearanceId,status:"target_not_reported",targetsRecorded:0});
        continue;
      }
      const identity = await getGameIdentity({ appearanceId });
      if (!identity || identity.appearanceId !== appearanceId ||
          identity.reviewedOfficialReservation !== true ||
          !/^[a-f0-9]{64}$/i.test(identity.profileSha256 ?? "")) {
        entries.push({appearanceId,status:"canonical_game_identity_not_verified",targetsRecorded:0});
        continue;
      }
      const accepted=[];
      for (const target of targets) {
        const result = await submitGameTarget({
          ...target,
          profileSha256: identity.profileSha256
        });
        if (!result || result.appearanceId !== appearanceId ||
            result.slot !== target.slot ||
            result.targetCount !== target.targetCount ||
            !["recorded","unchanged"].includes(result.status))
          throw Error("game_target_registration_not_acknowledged");
        accepted.push({slot:target.slot,targetCount:target.targetCount,status:result.status});
      }
      entries.push({appearanceId,status:"synced",targetsRecorded:accepted.length,targets:accepted});
    } catch(e) {
      entries.push({appearanceId,status:"sync_failed",
        targetsRecorded:0,error:e instanceof Error ? e.message : "unknown_error"});
    }
  }
  return {
    scope:appearanceIds==null?"dynamic_official_list":"explicit_backfill",
    scanned:ids.length,
    synced:entries.filter(x=>x.status==="synced").length,
    blocked:entries.filter(x=>x.status==="sync_failed" || x.status==="canonical_game_identity_not_verified").length,
    complete:entries.every(x=>x.status==="synced"),
    entries
  };
}

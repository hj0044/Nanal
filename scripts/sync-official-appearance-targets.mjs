import { createOfficialNanalBackendClient } from "../server/image-pipeline/official-backend-client.mjs";
import {
  createGameTargetApiClient,
  synchronizeOfficialImageTargets
} from "../server/image-pipeline/official-inventory-sync.mjs";

/**
 * Service-to-service only; use Actions Secrets, not VITE_ or chat messages.
 * This synchronizes VERIFIED image TARGETS, not approved image binaries.
 * If the official server has not implemented /v1/appearance this fails.
 */
export async function syncOfficialAppearanceTargets(env=process.env,fetchFn=fetch) {
  const required=[
    "NANAL_OFFICIAL_API_ORIGIN","NANAL_OFFICIAL_SERVICE_TOKEN",
    "NANAL_GAME_API_ORIGIN","NANAL_APPEARANCE_ADMIN_TOKEN"
  ];
  const missing=required.filter(key=>!env[key]);
  if(missing.length)throw Error("official_sync_configuration_missing:"+missing.join(","));
  const official=createOfficialNanalBackendClient({
    officialApiOrigin:env.NANAL_OFFICIAL_API_ORIGIN,
    officialServiceToken:env.NANAL_OFFICIAL_SERVICE_TOKEN,
    fetchFn
  });
  const game=createGameTargetApiClient({
    gameApiOrigin:env.NANAL_GAME_API_ORIGIN,
    adminToken:env.NANAL_APPEARANCE_ADMIN_TOKEN,
    fetchFn
  });
  return synchronizeOfficialImageTargets({},{
    listOfficialAppearanceIds:official.listOfficialAppearanceIds,
    getOfficialReservation:official.getOfficialReservation,
    getGameIdentity:game.getGameIdentity,
    submitGameTarget:game.submitGameTarget
  });
}

if(process.argv[1]?.endsWith("sync-official-appearance-targets.mjs")) {
  try {
    const result=await syncOfficialAppearanceTargets();
    // IDs, target counts and errors are not secrets. Never log signed URLs or tokens.
    console.log(JSON.stringify({
      source:"official_nanal_backend",scanned:result.scanned,synced:result.synced,
      blocked:result.blocked,complete:result.complete,
      statuses:result.entries.map(x=>({appearanceId:x.appearanceId,status:x.status}))
    }));
    if(!result.complete)process.exitCode=2;
  } catch(e) {
    console.error(e instanceof Error?e.message:"official_sync_failed");
    process.exitCode=2;
  }
}

import {createHash} from "node:crypto";
import {preflightPng} from "../../server/image-pipeline/game-db-submit.mjs";
import {compareAppearancePngs} from "../../server/image-pipeline/visual-consistency.mjs";

/**
 * Drop-in SERVER-SIDE service for the official Nanal plugin host.
 *
 * Not wired to the currently installed Nanal connector: that MCP server is
 * independently hosted and its implementation/deployment is not accessible
 * from this repository.
 *
 * Requires host-backed canonical read and atomic pending-variant insertion.
 */
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const allowed=/^AP[0-9]{3,5}$/;
const sha=/^[0-9a-f]{64}$/i;
const response=(status,rest={})=>({status,...rest});

export function decodePngBase64(encoded){
  if(typeof encoded!=="string"||encoded.length<92||encoded.length>23_000_000 ||
    !/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded)||encoded.length%4!==0)
    throw Error("invalid_source_base64");
  const bytes=Buffer.from(encoded,"base64");
  if(bytes.toString("base64")!==encoded||bytes.length>16*1024*1024)
    throw Error("invalid_source_base64");
  return bytes;
}

/**
 * The production official plugin must implement:
 *   getApprovedCanonical(appearanceId) -> canonical row (never invented)
 *   findVariantByRequestKey(requestKey) -> persisted variant row or null
 *   createPendingVariantAtomic({metadata,originalPng,visualQa}) ->
 *     {assetId, status:'awaiting_review'}.
 *
 * createPendingVariantAtomic must use a unique request key, durable immutable
 * image storage and an atomic DB constraint. Never expose an image publicly
 * before a separate evidence-backed QA approval.
 */
export async function submitExistingOfficialVariant(input,backend){
  if(!input||!allowed.test(input.appearanceId??"")||
    !["portrait","fullbody"].includes(input.kind)||
    !Number.isInteger(input.index)||input.index<2||input.index>999)
    throw Error("invalid_existing_character_variant");
  const needed=["getApprovedCanonical","findVariantByRequestKey","createPendingVariantAtomic"];
  for(const name of needed)if(typeof backend?.[name]!=="function")
    throw Error("official_backend_adapter_missing:"+name);
  const canonical=await backend.getApprovedCanonical(input.appearanceId);
  if(!canonical||canonical.appearanceId!==input.appearanceId||
    canonical.reviewedOfficialReservation!==true||canonical.status!=="approved")
    throw Error("approved_canonical_identity_missing");
  const ref=canonical[input.kind==="portrait"?"portraitAnchorSha256":"fullBodyAnchorSha256"];
  if(typeof ref!=="string"||!sha.test(ref)||
    typeof input.referenceAnchorSha256!=="string"||input.referenceAnchorSha256.toLowerCase()!==ref.toLowerCase())
    throw Error("official_reference_anchor_mismatch");
  if(typeof canonical.profileSha256!=="string"||!sha.test(canonical.profileSha256))
    throw Error("verified_profile_hash_missing");
  const originalPng=Buffer.isBuffer(input.pngBytes)?input.pngBytes:
    decodePngBase64(input.pngBase64);
  if(originalPng.length>16*1024*1024)throw Error("image_too_large");
  await (backend.preflight??preflightPng)(originalPng,input.kind);
  const fileSha256=hash(originalPng);
  if(fileSha256===ref.toLowerCase())throw Error("duplicate_of_locked_master");
  const requestKey=input.appearanceId+":"+input.kind+":"+fileSha256;
  if(input.requestKey&&input.requestKey!==requestKey)
    throw Error("request_key_must_match_source_hash");
  const old=await backend.findVariantByRequestKey(requestKey);
  if(old){
    if(old.appearanceId!==input.appearanceId||old.kind!==input.kind||old.fileSha256!==fileSha256)
      throw Error("existing_request_key_conflict");
    return response(old.status,{appearanceId:input.appearanceId,assetId:old.assetId,
      duplicate:true,source:"official_nanal_plugin"});
  }

  // Explicit mechanical comparison only; no model/visual approval is inferred.
  let visualQa=null;
  if(input.referencePng){
    const refBytes=Buffer.from(input.referencePng);
    if(hash(refBytes)!==ref.toLowerCase())throw Error("reference_png_does_not_match_anchor");
    if(!Number.isFinite(canonical.heightCm)||!Number.isFinite(canonical.weightKg))
      throw Error("locked_body_statistics_missing");
    visualQa=await (backend.compareVisual??compareAppearancePngs)({
      appearanceId:input.appearanceId,role:input.kind,
      referencePng:refBytes,candidatePng:originalPng,
      lockedProfile:{heightCm:canonical.heightCm,weightKg:canonical.weightKg}
    });
    if(visualQa?.approved!==false||visualQa?.automatedIdentityConfirmed!==false)
      throw Error("visual_qa_must_remain_unapproved");
  }
  const metadata={
    appearanceId:input.appearanceId,kind:input.kind,index:input.index,
    requestKey,fileSha256,profileSha256:canonical.profileSha256,
    anchorSha256:ref.toLowerCase(),status:"awaiting_review",
    origin:"trusted_chatgpt_generated_image",
    uploadedBytes:originalPng.length,
    visualQaStatus:visualQa?.recommendedAction??"reference_not_provided"
  };
  let persisted;
  try{
    persisted=await backend.createPendingVariantAtomic({metadata,originalPng,visualQa});
  }catch(error){
    // Another host process may have inserted the same source concurrently.
    const concurrent=await backend.findVariantByRequestKey(requestKey);
    if(concurrent?.appearanceId===input.appearanceId&&
      concurrent.kind===input.kind&&concurrent.fileSha256===fileSha256)
      return response(concurrent.status,{appearanceId:input.appearanceId,assetId:concurrent.assetId,
        duplicate:true,source:"official_nanal_plugin"});
    throw error;
  }
  if(!persisted?.assetId||persisted.status!=="awaiting_review")
    throw Error("official_backend_did_not_confirm_pending_variant");
  return response("awaiting_review",{
    assetId:persisted.assetId,appearanceId:input.appearanceId,
    source:"official_nanal_plugin",duplicate:false,fileSha256,
    visualQaStatus:metadata.visualQaStatus
  });
}

/** Register this as appearance_submit_variant ONLY inside the actual official MCP server. */
export function createOfficialVariantAction(backend){
  return fields=>submitExistingOfficialVariant(fields,backend);
}

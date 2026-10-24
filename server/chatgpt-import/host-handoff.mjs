import { importChatGptInitialPair } from "./bridge.mjs";
import { submitChatGptBytes } from "../image-pipeline/game-db-submit.mjs";

/**
 * Adapter contract for trusted host code that receives actual ChatGPT image
 * artifacts. This module cannot subscribe to ChatGPT UI/image_gen events.
 *
 * - mode=official-initial-pair: official Nanal connector's reserved FIRST pair.
 * - mode=game-variant: existing AP identity into game's independent D1/R2 DB.
 */
export async function handoffGeneratedArtifact(payload,adapters={}) {
  if(!payload||!["official-initial-pair","official-existing-variant","game-variant"].includes(payload.mode))
    throw Error("Explicit artifact destination mode required");
  if(payload.mode==="official-initial-pair"){
    if(!Buffer.isBuffer(payload.portraitPng)||!Buffer.isBuffer(payload.fullBodyPng))
      throw Error("Trusted host must supply both original PNG Buffers");
    if(!adapters.getReservation||!adapters.submitReservedImages)
      throw Error("Official Nanal connector upload actions unavailable");
    return importChatGptInitialPair({
      appearanceId:payload.appearanceId,
      portraitPng:payload.portraitPng.toString("base64"),
      fullBodyPng:payload.fullBodyPng.toString("base64")
    },{getReservation:adapters.getReservation,submitReservedImages:adapters.submitReservedImages});
  }
  if(payload.mode==="official-existing-variant"){
    if(!Buffer.isBuffer(payload.png)||!/^AP\\d{3,5}$/.test(payload.appearanceId??""))
      throw Error("Official existing-ID variant requires canonical AP ID and real PNG Buffer");
    if(typeof adapters.submitOfficialVariant!=="function")
      throw Error("official_variant_submission_action_not_exposed");
    const result=await adapters.submitOfficialVariant({
      appearanceId:payload.appearanceId,kind:payload.kind,index:payload.index,
      pngBase64:payload.png.toString("base64"),
      referenceAnchorSha256:payload.referenceAnchorSha256,
      requestKey:payload.requestKey
    });
    if(!result||result.error||result.isError||!["awaiting_review","approved"].includes(result.status))
      throw Error("Official variant submission was not acknowledged");
    return {appearanceId:payload.appearanceId,destination:"official_nanal_plugin",
      status:result.status,acknowledgement:result};
  }
  if(!Buffer.isBuffer(payload.png))
    throw Error("Trusted host must supply original image PNG Buffer");
  if(typeof adapters.submitGameVariant==="function")
    return adapters.submitGameVariant({...payload,source:"trusted-host"});
  return submitChatGptBytes({
    pngBytes:payload.png,characterId:payload.appearanceId,
    kind:payload.kind,index:payload.index,profile:payload.profile,
    localOnly:payload.localOnly===true,privateRoot:payload.privateRoot,
    dryRun:payload.dryRun===true,
    referenceFilePath:payload.referenceFilePath,visualQaRequired:payload.visualQaRequired===true
  },adapters.gameConfig,adapters.gameAdapters);
}

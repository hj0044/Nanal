import { createInitialPairSubmission } from "./validation.mjs";

/**
 * Accept ChatGPT-generated PNG bytes and forward to the official Nanal connector.
 * No additional image generation API and no application-level daily job cap.
 *
 * Requires connector adapters in the privileged ChatGPT orchestration context.
 * It does NOT have access to generated image bytes unless the host exposes them.
 * Initial reserved portrait/full-body PAIRS only; existing-ID variants require
 * a separate, not-yet-exposed Nanal variant upload action.
 */
export async function importChatGptInitialPair(
  {appearanceId,portraitPng,fullBodyPng},
  {getReservation,submitReservedImages}
) {
  if(typeof getReservation!=="function"||typeof submitReservedImages!=="function")
    throw Error("Official Nanal reservation and submission adapters are required");
  const pair=createInitialPairSubmission({appearanceId,portraitPng,fullBodyPng});
  const reservation=await getReservation({appearanceId});
  if(reservation?.appearanceId!==appearanceId||!/^reserve:AP\d{3,5}$/.test(reservation?.requestId??""))
    throw Error("Reservation missing or canonical ID mismatch");
  if(["approved","deleted"].includes(reservation.status))
    throw Error("Cannot replace an approved/deleted reservation");
  if(!reservation.prompts?.face||!reservation.prompts?.fullBody||!reservation.brief)
    throw Error("Locked profile and both generation prompts are required");
  const result=await submitReservedImages({
    appearanceId,requestId:reservation.requestId,
    portraitPng:pair.portraitPng,fullBodyPng:pair.fullBodyPng
  });
  if(!result||result.isError===true||result.error) throw Error("Official Nanal submission was not acknowledged");
  return {appearanceId,requestId:reservation.requestId,stage:"submitted_for_review",
    evidence:pair.identityEvidence,acknowledgement:result};
}

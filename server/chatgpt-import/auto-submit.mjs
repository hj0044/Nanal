/**
 * Host-to-Nanal image handoff. Invoke after a ChatGPT image generation result
 * supplies real PNG bytes. No image-generation API call, daily cap, polling,
 * fake network source, or silent approval is performed here.
 *
 * The host must supply the canonical AP ID and real result bytes. ChatGPT
 * Images/Library do not currently expose a general image-result webhook or
 * raw-byte export to the installed Nanal connector.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { inspectPngBase64 } from "./validation.mjs";

const HASH=/^[a-f0-9]{64}$/i;
const AP=/^AP\d{3,5}$/;
const MAX=16*1024*1024;
function requireValidEndpoint(value) {
  const url=new URL(value);
  if (url.protocol!=="https:" || url.username || url.password || url.search || url.hash)
    throw Error("HTTPS Nanal API endpoint required");
  return url.origin;
}
function checkToken(token) {
  if(typeof token!=="string" || token.length<32) throw Error("Nanal owner token required");
}
async function checkPixels(bytes,slot) {
  const spec=slot==="portrait"?{width:1024,height:1024}:{width:1024,height:1536};
  inspectPngBase64(bytes.toString("base64"),spec); // verifies RGBA/PNG CRC and exact canvas.
  const {data,info}=await sharp(bytes,{failOn:"error",limitInputPixels:2_000_000})
    .raw().toBuffer({resolveWithObject:true});
  if(info.width!==spec.width||info.height!==spec.height||info.channels!==4)
    throw Error("Expected decoded RGBA PNG dimensions");
  let transparent=0,opaque=0,opaqueMagenta=0;
  for(let i=0;i<data.length;i+=4) {
    const a=data[i+3];
    if(a<=8)transparent++;
    if(a>=250) {
      opaque++;
      if(data[i]>=244 && data[i+1]<=14 && data[i+2]>=244)opaqueMagenta++;
    }
  }
  const count=info.width*info.height;
  if(transparent/count<0.005) throw Error("Transparent background required; no qualifying alpha pixels");
  if(opaque/count<0.01) throw Error("Missing opaque character foreground");
  if(opaqueMagenta/count>0.003) throw Error("Unremoved magenta key background");
}
function artifactBuffer(artifact) {
  const data=artifact?.pngBytes;
  if (!(data instanceof Uint8Array) || !data.byteLength || data.byteLength>MAX)
    throw Error("ChatGPT image bytes not available from host");
  return Buffer.from(data);
}
function activeCanonical(profile,appearanceId) {
  return profile && profile.appearanceId===appearanceId &&
    profile.source==="reviewed_official_reservation" &&
    HASH.test(profile.profileSha256) && HASH.test(profile.portraitAnchorSha256) &&
    HASH.test(profile.fullBodyAnchorSha256);
}
const sha256 = bytes=>createHash("sha256").update(bytes).digest("hex");

/**
 * Host invocation example:
 *   await autoSubmitGeneratedImage({appearanceId:"AP008",slot:"fullBody",
 *     pngBytes:imageToolResultBytes}, {baseUrl, ownerToken, fetcher})
 * No extra click is necessary when the host can pass bytes. If it cannot,
 * returns an explicit error instead of claiming a successful upload.
 */
export async function autoSubmitGeneratedImage(
 {appearanceId,slot,pngBytes},
 {baseUrl,ownerToken,fetcher=fetch}
) {
 if(!AP.test(appearanceId)||!["portrait","fullBody"].includes(slot))
   throw Error("Explicit locked AP identity and image slot required");
 checkToken(ownerToken);
 const origin=requireValidEndpoint(baseUrl);
 const bytes=artifactBuffer({pngBytes});
 await checkPixels(bytes,slot);
 const auth={Authorization:"Bearer "+ownerToken};
 const response=await fetcher(origin+"/api/appearance/identities/"+appearanceId,{headers:auth});
 if(!response.ok)throw Error("Canonical profile retrieval failed: HTTP "+response.status);
 const profile=await response.json();
 if(!activeCanonical(profile,appearanceId))throw Error("Approved canonical profile is missing or mismatched");
 const hash=sha256(bytes);
 // Exact same pixels for same AP/slot stay idempotent even across resumed sessions.
 const requestKey=appearanceId+":"+slot+":"+hash;
 const form=new FormData();
 form.set("slot",slot);
 form.set("profileSha256",profile.profileSha256);
 form.set("anchorSha256",slot==="portrait"?profile.portraitAnchorSha256:profile.fullBodyAnchorSha256);
 form.set("requestKey",requestKey);
 form.set("image",new Blob([bytes],{type:"image/png"}),appearanceId+"-"+slot+".png");
 const upload=await fetcher(origin+"/api/appearance/identities/"+appearanceId+"/variants",{
   method:"POST",headers:auth,body:form
 });
 if(!upload.ok)throw Error("Nanal image upload not acknowledged: HTTP "+upload.status);
 const result=await upload.json();
 if(!result || typeof result.assetId!=="string" ||
     !["awaiting_review","approved","blocked"].includes(result.status))
   throw Error("Nanal upload response missing asset evidence");
 return Object.freeze({
   appearanceId,slot,assetId:result.assetId,
   sha256:hash,status:result.status,
   duplicate:result.duplicate===true,
   stored:true,approved:result.status==="approved"
 });
}

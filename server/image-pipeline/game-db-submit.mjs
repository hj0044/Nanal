import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { inspectPngBase64 } from "../chatgpt-import/validation.mjs";
import { immutableWrite, driveBackup } from "./import.mjs";

const hex64=/^[0-9a-f]{64}$/i;
const ap=/^AP\d{3,5}$/;
const digest=b=>createHash("sha256").update(b).digest("hex");
const md5=b=>createHash("md5").update(b).digest("hex");
function assertIdentity(profile,characterId) {
  if(!ap.test(characterId)||!profile||profile.reviewedOfficialReservation!==true||
    !["여성","남성"].includes(profile.gender)||!Number.isInteger(profile.ageMin)||
    !Number.isInteger(profile.ageMax)||profile.ageMin<20||profile.ageMax>59||
    profile.ageMin>profile.ageMax||
    ![profile.profileSha256,profile.portraitAnchorSha256,profile.fullBodyAnchorSha256].every(x=>typeof x==="string"&&hex64.test(x)))
    throw Error("Verified official AP profile and three 64-character SHA-256 references required");
}
function apiBase(base) {
  const u=new URL(base);
  if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/")
    throw Error("Game API URL must be a clean HTTPS origin");
  return u.origin;
}
async function checkedJson(res,label){
  if(!res.ok){
    const body=await res.text().catch(()=>"");
    throw Error(label+": HTTP "+res.status+" "+body.slice(0,300));
  }
  return res.json();
}
export async function createResponsiveWebp(sourcePng,kind) {
  const {default:sharp}=await import("sharp");
  const widths=[160,320,640,1024];
  const quality=kind==="portrait"?82:86;
  const result=[];
  for(const width of widths){
    const bytes=await sharp(sourcePng,{failOn:"error"}).resize({width,withoutEnlargement:true})
      .webp({quality,effort:5}).toBuffer();
    result.push({width,bytes});
  }
  return result;
}

/** Actual PNG bytes must already exist. Never claim that ChatGPT ImageGen exports them automatically. */
export async function submitChatGptFile(spec,config={},adapters={}) {
  const {characterId,kind,filePath,profile}=spec;
  assertIdentity(profile,characterId);
  if(!["portrait","fullbody"].includes(kind)||!filePath||path.extname(filePath).toLowerCase()!==".png")
    throw Error("The game DB accepts original PNG portrait/fullbody files only");
  const slot=kind==="fullbody"?"fullBody":"portrait";
  const anchorHash=kind==="fullbody"?profile.fullBodyAnchorSha256:profile.portraitAnchorSha256;
  const bytes=await readFile(filePath);
  inspectPngBase64(bytes.toString("base64"),kind==="fullbody"?{width:1024,height:1536}:{width:1024,height:1024});
  const hash=digest(bytes);
  if(spec.index===1&&hash!==anchorHash)throw Error("First image does not match official verified master anchor");
  if(!Number.isInteger(spec.index)||spec.index<1||spec.index>999)throw Error("Invalid index");
  if(spec.dryRun)return {characterId,slot,fileSha256:hash,status:"dry_run"};
  const endpoint=apiBase(config.gameApiOrigin);
  if(typeof config.adminToken!=="string"||config.adminToken.length<32)throw Error("Game DB admin token missing");
  if(!spec.localOnly&&(!config.googleFolderId||
     !(config.googleAccessToken||(config.googleRefreshToken&&config.googleClientId&&config.googleClientSecret))))
    throw Error("Independent Drive backup is mandatory unless --local-only");
  const sourceName=characterId+"-"+kind+"-"+String(spec.index).padStart(3,"0")+"-"+hash.slice(0,16)+".png";
  await immutableWrite(path.resolve(spec.privateRoot??".nanal-private","originals",characterId,sourceName),bytes);
  const fetchFn=adapters.fetch??globalThis.fetch;
  const driveId=spec.localOnly?null:await driveBackup(fetchFn,config,bytes,sourceName,characterId,md5(bytes));
  const headers={authorization:"Bearer "+config.adminToken};
  const profileUrl=endpoint+"/api/appearance/identities/"+characterId;
  await checkedJson(await fetchFn(profileUrl,{method:"PUT",headers:{...headers,"Content-Type":"application/json"},
    body:JSON.stringify({gender:profile.gender,ageMin:profile.ageMin,ageMax:profile.ageMax,
      profileSha256:profile.profileSha256,portraitAnchorSha256:profile.portraitAnchorSha256,
      fullBodyAnchorSha256:profile.fullBodyAnchorSha256,qaSource:"reviewed_official_reservation"})}),"Game DB identity");
  const form=new FormData();
  form.append("slot",slot);
  form.append("profileSha256",profile.profileSha256);
  form.append("anchorSha256",anchorHash);
  form.append("requestKey",characterId+":"+kind+":"+hash.slice(0,40));
  form.append("image",new Blob([bytes],{type:"image/png"}),sourceName);
  const result=await checkedJson(await fetchFn(profileUrl+"/variants",{method:"POST",headers,body:form}),"Game DB variant");
  if(!result.assetId||!["awaiting_review","approved","blocked"].includes(result.status))
    throw Error("Game DB upload did not acknowledge a real variant");
  if(result.status==="blocked") throw Error("Blocked asset cannot receive optimized images");
  const optimizedWidths=[];
  if(spec.optimize!==false){
    const derivatives=await (adapters.optimize??createResponsiveWebp)(bytes,kind);
    for(const variant of derivatives){
      if(![160,320,640,1024].includes(variant.width)||!Buffer.isBuffer(variant.bytes))
        throw Error("Invalid responsive WebP derivative");
      const response=await checkedJson(await fetchFn(
        endpoint+"/api/appearance/variants/"+result.assetId+"/derivatives/"+variant.width,
        {method:"PUT",headers:{...headers,"Content-Type":"image/webp","x-source-sha256":hash},
          body:variant.bytes}),"Game DB optimized WebP");
      if(!["stored","existing"].includes(response.status))
        throw Error("Responsive WebP was not acknowledged");
      optimizedWidths.push(variant.width);
    }
  }
  return {characterId,slot,assetId:result.assetId,status:result.status,duplicate:result.duplicate===true,
    driveFileId:driveId,fileSha256:hash,optimizedWidths};
}

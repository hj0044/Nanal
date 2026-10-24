import { createHash } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import sharp from "sharp";
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
export async function preflightPng(source,kind) {
  const image=sharp(source,{failOn:"error",limitInputPixels:2_000_000});
  const m=await image.metadata();
  if(m.format!=="png"||m.width!==1024||m.height!==(kind==="portrait"?1024:1536)||!m.hasAlpha)
    throw Error("Expected native RGBA PNG with canonical dimensions");
  const {data,info}=await image.raw().toBuffer({resolveWithObject:true});
  if(info.channels!==4)throw Error("RGBA PNG pixels required");
  let transparent=0,magenta=0,opaque=0;
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]<=8)transparent++;
    if(data[i+3]>=250){
      opaque++;
      if(data[i]>=244&&data[i+1]<=14&&data[i+2]>=244)magenta++;
    }
  }
  const total=info.width*info.height;
  if(transparent/total<0.005)throw Error("Transparent background required");
  if(opaque/total<0.01)throw Error("Opaque character foreground missing");
  if(magenta/total>0.003)throw Error("Unremoved magenta technical background");
  return {width:info.width,height:info.height,hasAlpha:true};
}
export async function createResponsiveWebp(sourcePng,kind) {
  const result=[];
  for(const width of [160,320,640,1024]){
    const bytes=await sharp(sourcePng,{failOn:"error"}).resize({width,withoutEnlargement:true})
      .webp({quality:kind==="portrait"?82:86,effort:5}).toBuffer();
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
  await (adapters.preflight??preflightPng)(bytes,kind);
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
  if(result.status==="blocked")throw Error("Blocked image cannot receive derivatives");
  const optimizedWidths=[];
  if(spec.optimize!==false){
    const derivatives=await (adapters.optimize??createResponsiveWebp)(bytes,kind);
    for(const variant of derivatives){
      if(![160,320,640,1024].includes(variant.width)||!Buffer.isBuffer(variant.bytes))
        throw Error("Invalid optimized WebP variant");
      const response=await checkedJson(await fetchFn(
        endpoint+"/api/appearance/variants/"+result.assetId+"/derivatives/"+variant.width,
        {method:"PUT",headers:{...headers,"Content-Type":"image/webp","x-source-sha256":hash},
          body:variant.bytes}),"Game DB optimized WebP");
      if(!["stored","existing"].includes(response.status))throw Error("WebP derivative upload not acknowledged");
      optimizedWidths.push(variant.width);
    }
  }
  return {characterId,slot,assetId:result.assetId,status:result.status,duplicate:result.duplicate===true,
    driveFileId:driveId,fileSha256:hash,optimizedWidths};
}


/**
 * Model-host byte handoff: accepts actual PNG bytes directly without asking
 * the user to save or select a file. It does not generate images or retrieve
 * protected ChatGPT Images assets from their UI. The host must deliver bytes.
 *
 * This deliberately reuses submitChatGptFile, keeping its immutable local
 * original + independent Google Drive backup + owner-authenticated game DB
 * registration + exactly-once requestKey behavior intact.
 */
export async function submitChatGptBytes(spec, config={}, adapters={}) {
  const raw=spec?.pngBytes;
  if (!(raw instanceof Uint8Array) || raw.byteLength<70 || raw.byteLength>16*1024*1024)
    throw Error("ChatGPT generated image bytes unavailable to the host");
  const {characterId,kind,index}=spec;
  if(!ap.test(characterId)||!["portrait","fullbody"].includes(kind) ||
      !Number.isInteger(index)||index<1||index>999)
    throw Error("Locked AP ID, portrait/fullbody kind and image index required");
  const bytes=Buffer.from(raw);
  inspectPngBase64(bytes.toString("base64"),kind==="portrait"?{width:1024,height:1024}:{width:1024,height:1536});
  await (adapters.preflight??preflightPng)(bytes,kind);
  const temp=await mkdtemp(path.join(os.tmpdir(),"nanal-chatgpt-image-"));
  const filepath=path.join(temp,characterId+"-"+kind+"-"+index+".png");
  try {
    await writeFile(filepath,bytes,{mode:0o600});
    return await submitChatGptFile({...spec,filePath:filepath},config,adapters);
  } finally {
    await rm(temp,{recursive:true,force:true});
  }
}

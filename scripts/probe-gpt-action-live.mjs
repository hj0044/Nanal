#!/usr/bin/env node
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import path from "node:path";

function assertOrigin(input){
  const u=new URL(input);
  if(u.protocol!=="https:"||u.pathname!=="/"||u.search||u.hash||u.username||u.password)
    throw Error("Use a clean, live HTTPS game API origin (ending in /)");
  if(["YOUR-LIVE-NANAL-GAME-DOMAIN","localhost"].includes(u.hostname))
    throw Error("Replace placeholder origin with an actual deployed Worker");
  return u.origin;
}
function fileRef(ref){
  if(!ref||typeof ref!=="object"||typeof ref.id!=="string"||
    typeof ref.download_link!=="string"||!ref.download_link.includes("://"))
    throw Error("A real ChatGPT Action openaiFileIdRefs object is required");
  if(!/^file-[A-Za-z0-9_-]{8,200}$/.test(ref.id))
    throw Error("Invalid GPT Action file ID");
  const u=new URL(ref.download_link);
  if(u.protocol!=="https:"||u.hostname!=="files.oaiusercontent.com"||
    !/^\/file-[A-Za-z0-9_-]+$/.test(u.pathname)||u.username||u.password||u.hash)
    throw Error("Untrusted ChatGPT signed file source");
  if(u.searchParams.has("se")){
    const expires=Date.parse(u.searchParams.get("se"));
    if(!Number.isFinite(expires)||expires<=Date.now())throw Error("Signed ChatGPT file reference expired");
  }
  return ref;
}
function checked(response,label){
  if(!response.ok)throw Error(label+" HTTP "+response.status);
  return response;
}
export async function probeActionLive({origin,token,appearanceId,slot,fileReference,commit=false},fetchFn=globalThis.fetch){
  const host=assertOrigin(origin);
  if(typeof token!=="string"||token.length<32)throw Error("Secure server bearer token required");
  const headers={authorization:"Bearer "+token};
  const statusResponse=checked(await fetchFn(host+"/api/appearance/admin/status",{
    method:"GET",headers,redirect:"error"}),"Owner-authenticated backend readiness");
  const status=await statusResponse.json();
  if(status.ready!==true)throw Error("Backend not ready for GPT Action");
  if(!commit)return {mode:"readiness_only",backendReady:true,liveFileTransferTested:false,
    reason:"Real ChatGPT Images file reference and explicit --submit required"};
  if(!/^AP[0-9]{3,5}$/.test(appearanceId??"")||
    !["portrait","fullBody"].includes(slot))
    throw Error("Verified AP ID and portrait/fullBody slot required");
  const ref=fileRef(fileReference);
  // Never log or return the temporary file URL or owner secret.
  const response=await fetchFn(host+"/api/appearance/actions/ingest",{
    method:"POST",headers:{...headers,"Content-Type":"application/json"},
    body:JSON.stringify({appearanceId,slot,openaiFileIdRefs:[ref]}),redirect:"error"
  });
  if(!response.ok)throw Error("Live ChatGPT Action candidate ingest HTTP "+response.status);
  const result=await response.json();
  if(!result.assetId||result.appearanceId!==appearanceId||
    !["awaiting_review","approved","blocked"].includes(result.status))
    throw Error("Live ingest not acknowledged by deployed backend");
  return {mode:"real_signed_file_submission",backendReady:true,liveFileTransferTested:true,
    appearanceId,assetId:result.assetId,status:result.status,
    duplicate:result.duplicate===true,source:"game_side_D1_R2_not_official_plugin"};
}
export async function probeFromCli(argv,env=process.env){
  const flags=new Map();
  for(let i=0;i<argv.length;i++){
    const option=argv[i];
    if(option==="--submit"){flags.set(option,true);continue;}
    if(!option.startsWith("--")||!argv[i+1]||argv[i+1].startsWith("--"))
      throw Error("Expected --name value");
    flags.set(option,argv[++i]);
  }
  const origin=flags.get("--origin")??env.NANAL_GAME_API_ORIGIN;
  const token=env.NANAL_APPEARANCE_ADMIN_TOKEN;
  const reference=flags.has("--file-ref-json")?
    JSON.parse(await readFile(flags.get("--file-ref-json"),"utf8")):null;
  const fileReference=Array.isArray(reference?.openaiFileIdRefs)?
    reference.openaiFileIdRefs[0]:reference;
  return probeActionLive({origin,token,
    appearanceId:flags.get("--appearance"),slot:flags.get("--slot"),
    fileReference,commit:flags.has("--submit")});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(await probeFromCli(process.argv.slice(2)),null,2));}
  catch(e){console.error("GPT Action live check failed:",e instanceof Error?e.message:String(e));process.exitCode=1;}
}

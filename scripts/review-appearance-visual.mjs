#!/usr/bin/env node
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";
import {compareAppearancePngs} from "../server/image-pipeline/visual-consistency.mjs";

const sha256=b=>createHash("sha256").update(b).digest("hex");
function parseArgs(argv){
  const flags=new Map();
  for(let i=0;i<argv.length;i++){
    const name=argv[i];
    if(!name.startsWith("--")||!argv[i+1]||argv[i+1].startsWith("--"))
      throw Error("Expected --key value: "+name);
    flags.set(name,argv[++i]);
  }
  return flags;
}
async function candidateBytes(flags,fetchFn=globalThis.fetch){
  if(flags.has("--candidate"))return readFile(flags.get("--candidate"));
  const id=flags.get("--asset-id"),endpoint=flags.get("--game-origin");
  if(!/^[a-f0-9-]{36}$/.test(id??""))throw Error("Provide --candidate or valid --asset-id");
  const origin=new URL(endpoint);
  if(origin.protocol!=="https:"||origin.pathname!=="/"||origin.search||origin.hash||origin.username)
    throw Error("Clean game HTTPS origin required");
  const token=process.env.NANAL_APPEARANCE_ADMIN_TOKEN;
  if(!token||token.length<32)throw Error("Private game admin token missing");
  const response=await fetchFn(origin.origin+"/api/appearance/admin/assets/"+id,{
    headers:{authorization:"Bearer "+token},redirect:"error",signal:AbortSignal.timeout(30000)
  });
  if(!response.ok)throw Error("Private asset fetch HTTP "+response.status);
  const length=Number(response.headers.get("content-length")||0);
  if(length>16*1024*1024)throw Error("Candidate source too large");
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>16*1024*1024)throw Error("Candidate source too large");
  return bytes;
}
export async function runVisualQa(flags,{fetchFn=globalThis.fetch}={}){
  const appearanceId=flags.get("--appearance"),role=flags.get("--role");
  const lockedProfile={heightCm:Number(flags.get("--height-cm")),weightKg:Number(flags.get("--weight-kg"))};
  const trustedAnchor=flags.get("--anchor-sha256");
  if(!/^[a-f0-9]{64}$/i.test(trustedAnchor??""))throw Error("Official master SHA-256 required");
  const referencePng=await readFile(flags.get("--reference"));
  if(sha256(referencePng)!==trustedAnchor.toLowerCase())
    throw Error("Reference bytes do not match official locked anchor");
  const candidatePng=await candidateBytes(flags,fetchFn);
  const report=await compareAppearancePngs({referencePng,candidatePng,role,appearanceId,lockedProfile});
  const file=path.resolve(flags.get("--report")??".nanal-private/qa/"+appearanceId+"-"+role+"-"+report.candidateSha256.slice(0,20)+".json");
  await mkdir(path.dirname(file),{recursive:true});
  await writeFile(file,JSON.stringify(report,null,2)+"\n",{flag:"wx",mode:0o600});
  return {reportPath:file,report};
}
if(process.argv[1] && import.meta.url===new URL("file://"+path.resolve(process.argv[1])).href) {
  try {
    const {reportPath,report}=await runVisualQa(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({reportPath,appearanceId:report.appearanceId,
      recommendedAction:report.recommendedAction,flags:report.flags,approved:false},null,2));
  }catch(e){console.error("Visual QA failed:",e instanceof Error?e.message:String(e));process.exitCode=1;}
}

import { readdir, readFile, lstat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { importCharacterImage } from "./import.mjs";
import { submitChatGptFile } from "./game-db-submit.mjs";

const filenamePattern=/^(AP\d{3,5})-(portrait|fullbody)-(\d{3})\.(png|jpg|jpeg|webp)$/i;
const hex64=/^[a-f0-9]{64}$/i;
export async function discoverCharacterImages(root) {
  const absolute=path.resolve(root),entries=[], ignored=[];
  async function scan(dir){
    for(const child of await readdir(dir,{withFileTypes:true})){
      const loc=path.join(dir,child.name);
      if(child.isSymbolicLink()) {ignored.push({path:loc,reason:"symlink"});continue;}
      if(child.isDirectory()) {await scan(loc);continue;}
      if(!child.isFile()) {ignored.push({path:loc,reason:"not_file"});continue;}
      if(!/\.(png|jpe?g|webp)$/i.test(child.name))continue;
      const match=filenamePattern.exec(child.name);
      if(!match) {ignored.push({path:loc,reason:"name_format"});continue;}
      entries.push({filePath:loc,characterId:match[1].toUpperCase(),kind:match[2].toLowerCase(),
        index:Number(match[3])});
    }
  }
  await scan(absolute);
  const sort=(a,b)=>a.characterId.localeCompare(b.characterId,undefined,{numeric:true})||
    a.index-b.index||a.kind.localeCompare(b.kind)||a.filePath.localeCompare(b.filePath);
  entries.sort(sort);
  return {entries,ignored};
}
function requireProfile(characterId,registry) {
  const p=registry?.characters?.[characterId];
  if(!p||p.reviewedOfficialReservation!==true||!["남성","여성"].includes(p.gender)||
      !Number.isInteger(p.ageMin)||!Number.isInteger(p.ageMax)||
      p.ageMin<20||p.ageMax>59||p.ageMin>p.ageMax||
      !["portraitAnchorSha256","fullBodyAnchorSha256"].every(k=>hex64.test(p[k]??"")))
    throw Error("Missing verified canonical registry for "+characterId);
  return p;
}
/** File-only source inventory; never guess unknown character metadata from portraits. */
export async function bulkImportCharacters({root,registry,destination="imagekit",dryRun=true,
  localOnly=false,privateRoot,catalogPath},config={},adapters={}) {
  if(!["imagekit","game-db"].includes(destination))throw Error("Invalid destination");
  const {entries,ignored}=await discoverCharacterImages(root);
  const report={mode:dryRun?"dry_run":"execute",destination,found:entries.length,ignored,
    results:[],completed:0,failed:0};
  const seen=new Set();
  for(const item of entries){
    const key=[item.characterId,item.kind,item.index].join(":");
    try{
      if(seen.has(key))throw Error("Duplicate character / slot / index, refusing ambiguous file");
      seen.add(key);
      const p=requireProfile(item.characterId,registry);
      const sha=p[item.kind==="fullbody"?"fullBodyAnchorSha256":"portraitAnchorSha256"];
      // The canonical first image must match the locked master exactly.
      if(item.index===1){
        const bytes=await readFile(item.filePath);
        if(createHash("sha256").update(bytes).digest("hex")!==sha)
          throw Error("Master image SHA-256 differs from verified anchor");
      }
      if(destination==="game-db" && !hex64.test(p.profileSha256??""))
        throw Error("Game DB requires official profileSha256");
      const spec={...item,gender:p.gender,ageMin:p.ageMin,ageMax:p.ageMax,
        anchorSha256:item.index>1?sha:undefined,profile:p,dryRun,localOnly,
        ...(privateRoot?{privateRoot}:{}),...(catalogPath?{catalogPath}:{})};
      const output=destination==="game-db"?
        await (adapters.gameImporter??submitChatGptFile)(spec,config,adapters):
        await (adapters.imagekitImporter??importCharacterImage)(spec,config,adapters);
      report.results.push({file:path.relative(root,item.filePath),id:item.characterId,
        kind:item.kind,index:item.index,status:output.status,
        ...(output.assetId?{assetId:output.assetId}:{}),
        ...(output.originalBytes?{originalBytes:output.originalBytes}:{}),
        ...(output.optimizedBytes?{optimizedBytes:output.optimizedBytes}:{})});
      report.completed++;
    }catch(error){
      report.results.push({file:path.relative(root,item.filePath),id:item.characterId,
        kind:item.kind,index:item.index,status:"error",error:error instanceof Error?error.message:String(error)});
      report.failed++;
    }
  }
  return report;
}

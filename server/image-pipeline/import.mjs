import {createHash} from "node:crypto";
import {readFile,mkdir,open,writeFile,rename,rm} from "node:fs/promises";
import path from "node:path";

const sha256 = b => createHash("sha256").update(b).digest("hex");
const md5 = b => createHash("md5").update(b).digest("hex");
const types = {".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp"};
const driveApi = "https://www.googleapis.com/drive/v3/files";
const uploadDriveApi = "https://www.googleapis.com/upload/drive/v3/files";
const imagekitApi = "https://upload.imagekit.io/api/v1/files/upload";

export function validateImport(s) {
  if (!/^AP\d{3,5}$/.test(s.characterId ?? "")) throw Error("Invalid AP character ID");
  if (!["portrait","fullbody"].includes(s.kind)) throw Error("Invalid role");
  if (!Number.isInteger(s.index)||s.index<1||s.index>999) throw Error("Image index must be 1–999");
  if (!["여성","남성"].includes(s.gender)) throw Error("Verified gender is required");
  if (![s.ageMin,s.ageMax].every(Number.isInteger)||s.ageMin<18||s.ageMax>120||s.ageMin>s.ageMax) throw Error("Verified adult age range is required");
  if (s.index>1&&!/^[a-f0-9]{64}$/i.test(s.anchorSha256??"")) throw Error("Supplemental images require master anchor SHA-256");
  if (!s.filePath||!types[path.extname(s.filePath).toLowerCase()]) throw Error("PNG, JPG or WebP source required");
  return s.characterId+"-"+s.kind+"-"+String(s.index).padStart(3,"0");
}
export function isTrustedImagekitUrl(candidate,endpoint) {
  try {
    const u=new URL(candidate), e=new URL(endpoint), prefix=e.pathname.replace(/\/+$/,"");
    return u.protocol==="https:"&&e.protocol==="https:"&&u.origin===e.origin&&!u.username&&!u.password&&
      (u.pathname===prefix||u.pathname.startsWith(prefix+"/"));
  } catch {return false;}
}
export async function convertForGame(input,kind) {
  const {default:sharp}=await import("sharp");
  const img=sharp(input,{failOn:"error",limitInputPixels:50_000_000});
  const info=await img.metadata();
  if (!["png","jpeg","webp"].includes(info.format)||!info.width||!info.height) throw Error("Invalid image");
  const bytes=await img.rotate().resize({width:kind==="fullbody"?1600:1024,withoutEnlargement:true})
    .webp({quality:kind==="fullbody"?87:85,effort:5}).toBuffer();
  return {bytes,width:info.width,height:info.height};
}
const check=(r,label)=>{if(!r.ok)throw Error(label+": HTTP "+r.status);return r;};
async function getToken(c,fetchFn) {
  if(c.googleRefreshToken&&c.googleClientId&&c.googleClientSecret){
    const r=check(await fetchFn("https://oauth2.googleapis.com/token",{method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({grant_type:"refresh_token",refresh_token:c.googleRefreshToken,
      client_id:c.googleClientId,client_secret:c.googleClientSecret})}),"Drive OAuth");
    const data=await r.json();
    if(!data.access_token)throw Error("Drive OAuth token unavailable");
    return data.access_token;
  }
  if(c.googleAccessToken)return c.googleAccessToken;
  throw Error("Drive OAuth credentials missing");
}
const esc = x => x.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
async function driveFind(fetchFn,token,q) {
  const url=new URL(driveApi);
  url.searchParams.set("q",q);
  url.searchParams.set("fields","nextPageToken,files(id,name,md5Checksum,size)");
  const r=check(await fetchFn(url,{headers:{Authorization:"Bearer "+token}}),"Drive list");
  const data=await r.json();
  return data.files??[];
}
export async function driveBackup(fetchFn,c,original,filename,characterId,digest) {
  if(!c.googleFolderId)throw Error("Drive backup root folder required");
  const token=await getToken(c,fetchFn);
  const folderMatches=await driveFind(fetchFn,token,
    "name = '"+esc(characterId)+"' and '"+esc(c.googleFolderId)+"' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  if(folderMatches.length>1)throw Error("Duplicate character backup folders");
  let folderId=folderMatches[0]?.id;
  if(!folderId){
    const r=check(await fetchFn(driveApi+"?fields=id",{method:"POST",
      headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify({name:characterId,parents:[c.googleFolderId],mimeType:"application/vnd.google-apps.folder"})}),"Drive folder");
    folderId=(await r.json()).id;
    if(!folderId)throw Error("Drive folder creation failed");
  }
  const matches=await driveFind(fetchFn,token,
    "name = '"+esc(filename)+"' and '"+esc(folderId)+"' in parents and trashed = false");
  if(matches.length){
    if(matches.length!==1||matches[0].md5Checksum!==digest)throw Error("Remote backup checksum conflict");
    return matches[0].id;
  }
  const mime=types[path.extname(filename)]??"application/octet-stream";
  const init=check(await fetchFn(uploadDriveApi+"?uploadType=resumable&fields=id,name,size,md5Checksum",
    {method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json; charset=UTF-8",
      "X-Upload-Content-Type":mime,"X-Upload-Content-Length":String(original.length)},
     body:JSON.stringify({name:filename,parents:[folderId]})}),"Drive upload init");
  const location=init.headers.get("location");
  if(!location||new URL(location).origin!=="https://www.googleapis.com")throw Error("Unexpected Google Drive upload location");
  const result=check(await fetchFn(location,{method:"PUT",headers:{"Content-Type":mime,
    "Content-Length":String(original.length)},body:original}),"Drive upload");
  const uploaded=await result.json();
  if(!uploaded.id||uploaded.md5Checksum!==digest||Number(uploaded.size)!==original.length)
    throw Error("Drive upload integrity check failed");
  return uploaded.id;
}
async function imagekitUpload(fetchFn,c,optimized,assetId,characterId) {
  if(!c.imagekitPrivateKey||!c.imagekitEndpoint)throw Error("ImageKit configuration missing");
  const form=new FormData();
  form.append("file",new Blob([optimized],{type:"image/webp"}),assetId+".webp");
  form.append("fileName",assetId+".webp");
  form.append("folder","/nanal/"+characterId);
  form.append("useUniqueFileName","false");
  form.append("overwriteFile","false");
  const auth=Buffer.from(c.imagekitPrivateKey+":").toString("base64");
  const r=check(await fetchFn(imagekitApi,{method:"POST",headers:{Authorization:"Basic "+auth},body:form}),"ImageKit");
  const result=await r.json();
  if(!result.fileId||!isTrustedImagekitUrl(result.url,c.imagekitEndpoint))
    throw Error("Untrusted ImageKit response");
  return result;
}
export async function immutableWrite(file,bytes) {
  await mkdir(path.dirname(file),{recursive:true});
  try{
    const f=await open(file,"wx",0o600);
    try{await f.writeFile(bytes);}finally{await f.close();}
  }catch(e){
    if(e.code!=="EEXIST")throw e;
    const previous=await readFile(file);
    if(!previous.equals(bytes))throw Error("Immutable backup conflict");
  }
}

export async function importCharacterImage(spec,c={},adapters={}) {
  const assetId=validateImport(spec);
  const fetchFn=adapters.fetch??globalThis.fetch;
  const converter=adapters.convert??convertForGame;
  if(!spec.dryRun&&!spec.localOnly&&!c.googleFolderId)throw Error("Remote backup mandatory unless --local-only");
  if(!spec.dryRun&&!spec.localOnly&&!(c.googleAccessToken||(c.googleRefreshToken&&c.googleClientId&&c.googleClientSecret)))
    throw Error("Google Drive OAuth credentials missing");
  if(!spec.dryRun&&(!c.imagekitPrivateKey||!c.imagekitEndpoint))throw Error("ImageKit config missing");
  const original=await readFile(spec.filePath), hash=sha256(original);
  const {bytes:optimized,width,height}=await converter(original,spec.kind);
  if(!Buffer.isBuffer(optimized)||!optimized.length||!Number.isInteger(width)||!Number.isInteger(height))
    throw Error("Invalid converted image");
  const extension=path.extname(spec.filePath).toLowerCase();
  const backupName=assetId+"-"+hash.slice(0,16)+extension;
  if(spec.dryRun)return {assetId,sourceSha256:hash,originalBytes:original.length,
    optimizedBytes:optimized.length,width,height,status:"dry_run"};
  const privateRoot=path.resolve(spec.privateRoot??".nanal-private");
  await immutableWrite(path.join(privateRoot,"originals",spec.characterId,backupName),original);
  await immutableWrite(path.join(privateRoot,"optimized",spec.characterId,
    assetId+"-"+hash.slice(0,16)+".webp"),optimized);
  const driveFileId=spec.localOnly?null:
    await driveBackup(fetchFn,c,original,backupName,spec.characterId,md5(original));
  const catalogPath=path.resolve(spec.catalogPath??"src/assets/character-portraits/catalog.json");
  const lockPath=catalogPath+".lock",lock=await open(lockPath,"wx",0o600);
  try{
    const catalog=JSON.parse(await readFile(catalogPath,"utf8"));
    if(!Array.isArray(catalog.assets))throw Error("Invalid catalog");
    const existing=catalog.assets.find(x=>x.assetId===assetId);
    if(existing){
      if(existing.sourceSha256!==hash)throw Error("Asset ID already used for different source; change --index");
      return {assetId,status:"already_registered",cdnUrl:existing.cdnUrl,driveFileId};
    }
    const uploaded=await imagekitUpload(fetchFn,c,optimized,assetId,spec.characterId);
    catalog.assets.push({assetId,characterId:spec.characterId,role:spec.kind,
      gender:spec.gender,ageEstimate:{min:spec.ageMin,max:spec.ageMax},
      filename:spec.characterId+"/"+assetId+".webp",cdnUrl:uploaded.url,sourceSha256:hash,
      ...(spec.anchorSha256?{anchorSha256:spec.anchorSha256}:{}),
      status:"awaiting_review",runtimeEligible:false});
    const temp=catalogPath+"."+process.pid+".tmp";
    try{
      await writeFile(temp,JSON.stringify(catalog,null,2)+"\n",{mode:0o600});
      await rename(temp,catalogPath);
    }finally{await rm(temp,{force:true});}
    return {assetId,status:"awaiting_review",cdnUrl:uploaded.url,driveFileId,
      sourceSha256:hash,optimizedBytes:optimized.length,imagekitFileId:uploaded.fileId};
  }finally{await lock.close();await rm(lockPath,{force:true});}
}

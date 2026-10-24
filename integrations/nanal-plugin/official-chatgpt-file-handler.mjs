import sharp from "sharp";
import {submitExistingOfficialVariant} from "./official-variant-server.mjs";

const FILE_LIMIT=16*1024*1024;
function verifiedFileRef(ref){
  const id=ref?.file_id??ref?.id;
  const raw=ref?.download_url??ref?.download_link;
  if(typeof id!=="string"||!/^file[-_][A-Za-z0-9_-]{8,200}$/.test(id)||
      typeof raw!=="string")throw Error("generated_file_reference_unavailable");
  const url=new URL(raw);
  if(url.protocol!=="https:"||url.hostname!=="files.oaiusercontent.com"||
    url.username||url.password||url.port||url.hash||
    !/^\/file[-_][A-Za-z0-9_-]+$/.test(url.pathname))
    throw Error("file_reference_source_untrusted");
  const expiry=url.searchParams.get("se");
  if(expiry && (!Number.isFinite(Date.parse(expiry))||Date.parse(expiry)<=Date.now()))
    throw Error("generated_file_reference_expired");
  return url.href;
}
async function downloadTemporaryFile(url,fetchFn){
  let r;
  try{
    r=await fetchFn(url,{method:"GET",redirect:"error",credentials:"omit",
      signal:AbortSignal.timeout(20000)});
  }catch{throw Error("generated_file_download_failed")}
  if(!r.ok||!r.body)throw Error("generated_file_download_failed");
  if(Number(r.headers.get("content-length")||0)>FILE_LIMIT)
    throw Error("generated_image_too_large");
  const chunks=[];let length=0;
  const reader=r.body.getReader();
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    length+=value.byteLength;
    if(length>FILE_LIMIT){await reader.cancel();throw Error("generated_image_too_large");}
    chunks.push(Buffer.from(value));
  }
  if(length<70)throw Error("generated_image_missing");
  return Buffer.concat(chunks,length);
}
export async function normalizeGeneratedImage(bytes,kind){
  const role=kind==="fullbody"?"fullbody":"portrait";
  if(!["portrait","fullbody"].includes(role))throw Error("invalid_image_role");
  const s=sharp(bytes,{failOn:"error",limitInputPixels:12_000_000});
  const metadata=await s.metadata();
  if(!["png","webp"].includes(metadata.format)||!metadata.hasAlpha)
    throw Error("generated_image_requires_real_alpha");
  const {data,info}=await s.clone().resize({width:128,withoutEnlargement:true})
    .ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let clear=0,solid=0;
  for(let p=3;p<data.length;p+=info.channels) {
    if(data[p]<=8)clear++;
    if(data[p]>=250)solid++;
  }
  const coverage=clear/(info.width*info.height);
  if(coverage<0.005||solid/(info.width*info.height)<0.01)
    throw Error("generated_image_not_transparent_cutout");
  const h=role==="fullbody"?1536:1024;
  const png=await s.clone().rotate().resize(1024,h,{fit:"contain",withoutEnlargement:false,
    background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().png().toBuffer();
  return {png,sourceFormat:metadata.format,sourceWidth:metadata.width,
    sourceHeight:metadata.height,normalizedWidth:1024,normalizedHeight:h};
}
/**
 * Tool handler for the real official Nanal MCP server when installed by its
 * owner. DO NOT expose this on unauthenticated public HTTP endpoints.
 *
 * The host supplies a real ChatGPT file object; the official backend must own
 * the locked canonical reference and atomic pending image writer.
 */
export async function submitOfficialVariantFromChatGptFile(input,backend,{
  fetchFn=globalThis.fetch,strictVisualQa=true}={}){
  if(!["portrait","fullbody"].includes(input.kind))throw Error("invalid_image_role");
  const url=verifiedFileRef(input.file);
  // Requiring canonical reference before accessing a remote signed URL avoids
  // downloading arbitrary content for an unknown character.
  if(strictVisualQa&&typeof backend?.getApprovedReferencePng!=="function")
    throw Error("official_canonical_reference_access_missing");
  const source=await downloadTemporaryFile(url,fetchFn);
  const image=await normalizeGeneratedImage(source,input.kind);
  const referencePng=strictVisualQa?
    await backend.getApprovedReferencePng(input.appearanceId,input.kind):undefined;
  if(strictVisualQa && !(referencePng instanceof Uint8Array))
    throw Error("official_canonical_reference_png_missing");
  const result=await submitExistingOfficialVariant({
    appearanceId:input.appearanceId,kind:input.kind,index:input.index,
    pngBytes:image.png,referencePng,
    referenceAnchorSha256:input.referenceAnchorSha256
  },backend);
  return {...result,convertedFrom:image.sourceFormat,
    normalizedDimensions:image.normalizedWidth+"x"+image.normalizedHeight};
}

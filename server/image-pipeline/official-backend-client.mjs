import { createHash } from "node:crypto";

const sha256 = b => createHash("sha256").update(b).digest("hex");
const AP = /^AP\d{3,5}$/;
const HASH = /^[a-f0-9]{64}$/i;
const MAX_IMAGE_BYTES=16*1024*1024;
const officialPath = "/v1/appearance";
const assertId=id=>{
  if(typeof id!=="string"||!AP.test(id))throw Error("official_appearance_id_invalid");
  return id;
};
function originOf(raw) {
  let url;
  try {url=new URL(raw);} catch {throw Error("official_https_origin_required");}
  if(url.protocol!=="https:"||url.pathname!=="/"||url.search||url.hash||
      url.username||url.password||url.port)throw Error("official_https_origin_required");
  return url.origin;
}
function assertSourcePath(source,expected) {
  if(typeof source!=="string"||source!==expected)throw Error("official_raw_asset_path_mismatch");
}
const toJson=async (res,label)=>{
  if(!res.ok)throw Error(label+"_http_"+res.status);
  const mime=res.headers.get("content-type")||"";
  if(!mime.toLowerCase().includes("application/json"))throw Error(label+"_invalid_content_type");
  const body=await res.text();
  if(body.length>200000)throw Error(label+"_response_too_large");
  try{return JSON.parse(body);}catch{throw Error(label+"_invalid_json");}
};

/**
 * An explicit upstream service contract, NOT an existing Nanal plugin
 * endpoint. Must be implemented/deployed by the ACTUAL official Nanal backend.
 * This is an outbound adapter: it cannot conjure credentials or read protected
 * chat images. Game D1/R2 is NOT the official plugin DB.
 */
export function createOfficialNanalBackendClient({
  officialApiOrigin,officialServiceToken,fetchFn=fetch
}={}) {
  const origin=originOf(officialApiOrigin);
  if(typeof officialServiceToken!=="string"||officialServiceToken.length<32)
    throw Error("official_service_credential_missing");
  const headers={Authorization:"Bearer "+officialServiceToken};
  const get=async (path,label)=>toJson(await fetchFn(origin+path,{
    method:"GET",headers,redirect:"error",credentials:"omit"
  }),label);
  const rawAsset=async (asset)=>{
    if(!asset||!HASH.test(asset.sha256??"")||
       typeof asset.assetId!=="string"||!/^[a-zA-Z0-9_-]{8,120}$/.test(asset.assetId))
      throw Error("official_asset_metadata_invalid");
    const path=officialPath+"/approved-assets/"+encodeURIComponent(asset.assetId)+"/original";
    assertSourcePath(asset.downloadPath,path);
    const res=await fetchFn(origin+path,{method:"GET",headers,redirect:"error",credentials:"omit"});
    if(!res.ok)throw Error("official_original_download_http_"+res.status);
    if((res.headers.get("content-type")??"").toLowerCase().split(";")[0]!=="image/png")
      throw Error("official_original_media_type_invalid");
    if(Number(res.headers.get("content-length")||0)>MAX_IMAGE_BYTES)
      throw Error("official_original_too_large");
    if(!res.body)throw Error("official_original_empty");
    const reader=res.body.getReader();let size=0;const chunks=[];
    try{
      while(true){
        const {value,done}=await reader.read();if(done)break;
        size+=value.byteLength;
        if(size>MAX_IMAGE_BYTES){await reader.cancel();throw Error("official_original_too_large");}
        chunks.push(value);
      }
    }catch(e){throw e}
    if(size<70)throw Error("official_original_empty");
    const png=Buffer.alloc(size);let p=0;
    for(const c of chunks){png.set(c,p);p+=c.byteLength;}
    if(sha256(png)!==asset.sha256.toLowerCase())
      throw Error("official_original_sha256_mismatch");
    return png;
  };
  return {
    async listOfficialAppearanceIds() {
      const result=await get(officialPath+"/identities","official_roster");
      if(!Array.isArray(result.appearanceIds)||result.appearanceIds.length>100000||
         result.appearanceIds.some(id=>!AP.test(id)))
        throw Error("official_roster_invalid");
      return result.appearanceIds;
    },
    async getOfficialReservation({appearanceId}) {
      const id=assertId(appearanceId);
      const result=await get(officialPath+"/identities/"+id+"/reservation","official_reservation");
      if(result.appearanceId!==id)throw Error("official_reservation_id_mismatch");
      return result;
    },
    async getCanonicalAssets({appearanceId}) {
      const id=assertId(appearanceId);
      const pack=await get(officialPath+"/identities/"+id+"/canonical","official_canonical");
      if(pack.appearanceId!==id||!pack.portrait||!pack.fullBody)
        throw Error("official_canonical_id_mismatch");
      const [portraitPng,fullBodyPng]=await Promise.all([
        rawAsset(pack.portrait),rawAsset(pack.fullBody)
      ]);
      return {
        ...pack,
        portrait:{...pack.portrait,png:portraitPng},
        fullBody:{...pack.fullBody,png:fullBodyPng}
      };
    },
    async submitOfficialVariant({
      appearanceId,kind,index,png,referenceAnchorSha256,requestKey
    }) {
      const id=assertId(appearanceId);
      if(!["portrait","fullbody"].includes(kind)||!Number.isInteger(index)||index<2||
         index>9999||!Buffer.isBuffer(png)||png.length<70||png.length>MAX_IMAGE_BYTES||
         !HASH.test(referenceAnchorSha256??"")||
         !/^[A-Za-z0-9:_-]{12,160}$/.test(requestKey??""))
        throw Error("official_variant_submission_invalid");
      const form=new FormData();
      form.set("role",kind);form.set("index",String(index));
      form.set("requestKey",requestKey);
      form.set("anchorSha256",referenceAnchorSha256.toLowerCase());
      form.set("originalSha256",sha256(png));
      form.set("file",new Blob([png],{type:"image/png"}),id+"-"+kind+"-"+index+".png");
      const response=await fetchFn(origin+officialPath+"/identities/"+id+"/variants",{
        method:"POST",headers,body:form,redirect:"error",credentials:"omit"
      });
      const result=await toJson(response,"official_variant");
      if(result.appearanceId!==id||!result.assetId||
         !["awaiting_review","approved"].includes(result.status)||
         result.originalSha256!==sha256(png))
        throw Error("official_variant_acknowledgement_invalid");
      return result;
    }
  };
}


/** Safe adapter for the existing host-handoff bridge; never invent PNG bytes. */
export function createOfficialHostAdapters(client) {
  if(!client || typeof client.getOfficialReservation!=="function" ||
     typeof client.getCanonicalAssets!=="function" ||
     typeof client.submitOfficialVariant!=="function")
    throw Error("official_host_adapter_client_invalid");
  return {
    getReservation:({appearanceId})=>client.getOfficialReservation({appearanceId}),
    getCanonicalAssets:({appearanceId})=>client.getCanonicalAssets({appearanceId}),
    submitOfficialVariant:({appearanceId,kind,index,pngBase64,referenceAnchorSha256,requestKey})=>{
      if(typeof pngBase64!=="string"||!/^[a-zA-Z0-9+/]*={0,2}$/.test(pngBase64)||
         pngBase64.length%4!==0)
        throw Error("trusted_original_png_required");
      return client.submitOfficialVariant({
        appearanceId,kind,index,png:Buffer.from(pngBase64,"base64"),
        referenceAnchorSha256,requestKey
      });
    }
  };
}

import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {createHash} from "node:crypto";
import {normalizeGeneratedImage,submitOfficialVariantFromChatGptFile} from "./official-chatgpt-file-handler.mjs";
const sum=b=>createHash("sha256").update(b).digest("hex");
async function image(color={r:30,g:150,b:130}){
  const raw=Buffer.alloc(1024*1024*4);
  for(let y=200;y<920;y++)for(let x=270;x<760;x++){
    const i=(y*1024+x)*4;raw[i]=color.r;raw[i+1]=color.g;raw[i+2]=color.b;raw[i+3]=255;
  }
  return sharp(raw,{raw:{width:1024,height:1024,channels:4}}).png().toBuffer();
}
const file={
  file_id:"file-ABCDEFGHIJK",
  download_url:"https://files.oaiusercontent.com/file-ABCDEFGHIJK?se=2099-12-31T23%3A59%3A59Z&sig=abc",
  mime_type:"image/webp"
};
test("transparent WebP is converted into valid RGBA PNG without inventing an opaque backdrop",async()=>{
 const webp=await sharp(await image()).webp({quality:85}).toBuffer();
 const r=await normalizeGeneratedImage(webp,"portrait");
 assert.equal(r.sourceFormat,"webp");assert.equal(r.normalizedWidth,1024);
 const meta=await sharp(r.png).metadata();
 assert.equal(meta.format,"png");assert.equal(meta.hasAlpha,true);
});
test("official file-param workflow reaches only approved canonical back-end pending queue",async()=>{
 const reference=await image();
 const source=await sharp(await image({r:100,g:60,b:140})).webp().toBuffer();
 const rows=new Map();
 const canon={appearanceId:"AP008",status:"approved",reviewedOfficialReservation:true,
   profileSha256:"a".repeat(64),portraitAnchorSha256:sum(reference),
   fullBodyAnchorSha256:"b".repeat(64),heightCm:165,weightKg:52};
 let requests=0;
 const backend={
   getApprovedReferencePng:async()=>reference,
   getApprovedCanonical:async()=>canon,
   findVariantByRequestKey:async k=>rows.get(k)??null,
   createPendingVariantAtomic:async ({metadata,originalPng,visualQa})=>{
     assert.equal(metadata.status,"awaiting_review");
     assert.equal(visualQa.approved,false);
     rows.set(metadata.requestKey,{assetId:"official-1",status:"awaiting_review",
       appearanceId:"AP008",kind:"portrait",fileSha256:metadata.fileSha256});
     return {assetId:"official-1",status:"awaiting_review"};
   }
 };
 const fetchFn=async (url,options)=>{
   requests++;
   assert.equal(url,file.download_url);
   assert.equal(options.redirect,"error");
   return new Response(source,{status:200,headers:{"content-type":"image/webp"}});
 };
 const payload={file,appearanceId:"AP008",kind:"portrait",index:2,
   referenceAnchorSha256:sum(reference)};
 const r=await submitOfficialVariantFromChatGptFile(payload,backend,{fetchFn});
 assert.equal(r.source,"official_nanal_plugin");
 assert.equal(r.convertedFrom,"webp");
 assert.equal(r.status,"awaiting_review");
 assert.equal(requests,1);
 const replay=await submitOfficialVariantFromChatGptFile(payload,backend,{fetchFn});
 assert.equal(replay.duplicate,true);
});
test("no fake files, expired refs, opaque JPG or missing reference access accepted",async()=>{
 const master=await image();
 const backend={getApprovedReferencePng:async()=>master};
 const base={file,appearanceId:"AP008",kind:"portrait",index:2,
   referenceAnchorSha256:sum(master)};
 await assert.rejects(()=>submitOfficialVariantFromChatGptFile({...base,
   file:{...file,download_url:"https://evil.invalid/file-ABCDEFGHIJK"}},backend),/untrusted/);
 await assert.rejects(()=>submitOfficialVariantFromChatGptFile({...base,
   file:{...file,download_url:"https://files.oaiusercontent.com/file-ABCDEFGHIJK?se=2020-01-01T00%3A00%3A00Z"}},backend),/expired/);
 await assert.rejects(()=>submitOfficialVariantFromChatGptFile(base,{}),/reference_access_missing/);
 const jpg=await sharp(master).flatten({background:"#ffffff"}).jpeg().toBuffer();
 await assert.rejects(()=>normalizeGeneratedImage(jpg,"portrait"),/real_alpha/);
});

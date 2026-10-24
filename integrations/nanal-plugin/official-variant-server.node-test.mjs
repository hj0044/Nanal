import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {submitExistingOfficialVariant,decodePngBase64} from "./official-variant-server.mjs";

const digest=b=>createHash("sha256").update(b).digest("hex");
const profileHash="a".repeat(64);
async function makeImage(role="portrait",tone={r:30,g:120,b:90}){
  const height=role==="portrait"?1024:1536, width=1024;
  const pixels=Buffer.alloc(width*height*4);
  for(let y=100;y<height-120;y++)for(let x=280;x<760;x++){
    const i=(y*width+x)*4;
    pixels[i]=tone.r;pixels[i+1]=tone.g;pixels[i+2]=tone.b;pixels[i+3]=255;
  }
  return sharp(pixels,{raw:{width,height,channels:4}}).png().toBuffer();
}
function mockBackend(master,overrides={}){
  const assets=new Map();let writes=0;
  const canonical={
    appearanceId:"AP008",reviewedOfficialReservation:true,status:"approved",
    profileSha256:profileHash,portraitAnchorSha256:digest(master),
    fullBodyAnchorSha256:"b".repeat(64),heightCm:166,weightKg:54
  };
  const backend={
    getApprovedCanonical:async()=>canonical,
    findVariantByRequestKey:async key=>assets.get(key)??null,
    createPendingVariantAtomic:async({metadata,originalPng,visualQa})=>{
      writes++;
      if(assets.has(metadata.requestKey))throw Error("unique constraint");
      assert.equal(metadata.status,"awaiting_review");
      assert.deepEqual(metadata.visualQaStatus,visualQa?.recommendedAction??"reference_not_provided");
      assert.equal(digest(originalPng),metadata.fileSha256);
      const row={assetId:"official-assets-"+writes,status:"awaiting_review",
        appearanceId:metadata.appearanceId,kind:metadata.kind,fileSha256:metadata.fileSha256};
      assets.set(metadata.requestKey,row);
      return {assetId:row.assetId,status:row.status};
    },
    ...overrides
  };
  return {backend,canonical,assets,getWrites:()=>writes};
}
test("existing AP variant uses verified anchor and remains private/review-pending",async()=>{
  const master=await makeImage();const candidate=await makeImage("portrait",{r:80,g:60,b:120});
  const db=mockBackend(master);
  const input={appearanceId:"AP008",kind:"portrait",index:2,
    referenceAnchorSha256:digest(master),pngBytes:candidate,referencePng:master};
  const a=await submitExistingOfficialVariant(input,db.backend);
  assert.equal(a.status,"awaiting_review");
  assert.equal(a.source,"official_nanal_plugin");
  assert.equal(a.visualQaStatus.startsWith("manual_review"),true);
  assert.equal(db.getWrites(),1);
  const b=await submitExistingOfficialVariant(input,db.backend);
  assert.equal(b.duplicate,true);assert.equal(db.getWrites(),1);
});
test("wrong anchor, missing canonical record, invalid image and fake request key fail before writes",async()=>{
  const master=await makeImage(),candidate=await makeImage("portrait",{r:60,g:60,b:60});
  const db=mockBackend(master);
  const base={appearanceId:"AP008",kind:"portrait",index:2,pngBytes:candidate,
    referenceAnchorSha256:digest(master)};
  await assert.rejects(()=>submitExistingOfficialVariant({...base,referenceAnchorSha256:"f".repeat(64)},db.backend),/anchor_mismatch/);
  await assert.rejects(()=>submitExistingOfficialVariant({...base,index:1},db.backend),/invalid_existing/);
  await assert.rejects(()=>submitExistingOfficialVariant({...base,requestKey:"guess"},db.backend),/request_key/);
  await assert.rejects(()=>submitExistingOfficialVariant(base,{...db.backend,getApprovedCanonical:async()=>null}),/identity_missing/);
  const wrong=await makeImage("fullbody");
  await assert.rejects(()=>submitExistingOfficialVariant({...base,pngBytes:wrong},db.backend),/canonical dimensions/);
  assert.equal(db.getWrites(),0);
});
test("production host must provide storage/db adapter; no false success on incomplete backend acknowledgement",async()=>{
  const master=await makeImage();
  const base={appearanceId:"AP008",kind:"portrait",index:2,pngBase64:(await makeImage("portrait",{r:90,g:90,b:90})).toString("base64"),
    referenceAnchorSha256:digest(master)};
  await assert.rejects(()=>submitExistingOfficialVariant(base,{}),/adapter_missing/);
  const db=mockBackend(master,{createPendingVariantAtomic:async()=>({status:"not_saved"})});
  await assert.rejects(()=>submitExistingOfficialVariant(base,db.backend),/did_not_confirm_pending_variant/);
});
test("same content different request key is rejected and corrupted base64 is refused",async()=>{
  const master=await makeImage();
  const db=mockBackend(master);
  const base={appearanceId:"AP008",kind:"portrait",index:2,
    referenceAnchorSha256:digest(master),pngBase64:(await makeImage("portrait",{r:70,g:170,b:70})).toString("base64")};
  const r=await submitExistingOfficialVariant(base,db.backend);assert.equal(r.status,"awaiting_review");
  await assert.rejects(()=>submitExistingOfficialVariant({...base,requestKey:"AP008:portrait:bogus"},db.backend),/request_key/);
  assert.throws(()=>decodePngBase64("not*base64"),/invalid_source_base64/);
});

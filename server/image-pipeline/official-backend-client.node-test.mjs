import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createOfficialNanalBackendClient } from "./official-backend-client.mjs";
const b=Buffer.alloc(100,123);
const sha=createHash("sha256").update(b).digest("hex");
const base="https://official.nanal.example";
const root="/v1/appearance";
const pack={
  appearanceId:"AP008",identity:{},identitySha256:sha,
  portrait:{assetId:"portrait008_v1",sha256:sha,role:"portrait",
    downloadPath:root+"/approved-assets/portrait008_v1/original",approved:true},
  fullBody:{assetId:"fullbody008_v1",sha256:sha,role:"fullBody",
    downloadPath:root+"/approved-assets/fullbody008_v1/original",approved:true}
};
test("official remote roster and locked reservation can be retrieved with secret only",async()=>{
 const visited=[];
 const client=createOfficialNanalBackendClient({
   officialApiOrigin:base,
   officialServiceToken:"a".repeat(48),
   fetchFn:async(url,options)=>{
     visited.push(url);
     assert.equal(options.headers.Authorization,"Bearer "+"a".repeat(48));
     assert.equal(options.redirect,"error");
     if(url.endsWith("/identities"))return Response.json({appearanceIds:["AP001","AP008","AP10000"]});
     return Response.json({appearanceId:"AP008",status:"approved",brief:{fullBodyTarget:12}});
   }
 });
 assert.deepEqual(await client.listOfficialAppearanceIds(),["AP001","AP008","AP10000"]);
 assert.equal((await client.getOfficialReservation({appearanceId:"AP008"})).status,"approved");
 assert.equal(visited.length,2);
});
test("approved canonical PNG binaries downloaded only from same-origin authenticated path",async()=>{
 const paths=[];
 const client=createOfficialNanalBackendClient({
   officialApiOrigin:base,officialServiceToken:"z".repeat(48),
   fetchFn:async(url,init)=>{
     paths.push(url);
     if(url.endsWith("/canonical"))return Response.json(pack);
     assert.ok(url.startsWith(base+root+"/approved-assets/"));
     assert.equal(init.credentials,"omit");
     return new Response(b,{headers:{"content-type":"image/png"}});
   }
 });
 const actual=await client.getCanonicalAssets({appearanceId:"AP008"});
 assert.equal(actual.portrait.png.length,100);
 assert.equal(actual.fullBody.png.length,100);
 assert.equal(paths.length,3);
});
test("tampered raw image or malicious download path cannot pass official SHA/provenance",async()=>{
 const client=createOfficialNanalBackendClient({
  officialApiOrigin:base,officialServiceToken:"a".repeat(48),
  fetchFn:async(url)=>{
    if(url.endsWith("/canonical"))return Response.json(pack);
    return new Response(Buffer.alloc(100,12),{headers:{"content-type":"image/png"}});
  }
 });
 await assert.rejects(()=>client.getCanonicalAssets({appearanceId:"AP008"}),
   /official_original_sha256_mismatch/);
 const other={...pack,portrait:{...pack.portrait,downloadPath:"https://evil.invalid/file"}};
 const client2=createOfficialNanalBackendClient({
  officialApiOrigin:base,officialServiceToken:"a".repeat(48),
  fetchFn:async(url)=>url.endsWith("/canonical")?Response.json(other):
    new Response(b,{headers:{"content-type":"image/png"}})
 });
 await assert.rejects(()=>client2.getCanonicalAssets({appearanceId:"AP008"}),
   /official_raw_asset_path_mismatch/);
});
test("same-ID variant request preserves original/anchor hash and checks remote acknowledgement",async()=>{
 let stored=null;
 const client=createOfficialNanalBackendClient({
  officialApiOrigin:base,officialServiceToken:"a".repeat(48),
  fetchFn:async(_url,init)=>{
    stored=init.body;
    assert.equal(stored.get("anchorSha256"),"b".repeat(64));
    assert.equal(stored.get("originalSha256"),sha);
    return Response.json({appearanceId:"AP008",assetId:"remote-8-2",
      status:"awaiting_review",originalSha256:sha});
  }
 });
 const result=await client.submitOfficialVariant({appearanceId:"AP008",
   kind:"fullbody",index:2,png:b,referenceAnchorSha256:"b".repeat(64),requestKey:"AP008:fullbody:0002"});
 assert.equal(result.status,"awaiting_review");
 assert.equal(stored.get("requestKey"),"AP008:fullbody:0002");
 assert.equal(stored.get("role"),"fullbody");
});
test("client refuses insecure endpoint and cannot fake official success",async()=>{
 assert.throws(()=>createOfficialNanalBackendClient({
  officialApiOrigin:"http://official.nanal.example",officialServiceToken:"a".repeat(48)
 }),/official_https_origin_required/);
 const client=createOfficialNanalBackendClient({
  officialApiOrigin:base,officialServiceToken:"a".repeat(48),
  fetchFn:async()=>Response.json({status:"awaiting_review",assetId:"invented"})
 });
 await assert.rejects(()=>client.submitOfficialVariant({appearanceId:"AP008",kind:"fullbody",
   index:2,png:b,referenceAnchorSha256:"b".repeat(64),requestKey:"AP008:fullbody:0002"
 }),/official_variant_acknowledgement_invalid/);
});

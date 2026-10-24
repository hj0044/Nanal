import test from "node:test";
import assert from "node:assert/strict";
import {probeActionLive} from "./probe-gpt-action-live.mjs";
const origin="https://game.nanal.example/";
const token="A".repeat(48);
const ref={
 id:"file-XX12345678YY",
 name:"test.png",
 mime_type:"image/png",
 download_link:"https://files.oaiusercontent.com/file-XX12345678YY?se=2099-12-31T10%3A20%3A00Z&sig=TEST"
};
test("without an actual ChatGPT Images file ref, readiness-only probe never claims transfer",async()=>{
 let posted=false;
 const fetch=async(url,request)=>{
   assert.equal(request.headers.authorization,"Bearer "+token);
   if(request.method!=="GET")posted=true;
   return Response.json({ready:true,source:"chatgpt_upload_only"});
 };
 const r=await probeActionLive({origin,token},fetch);
 assert.equal(r.backendReady,true);
 assert.equal(r.liveFileTransferTested,false);
 assert.equal(posted,false);
});
test("real signed file URL is sent only with --submit and an acknowledged D1/R2 result",async()=>{
 const seen=[];
 const fetch=async(url,options)=>{
   seen.push({url,options});
   return url.endsWith("/admin/status")?Response.json({ready:true}):
     Response.json({appearanceId:"AP008",assetId:"9d91cb47-4806-4d15-b813-f7f2cfc91665",
       status:"awaiting_review"},{status:201});
 };
 const r=await probeActionLive({origin,token,appearanceId:"AP008",slot:"portrait",fileReference:ref,commit:true},fetch);
 assert.equal(r.liveFileTransferTested,true);
 assert.equal(r.source,"game_side_D1_R2_not_official_plugin");
 assert.equal(r.status,"awaiting_review");
 assert.equal(seen.length,2);
 assert.deepEqual(JSON.parse(seen[1].options.body).openaiFileIdRefs,[ref]);
 assert.equal(JSON.stringify(r).includes(ref.download_link),false);
});
test("expired/forged references and server failures cannot be reported as success",async()=>{
 const ok=async url=>url.includes("admin/status")?Response.json({ready:true}):
   Response.json({error:"file_reference_invalid"},{status:422});
 const base={origin,token,appearanceId:"AP008",slot:"portrait",fileReference:ref,commit:true};
 await assert.rejects(()=>probeActionLive({...base,fileReference:{...ref,
  download_link:"https://attacker.invalid/file-XX12345678YY"}},ok),/Untrusted/);
 await assert.rejects(()=>probeActionLive({...base,fileReference:{...ref,
  download_link:"https://files.oaiusercontent.com/file-XX12345678YY?se=2020-01-01T00%3A00%3A00Z"}},ok),/expired/);
 await assert.rejects(()=>probeActionLive(base,ok),/HTTP 422/);
 await assert.rejects(()=>probeActionLive({origin:"http://localhost/",token},ok),/HTTPS/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { handoffGeneratedArtifact } from "./host-handoff.mjs";
import { preflightPng } from "../image-pipeline/game-db-submit.mjs";

function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const l=Buffer.alloc(4),c=Buffer.alloc(4);l.writeUInt32BE(data.length);const b=Buffer.concat([Buffer.from(type),data]);c.writeUInt32BE(crc(b));return Buffer.concat([l,b,c]);}
function png(w,h){const a=Buffer.alloc(13);a.writeUInt32BE(w);a.writeUInt32BE(h,4);a[8]=8;a[9]=6;return Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",a),chunk("IDAT",deflateSync(Buffer.alloc(h*(1+w*4)))),chunk("IEND",Buffer.alloc(0))])}
test("host cannot submit absent image bytes or missing trusted connector",async()=>{
 await assert.rejects(()=>handoffGeneratedArtifact({mode:"official-initial-pair",appearanceId:"AP008"}),/Buffers/);
 await assert.rejects(()=>handoffGeneratedArtifact({mode:"game-variant",appearanceId:"AP008"}),/Buffer/);
});
test("official initial pair routes through locked connector without using game DB",async()=>{
 let hits=0;
 const x=await handoffGeneratedArtifact({mode:"official-initial-pair",appearanceId:"AP008",
   portraitPng:png(1024,1024),fullBodyPng:png(1024,1536)},{
   getReservation:async()=>({appearanceId:"AP008",requestId:"reserve:AP008",status:"queued",
     prompts:{face:"sample face",fullBody:"sample body"},brief:{gender:"female"}}),
   submitReservedImages:async(payload)=>{hits++;assert.equal(payload.appearanceId,"AP008");
     assert.ok(payload.portraitPng.length>50);return {requestId:"reserve:AP008",status:"awaiting_review"};}
 });
 assert.equal(x.stage,"submitted_for_review");
 assert.equal(hits,1);
});
test("existing-ID host handoff never impersonates official variant upload",async()=>{
 let observed;
 const result=await handoffGeneratedArtifact({mode:"game-variant",appearanceId:"AP008",kind:"portrait",
   png:png(1024,1024)},{
   submitGameVariant:async p=>{observed=p;return {status:"awaiting_review"};}
 });
 assert.equal(result.status,"awaiting_review");
 assert.equal(observed.source,"trusted-host");
});
test("pixel-level alpha QA rejects fully opaque images",async()=>{
 const {default:sharp}=await import("sharp");
 const opaque=await sharp({create:{width:1024,height:1024,channels:4,
   background:{r:100,g:100,b:100,alpha:1}}}).png().toBuffer();
 await assert.rejects(()=>preflightPng(opaque,"portrait"),/Transparent background/);
 const background=await sharp({create:{width:1024,height:1024,channels:4,
   background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer();
 await assert.rejects(()=>preflightPng(background,"portrait"),/Opaque character foreground/);
 const sample=await sharp({create:{width:1024,height:1024,channels:4,
   background:{r:0,g:0,b:0,alpha:0}}}).composite([{
     input:{create:{width:200,height:200,channels:4,background:{r:255,g:255,b:255,alpha:1}}},
     left:300,top:300}]).png().toBuffer();
 const info=await preflightPng(sample,"portrait");
 assert.equal(info.width,1024);
});

test("official existing-ID upload is never silently sent to game DB",async()=>{
 const payload={mode:"official-existing-variant",appearanceId:"AP008",kind:"portrait",
   index:3,png:png(1024,1024),requestKey:"AP008-portrait-003",referenceAnchorSha256:"f".repeat(64)};
 await assert.rejects(()=>handoffGeneratedArtifact(payload,{
   submitGameVariant:async()=>{throw Error("must never use game DB");}
 }),/official_variant_submission_action_not_exposed/);
 let received;
 const result=await handoffGeneratedArtifact({...payload,requestKey:"AP008-portrait-003"},{
   submitOfficialVariant:async p=>{received=p;return {status:"awaiting_review",assetId:"official-variant-3"};}
 });
 assert.equal(result.destination,"official_nanal_plugin");
 assert.equal(received.appearanceId,"AP008");
 assert.ok(received.pngBase64.length>100);
 assert.equal(result.status,"awaiting_review");
});

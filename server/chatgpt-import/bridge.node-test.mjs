import test from "node:test";
import assert from "node:assert/strict";
import {deflateSync} from "node:zlib";
import {createInitialPairSubmission,inspectPngBase64} from "./validation.mjs";
import {importChatGptInitialPair} from "./bridge.mjs";
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const l=Buffer.alloc(4),c=Buffer.alloc(4);l.writeUInt32BE(data.length);const body=Buffer.concat([Buffer.from(type),data]);c.writeUInt32BE(crc32(body));return Buffer.concat([l,body,c])}
function png(w,h){
  const hd=Buffer.alloc(13);hd.writeUInt32BE(w);hd.writeUInt32BE(h,4);hd[8]=8;hd[9]=6;
  const z=deflateSync(Buffer.alloc(h*(1+w*4)));
  return Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",hd),chunk("IDAT",z),chunk("IEND",Buffer.alloc(0))]).toString("base64");
}
const portrait=png(1024,1024),body=png(1024,1536);
test("valid PNG pair, with no Nanal application daily cap",()=>{
  const p=createInitialPairSubmission({appearanceId:"AP017",portraitPng:portrait,fullBodyPng:body});
  assert.match(p.identityEvidence.portraitSha256,/^[a-f0-9]{64}$/);
  for(let i=0;i<101;i++)assert.ok(createInitialPairSubmission({appearanceId:"AP017",portraitPng:portrait,fullBodyPng:body}));
});
test("reject invalid dimensions, identity, format and corrupted PNG",()=>{
  assert.throws(()=>createInitialPairSubmission({appearanceId:"AP17",portraitPng:portrait,fullBodyPng:body}));
  assert.throws(()=>inspectPngBase64(body,{width:1024,height:1024}));
  assert.throws(()=>inspectPngBase64("fake-png",{width:1024,height:1024}));
  const corrupted=Buffer.from(portrait,"base64");corrupted[30]^=1;
  assert.throws(()=>inspectPngBase64(corrupted.toString("base64"),{width:1024,height:1024}),/CRC/);
});
test("submits exactly same reserved ID through official Nanal connector",async()=>{
  const seen=[];
  const result=await importChatGptInitialPair({appearanceId:"AP017",portraitPng:portrait,fullBodyPng:body},{
    getReservation:async(arg)=>{seen.push(["reserve",arg.appearanceId]);return {appearanceId:"AP017",requestId:"reserve:AP017",status:"queued",prompts:{face:"locked",fullBody:"locked"},brief:{gender:"female"}}},
    submitReservedImages:async(arg)=>{seen.push(["submit",arg.appearanceId,arg.requestId]);return {requestId:"reserve:AP017",status:"awaiting_review"}}
  });
  assert.equal(result.stage,"submitted_for_review");
  assert.deepEqual(seen,[["reserve","AP017"],["submit","AP017","reserve:AP017"]]);
});
test("rejects wrong reservation, approved overwrite and silent submission",async()=>{
  const input={appearanceId:"AP017",portraitPng:portrait,fullBodyPng:body};
  await assert.rejects(()=>importChatGptInitialPair(input,{getReservation:async()=>({appearanceId:"AP018",requestId:"reserve:AP018"}),submitReservedImages:async()=>({})}),/mismatch/);
  await assert.rejects(()=>importChatGptInitialPair(input,{getReservation:async()=>({appearanceId:"AP017",requestId:"reserve:AP017",status:"approved",prompts:{face:"x",fullBody:"y"},brief:{}}),submitReservedImages:async()=>({})}),/approved/);
  await assert.rejects(()=>importChatGptInitialPair(input,{getReservation:async()=>({appearanceId:"AP017",requestId:"reserve:AP017",status:"queued",prompts:{face:"x",fullBody:"y"},brief:{}}),submitReservedImages:async()=>null}),/not acknowledged/);
});

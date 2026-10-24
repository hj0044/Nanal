import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,readdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import sharp from "sharp";
import {submitChatGptBytes} from "./game-db-submit.mjs";

const key="D".repeat(48);
const hash="a".repeat(64),phash="b".repeat(64),bhash="c".repeat(64);
const profile={
  reviewedOfficialReservation:true,gender:"여성",ageMin:20,ageMax:29,
  profileSha256:hash,portraitAnchorSha256:phash,fullBodyAnchorSha256:bhash
};
async function makePng(kind="portrait",color="teal") {
  const w=1024,h=kind==="portrait"?1024:1536;
  const rgba=Buffer.alloc(w*h*4);
  for(let y=160;y<h-160;y++) for(let x=160;x<w-160;x++){
    const i=(y*w+x)*4;
    rgba[i]=color==="magenta"?255:50;
    rgba[i+1]=color==="magenta"?0:120;
    rgba[i+2]=color==="magenta"?255:130;
    rgba[i+3]=255;
  }
  if(color==="opaque")for(let i=3;i<rgba.length;i+=4)rgba[i]=255;
  return sharp(rgba,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
}
async function work(run) {
  const root=await mkdtemp(path.join(tmpdir(),"nanal-bytes-test-"));
  try {return await run(root);}finally{await rm(root,{recursive:true,force:true});}
}
function fetchMock(responseStatus=201){
  const seen=[];
  const fetch=async(url,options={})=>{
    seen.push({url,method:options.method,body:options.body});
    assert.equal(options.headers.authorization,"Bearer "+key);
    if(options.method==="PUT"){
      const metadata=JSON.parse(options.body);
      assert.equal(metadata.profileSha256,hash);
      assert.equal(metadata.qaSource,"reviewed_official_reservation");
      return Response.json({appearanceId:"AP008",status:"existing"});
    }
    if(options.method==="POST"){
      assert.equal(options.body.get("slot"),"portrait");
      assert.equal(options.body.get("profileSha256"),hash);
      assert.equal(options.body.get("anchorSha256"),phash);
      assert.match(options.body.get("requestKey"),/^AP008:portrait:[a-f0-9]{40}$/);
      return Response.json({assetId:"cb23323e-35ff-430b-a225-fd0a2aa4a89b",status:"awaiting_review"},{status:responseStatus});
    }
    throw Error("Unexpected HTTP "+options.method);
  };
  return{fetch,seen};
}
test("model-provided PNG bytes import hands off without user file selection",async()=>work(async(root)=>{
  const {fetch,seen}=fetchMock();
  const img=await makePng();
  const result=await submitChatGptBytes({
    characterId:"AP008",kind:"portrait",index:2,pngBytes:img,
    profile,localOnly:true,privateRoot:path.join(root,"original-backup")
  },{gameApiOrigin:"https://nanal.example",adminToken:key},{fetch});
  assert.equal(result.status,"awaiting_review");
  assert.equal(result.characterId,"AP008");
  assert.equal(seen.length,2);
  const names=await readdir(path.join(root,"original-backup","originals","AP008"));
  assert.equal(names.length,1);
  assert.match(names[0],/AP008-portrait-002-/);
}));
test("dry-run byte handoff performs no remote upload",async()=>{
  const result=await submitChatGptBytes({characterId:"AP008",kind:"portrait",index:2,
    pngBytes:await makePng(),profile,dryRun:true},{},{fetch:()=>{throw Error("Unexpected network")}});
  assert.equal(result.status,"dry_run");
});
test("absence of generated image bytes fails loudly",async()=>{
  await assert.rejects(()=>submitChatGptBytes({characterId:"AP008",kind:"portrait",index:2,profile}),/bytes unavailable/);
});
test("background and mismatched shape fail without publishing",async()=>{
  const valid=await makePng("portrait","teal");
  const opaque=await makePng("portrait","opaque");
  const magenta=await makePng("portrait","magenta");
  await assert.rejects(()=>submitChatGptBytes({characterId:"AP008",kind:"portrait",index:2,pngBytes:opaque,profile,dryRun:true}),/Transparent background/);
  await assert.rejects(()=>submitChatGptBytes({characterId:"AP008",kind:"portrait",index:2,pngBytes:magenta,profile,dryRun:true}),/magenta/);
  await assert.rejects(()=>submitChatGptBytes({characterId:"AP008",kind:"fullbody",index:2,pngBytes:valid,profile,dryRun:true}),/1024x1536/);
});
test("backup is mandatory by default, and remote 503 is not marked success",async()=>work(async(root)=>{
  const img=await makePng();
  const spec={characterId:"AP008",kind:"portrait",index:2,pngBytes:img,profile,
    privateRoot:path.join(root,"original-backup")};
  const {fetch}=fetchMock();
  await assert.rejects(()=>submitChatGptBytes(spec,{gameApiOrigin:"https://nanal.example",adminToken:key},{fetch}),/backup/);
  const {fetch:badFetch}=fetchMock(503);
  await assert.rejects(()=>submitChatGptBytes({...spec,localOnly:true},{gameApiOrigin:"https://nanal.example",adminToken:key},{fetch:badFetch}),/HTTP 503/);
});
test("no artificially enforced two-per-day image handoff cap",async()=>{
  const image=await makePng();
  const spec={characterId:"AP008",kind:"portrait",index:2,pngBytes:image,profile,dryRun:true};
  for(let i=0;i<12;i++) {
    const result=await submitChatGptBytes(spec,{});
    assert.equal(result.status,"dry_run");
  }
});

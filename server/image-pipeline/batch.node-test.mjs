import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { bulkImportCharacters, discoverCharacterImages } from "./batch.mjs";
import { submitChatGptFile } from "./game-db-submit.mjs";

const H=x=>createHash("sha256").update(x).digest("hex");
const filler="f".repeat(64);
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const l=Buffer.alloc(4),c=Buffer.alloc(4);l.writeUInt32BE(data.length);
  const b=Buffer.concat([Buffer.from(type),data]);c.writeUInt32BE(crc(b));return Buffer.concat([l,b,c]);}
function png(w,h){const a=Buffer.alloc(13);a.writeUInt32BE(w);a.writeUInt32BE(h,4);a[8]=8;a[9]=6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",a),
    chunk("IDAT",deflateSync(Buffer.alloc(h*(1+w*4)))),chunk("IEND",Buffer.alloc(0))]);}
async function fixture(fn){
  const root=await mkdtemp(path.join(os.tmpdir(),"nanal-batch-test-"));
  try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}
}
function registry(master,other=filler) {
  return {characters:{AP008:{gender:"여성",ageMin:20,ageMax:29,
    reviewedOfficialReservation:true,profileSha256:filler,
    portraitAnchorSha256:master,fullBodyAnchorSha256:other}}};
}
test("discovers AP files, ignores unrelated photos and symlinks",async()=>fixture(async(root)=>{
  await mkdir(path.join(root,"nested"));
  await writeFile(path.join(root,"nested","AP008-portrait-002.png"),"A");
  await writeFile(path.join(root,"AP008-portrait-001.png"),"A");
  await writeFile(path.join(root,"other-photo.jpg"),"X");
  const r=await discoverCharacterImages(root);
  assert.deepEqual(r.entries.map(x=>x.index),[1,2]);assert.equal(r.ignored.length,1);
}));
test("requires actual verified master anchor and skips invalid entries without aborting batch",async()=>fixture(async(root)=>{
  await writeFile(path.join(root,"AP008-portrait-001.png"),"wrong");
  await writeFile(path.join(root,"AP008-portrait-002.png"),"candidate");
  await writeFile(path.join(root,"AP009-fullbody-001.png"),"unknown");
  let calls=0;
  const output=await bulkImportCharacters({root,registry:registry(H(Buffer.from("master")))},
    {},{imagekitImporter:async()=>{calls++;return {status:"dry_run"};}});
  assert.equal(output.found,3);assert.equal(output.failed,2);
  assert.equal(output.completed,1);assert.equal(calls,1);
}));
test("no artificial daily quantity limit in batch pipeline",async()=>fixture(async(root)=>{
  for(let i=2;i<=103;i++)await writeFile(path.join(root,`AP008-portrait-${String(i).padStart(3,"0")}.png`),"x");
  const result=await bulkImportCharacters({root,registry:registry(filler)}, {},
    {imagekitImporter:async()=>({status:"dry_run"})});
  assert.equal(result.completed,102);assert.equal(result.failed,0);
}));
test("Game DB dry run validates real PNG and has no upload or local backup",async()=>fixture(async(root)=>{
  const b=png(1024,1024),f=path.join(root,"AP008-portrait-001.png");
  await writeFile(f,b);const profile=registry(H(b)).characters.AP008;
  const r=await submitChatGptFile({filePath:f,characterId:"AP008",kind:"portrait",
    index:1,profile,dryRun:true,privateRoot:path.join(root,"private")},{},
    {fetch:async()=>{throw Error("network not allowed");}});
  assert.equal(r.status,"dry_run");
}));
test("Game DB upload first backs up locally, then puts locked identity and stages variant",async()=>fixture(async(root)=>{
  const b=png(1024,1024),filePath=path.join(root,"AP008-portrait-001.png");
  await writeFile(filePath,b);const profile=registry(H(b)).characters.AP008;
  const privateRoot=path.join(root,"private");
  const calls=[];
  const fetch=async(url,init)=>{
    const originalDir=path.join(privateRoot,"originals","AP008");
    const {readdir}=await import("node:fs/promises");
    assert.ok((await readdir(originalDir)).length===1);
    calls.push({url,method:init.method});
    if(init.method==="PUT")return new Response(JSON.stringify({appearanceId:"AP008",status:"registered"}));
    if(init.method==="POST"){
      assert.equal(init.body.get("slot"),"portrait");
      assert.equal(init.body.get("anchorSha256"),H(b));
      return new Response(JSON.stringify({assetId:"c4ac2f55-238c-41c2-9077-5ab44cf382a4",status:"awaiting_review"}));
    }
    throw Error("Unexpected method");
  };
  const r=await submitChatGptFile({filePath,characterId:"AP008",kind:"portrait",index:1,profile,
    localOnly:true,privateRoot},{gameApiOrigin:"https://nanal.example",adminToken:"X".repeat(48)},{fetch});
  assert.equal(r.status,"awaiting_review");
  assert.deepEqual(calls.map(x=>x.method),["PUT","POST"]);
}));
test("refuses wrong anchor, unsafe API origin, and missing independent backup",async()=>fixture(async(root)=>{
  const b=png(1024,1024),filePath=path.join(root,"AP008-portrait-001.png");
  await writeFile(filePath,b);
  const params={filePath,characterId:"AP008",kind:"portrait",index:1};
  await assert.rejects(()=>submitChatGptFile({...params,profile:registry(filler).characters.AP008,dryRun:true}),/master anchor/);
  const profile=registry(H(b)).characters.AP008;
  await assert.rejects(()=>submitChatGptFile({...params,profile,localOnly:true},
    {gameApiOrigin:"http://nanal.example",adminToken:"X".repeat(48)}),/HTTPS/);
  await assert.rejects(()=>submitChatGptFile({...params,profile},
    {gameApiOrigin:"https://nanal.example",adminToken:"X".repeat(48)}),/Drive backup/);
}));

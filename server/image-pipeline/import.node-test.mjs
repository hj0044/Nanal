import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {createHash} from "node:crypto";
import {importCharacterImage,validateImport,isTrustedImagekitUrl} from "./import.mjs";

const master="a".repeat(64);
const convert=async()=>({bytes:Buffer.from("mock-webp"),width:1024,height:1536});
const config={imagekitPrivateKey:"private_mock",imagekitEndpoint:"https://ik.imagekit.io/account/nanal"};
async function fixture(fn){
  const root=await mkdtemp(path.join(os.tmpdir(),"nanal-image-test-"));
  const filePath=path.join(root,"portrait.png");
  const catalogPath=path.join(root,"catalog.json");
  await writeFile(filePath,Buffer.from("simulated-local-source"));
  await writeFile(catalogPath,JSON.stringify({schemaVersion:2,assets:[]}));
  const spec={filePath,catalogPath,privateRoot:path.join(root,"private"),characterId:"AP017",
    kind:"portrait",index:2,gender:"여성",ageMin:20,ageMax:29,anchorSha256:master};
  try{await fn(spec,root);}finally{await rm(root,{force:true,recursive:true});}
}
test("validates ID and mandatory master anchor",()=>{
  assert.throws(()=>validateImport({characterId:"../../bad",filePath:"a.png",kind:"portrait",index:1,gender:"여성",ageMin:20,ageMax:29}),/ID/);
  assert.throws(()=>validateImport({characterId:"AP017",filePath:"a.png",kind:"portrait",index:2,gender:"여성",ageMin:20,ageMax:29}),/anchor/);
  assert.equal(isTrustedImagekitUrl("https://ik.imagekit.io/account/nanal/AP017/x.webp",config.imagekitEndpoint),true);
  assert.equal(isTrustedImagekitUrl("https://ik.imagekit.io/account/nanal-evil/x.webp",config.imagekitEndpoint),false);
});
test("dry-run performs no remote upload and does not change catalog",async()=>fixture(async(spec)=>{
  const result=await importCharacterImage({...spec,dryRun:true},{},{
    convert,fetch:async()=>{throw Error("unexpected network");}
  });
  assert.equal(result.status,"dry_run");
  assert.deepEqual(JSON.parse(await readFile(spec.catalogPath,"utf8")).assets,[]);
}));
test("requires independent backup unless explicit local-only opt-in",async()=>fixture(async(spec)=>{
  await assert.rejects(()=>importCharacterImage(spec,config,{convert}),/mandatory/);
}));
test("local backup + upload stages only reviewable candidate and is idempotent",async()=>fixture(async(spec)=>{
  let uploads=0;
  const fetch=async(url)=>{
    assert.equal(String(url),"https://upload.imagekit.io/api/v1/files/upload");uploads++;
    return new Response(JSON.stringify({fileId:"ik1",url:"https://ik.imagekit.io/account/nanal/AP017/AP017-portrait-002.webp"}));
  };
  const first=await importCharacterImage({...spec,localOnly:true},config,{fetch,convert});
  assert.equal(first.status,"awaiting_review");
  const assets=JSON.parse(await readFile(spec.catalogPath,"utf8")).assets;
  assert.equal(assets.length,1);
  assert.equal(assets[0].runtimeEligible,false);
  assert.equal(assets[0].status,"awaiting_review");
  const second=await importCharacterImage({...spec,localOnly:true},config,{fetch,convert});
  assert.equal(second.status,"already_registered");
  assert.equal(uploads,1);
}));
test("Drive upload+checksum happens before ImageKit",async()=>fixture(async(spec)=>{
  const events=[];
  const original=await readFile(spec.filePath);
  const checksum=createHash("md5").update(original).digest("hex");
  const fetch=async(url,init={})=>{
    const u=String(url);
    if(u.includes("drive/v3/files?")&&init.method!=="POST"){
      const q=new URL(u).searchParams.get("q");
      return new Response(JSON.stringify({files:q.includes("mimeType")?[{id:"CHAR_FOLDER"}]:[]}));
    }
    if(u.includes("uploadType=resumable")){events.push("drive-init");
      return new Response(null,{headers:{location:"https://www.googleapis.com/mock-upload"}});}
    if(u==="https://www.googleapis.com/mock-upload"){events.push("drive-done");
      return new Response(JSON.stringify({id:"FILE",md5Checksum:checksum,size:original.length}));}
    if(u.includes("imagekit.io")){events.push("imagekit");
      return new Response(JSON.stringify({fileId:"ik1",url:"https://ik.imagekit.io/account/nanal/AP017/AP017-portrait-002.webp"}));}
    throw Error("Unexpected "+u);
  };
  const result=await importCharacterImage(spec,{...config,googleFolderId:"ROOT",googleAccessToken:"TEST"},{fetch,convert});
  assert.deepEqual(events,["drive-init","drive-done","imagekit"]);
  assert.equal(result.driveFileId,"FILE");
}));

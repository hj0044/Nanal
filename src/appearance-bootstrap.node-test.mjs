import test from "node:test";
import assert from "node:assert/strict";
import {deflateSync} from "node:zlib";
import {handleAppearanceApi} from "./appearance-api.ts";
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const l=Buffer.alloc(4),c=Buffer.alloc(4);l.writeUInt32BE(data.length);const b=Buffer.concat([Buffer.from(type),data]);c.writeUInt32BE(crc(b));return Buffer.concat([l,b,c])}
function png(w,h,seed){
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 const raw=Buffer.alloc(h*(1+w*4));
 // Distinct deterministic pixels: PNG validity and hashes without a real portrait identity claim.
 raw[5]=seed;raw[9]=seed;
 return Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",ihdr),
   chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]);
}
class DB {
 constructor(){this.ids=new Map();this.assets=new Map()}
 prepare(sql){return {bind:(...args)=>({
   first:async()=>{
     if(sql.includes("FROM appearance_identities"))return this.ids.get(args[0])??null;
     if(sql.includes("WHERE request_key"))return [...this.assets.values()].find(a=>a.request_key===args[0])??null;
     if(sql.includes("FROM appearance_variants"))return this.assets.get(args[0])??null;
     return null;
   },
   all:async()=>{
     if(sql.includes("FROM appearance_identities"))return {results:[...this.ids.values()]};
     if(sql.includes("FROM appearance_variants"))return {results:[...this.assets.values()]
       .filter(a=>a.status===(sql.includes("status = 'approved'")?"approved":args[0]))};
     return {results:[]};
   },
   run:async()=>{
     if(sql.startsWith("INSERT INTO appearance_identities")){
       const [id,gender,min,max,profile,portrait,fullBody,source]=args;
       if(this.ids.has(id))throw Error("duplicate id");
       this.ids.set(id,{appearance_id:id,gender,age_min:min,age_max:max,
         profile_sha256:profile,portrait_anchor_sha256:portrait,
         full_body_anchor_sha256:fullBody,source});
     }else if(sql.startsWith("INSERT INTO appearance_variants")){
       const [assetId,key,id,gender,min,max,slot,profile,anchor,fileSha,storageKey,status]=args;
       if([...this.assets.values()].some(x=>x.request_key===key))throw Error("duplicate key");
       this.assets.set(assetId,{asset_id:assetId,request_key:key,appearance_id:id,gender,
         age_min:min,age_max:max,slot,profile_sha256:profile,anchor_sha256:anchor,
         file_sha256:fileSha,storage_key:storageKey,status});
     }else if(sql.startsWith("UPDATE appearance_variants")){
       const [status,note,at,id]=args;Object.assign(this.assets.get(id),
         {status,review_note:note,approved_at:at});
     }
     return {success:true};
   }
 })}}
}
const token="A".repeat(48),host="https://nanal.test";
function setup(){
 const db=new DB(),objects=new Map();
 const env={NANAL_APPEARANCE_DB:db,NANAL_APPEARANCE_IMAGES:{
  put:async(key,bytes)=>objects.set(key,Buffer.from(bytes)),
  get:async(key)=>objects.has(key)?{arrayBuffer:async()=>Uint8Array.from(objects.get(key)).buffer}:null,
  delete:async(key)=>objects.delete(key)},
  NANAL_APPEARANCE_ADMIN_TOKEN:token
 };
 return {db,objects,env};
}
function req(method,url,body,auth=true){
 return new Request(host+url,{method,body,headers:auth?{authorization:"Bearer "+token}:{}});
}
function bootstrapForm(seed=1,id="AP008"){
 const f=new FormData();
 for(const [k,v] of Object.entries({gender:"여성",ageMin:"20",ageMax:"29",
 heightCm:"162",weightKg:"49",reservationId:"reserve:"+id,
 reviewNotes:"Official reservation AP008 checked against approved face and full-body original by owner.",
 ownerConfirmed:"true"}))f.set(k,v);
 f.set("portrait",new Blob([png(1024,1024,seed)],{type:"image/png"}),"portrait.png");
 f.set("fullBody",new Blob([png(1024,1536,seed+5)],{type:"image/png"}),"body.png");
 return f;
}
async function bootstrap(env,seed=1,id="AP008"){
 return handleAppearanceApi(req("POST","/api/appearance/identities/"+id+"/bootstrap",
   bootstrapForm(seed,id)),env);
}
test("owner registers real original bytes and computed sha locks; public cannot retrieve originals",async()=>{
 const {db,objects,env}=setup();
 const forbidden=await handleAppearanceApi(req("POST","/api/appearance/identities/AP008/bootstrap",
   bootstrapForm(),false),env);assert.equal(forbidden.status,401);
 const response=await bootstrap(env);
 assert.equal(response.status,201);
 const result=await response.json();
 assert.equal(result.status,"registered");assert.equal(result.originalsStored,true);
 assert.equal(db.ids.get("AP008").profile_sha256,result.profileSha256);
 assert.equal(objects.size,3); // portrait, fullbody and private QA evidence
 const blocked=await handleAppearanceApi(req("GET","/api/appearance/admin/references/AP008/portrait",undefined,false),env);
 assert.equal(blocked.status,401);
 const master=await handleAppearanceApi(req("GET","/api/appearance/admin/references/AP008/portrait"),env);
 assert.equal(master.status,200);
 assert.deepEqual(Buffer.from(await master.arrayBuffer()),png(1024,1024,1));
 assert.equal((await handleAppearanceApi(req("GET","/api/appearance/catalog",undefined,false),env)).status,200);
 assert.equal((await (await handleAppearanceApi(req("GET","/api/appearance/catalog",undefined,false),env)).json()).assets.length,0);
});
test("same master replay is idempotent; changed original cannot change locked ID",async()=>{
 const {db,objects,env}=setup();
 assert.equal((await bootstrap(env)).status,201);
 assert.equal((await (await bootstrap(env)).json()).status,"existing");
 assert.equal(objects.size,3);
 const conflict=await bootstrap(env,2);
 assert.equal(conflict.status,409);
 assert.equal((await conflict.json()).error,"identity_locked");
 assert.equal(db.ids.size,1);
});
test("bootstrap rejects unverified source and arbitrary AP reservation label",async()=>{
 const {env}=setup();
 const f=bootstrapForm();
 f.set("reservationId","reserve:AP777");
 const invalid=await handleAppearanceApi(req("POST","/api/appearance/identities/AP008/bootstrap",f),env);
 assert.equal(invalid.status,422);
 const f2=bootstrapForm();f2.set("ownerConfirmed","false");
 assert.equal((await handleAppearanceApi(req("POST","/api/appearance/identities/AP008/bootstrap",f2),env)).status,422);
 const f3=bootstrapForm();f3.set("heightCm","bad");
 assert.equal((await handleAppearanceApi(req("POST","/api/appearance/identities/AP008/bootstrap",f3),env)).status,422);
});
test("submitted candidate stays private, owner compares canonical original then QA approves for game",async()=>{
 const {env}=setup();const b=await (await bootstrap(env)).json();
 const f=new FormData();
 f.set("slot","portrait");f.set("profileSha256",b.profileSha256);
 f.set("anchorSha256",b.portraitAnchorSha256);
 f.set("requestKey","AP008:portrait:variant-00001");
 f.set("image",new Blob([png(1024,1024,9)],{type:"image/png"}),"variant.png");
 const response=await handleAppearanceApi(req("POST","/api/appearance/identities/AP008/variants",f),env);
 assert.equal(response.status,201);const entry=await response.json();
 const unauth=await handleAppearanceApi(req("GET","/api/appearance/admin/queue",undefined,false),env);
 assert.equal(unauth.status,401);
 const ids=await (await handleAppearanceApi(req("GET","/api/appearance/admin/identities"),env)).json();
 assert.equal(ids.identities[0].portraitAnchorSha256,b.portraitAnchorSha256);
 const q=await (await handleAppearanceApi(req("GET","/api/appearance/admin/queue"),env)).json();
 assert.equal(q.assets.length,1);assert.equal(q.assets[0].assetId,entry.assetId);
 assert.equal((await handleAppearanceApi(req("GET","/api/appearance/assets/"+entry.assetId,undefined,false),env)).status,404);
 const note="I compared the face geometry, figure, height proportion, transparent background, and original AP008 face anchor.";
 const keys=["face","body","heightScale","chestSilhouette","transparentBackground","matchesCanonicalAnchor"];
 const qa=Object.fromEntries(keys.map(k=>[k,true]));
 const approved=await handleAppearanceApi(req("POST","/api/appearance/variants/"+entry.assetId+"/review",
  JSON.stringify({decision:"approved",qa,notes:note}),true),env);
 // JSON POST must have no Content-Type requirement in the server.
 assert.equal(approved.status,200);
 const catalog=await (await handleAppearanceApi(req("GET","/api/appearance/catalog",undefined,false),env)).json();
 assert.equal(catalog.assets.length,1);assert.equal(catalog.assets[0].characterId,"AP008");
});

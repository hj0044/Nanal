import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { handleAppearanceApi } from "./appearance-api.ts";
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0)}return(c^0xffffffff)>>>0}
function chunk(type,data){const l=Buffer.alloc(4),c=Buffer.alloc(4);l.writeUInt32BE(data.length);const b=Buffer.concat([Buffer.from(type),data]);c.writeUInt32BE(crc(b));return Buffer.concat([l,b,c])}
function png(w,h){const a=Buffer.alloc(13);a.writeUInt32BE(w);a.writeUInt32BE(h,4);a[8]=8;a[9]=6;return Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",a),chunk("IDAT",deflateSync(Buffer.alloc(h*(1+w*4)))),chunk("IEND",Buffer.alloc(0))])}
class DB {
  constructor(){this.ids=new Map();this.assets=new Map();this.targets=new Map();this.targetAudit=[]}
  prepare(sql){return{bind:(...args)=>({
    first:async()=>{
      if(sql.includes("FROM appearance_identities"))return this.ids.get(args[0])||null;
      if(sql.includes("FROM appearance_image_targets"))return this.targets.get(args[0]+":"+args[1])||null;
      if(sql.includes("WHERE request_key"))return [...this.assets.values()].find(x=>x.request_key===args[0])||null;
      if(sql.includes("FROM appearance_variants")){
        const a=this.assets.get(args[0]);return sql.includes("status = 'approved'")&&a?.status!=="approved"?null:a||null;
      }
      return null;
    },
    all:async()=>({results:sql.includes("FROM appearance_identities")?[...this.ids.values()]:
      sql.includes("FROM appearance_image_targets")?[...this.targets.values()]:
      sql.includes("SELECT appearance_id,slot,status,file_sha256 FROM appearance_variants")?[...this.assets.values()]:
      [...this.assets.values()].filter(x=>x.status==="approved")}),
    run:async()=>{
      if(sql.startsWith("INSERT INTO appearance_identities")){
        const [id,gender,min,max,profile,portrait,fullBody,source]=args;
        this.ids.set(id,{appearance_id:id,gender,age_min:min,age_max:max,profile_sha256:profile,portrait_anchor_sha256:portrait,full_body_anchor_sha256:fullBody,source});
      } else if(sql.startsWith("INSERT INTO appearance_variants")){
        const [assetId,key,id,gender,min,max,slot,profile,anchor,fileHash,storageKey,status]=args;
        if([...this.assets.values()].some(x=>x.request_key===key))throw Error("duplicate");
        this.assets.set(assetId,{asset_id:assetId,request_key:key,appearance_id:id,gender,age_min:min,age_max:max,slot,profile_sha256:profile,anchor_sha256:anchor,file_sha256:fileHash,storage_key:storageKey,status});
      } else if(sql.startsWith("INSERT INTO appearance_image_targets")){
        const [id,slot,target,source,profile]=args;
        const key=id+":"+slot,old=this.targets.get(key);
        this.targets.set(key,{appearance_id:id,slot,target_count:target,source,profile_sha256:profile,updated_at:"2026-10-24"});
        this.targetAudit.push({id,slot,previous:old?.target_count??null,target});
      } else if(sql.startsWith("UPDATE appearance_variants")){
        const [status,note,at,id]=args;Object.assign(this.assets.get(id),{status,review_note:note,approved_at:at});
      }
      return {success:true};
    }
  })}}
}
const token="X".repeat(48), profile="a".repeat(64), portrait="b".repeat(64), body="c".repeat(64);
const host="https://nanal.example";
function setup(){const db=new DB(),files=new Map();return{db,env:{
  NANAL_APPEARANCE_DB:db,
  NANAL_APPEARANCE_IMAGES:{put:async(k,b)=>files.set(k,Buffer.from(b)),get:async(k)=>files.has(k)?{arrayBuffer:async()=>Uint8Array.from(files.get(k)).buffer}:null,delete:async(k)=>files.delete(k)},
  NANAL_APPEARANCE_ADMIN_TOKEN:token
}}}
function request(method,path,payload,secure=true){return new Request(host+path,{method,headers:{...(secure?{authorization:"Bearer "+token}:{}),...(typeof payload==="string"?{"content-type":"application/json"}:{})},body:payload})}
function identity(env){return handleAppearanceApi(request("PUT","/api/appearance/identities/AP008",JSON.stringify({
 gender:"여성",ageMin:20,ageMax:29,profileSha256:profile,portraitAnchorSha256:portrait,fullBodyAnchorSha256:body,qaSource:"reviewed_official_reservation"
})),env)}
function upload(key="AP008:variant:00001",file=png(1024,1536),anch=body){
 const form=new FormData();form.set("slot","fullBody");form.set("profileSha256",profile);form.set("anchorSha256",anch);
 form.set("requestKey",key);form.set("image",new Blob([file],{type:"image/png"}),"nanal.png");
 return request("POST","/api/appearance/identities/AP008/variants",form);
}
const qa={face:true,body:true,heightScale:true,chestSilhouette:true,transparentBackground:true,matchesCanonicalAnchor:true};
test("reject unconfigured and unauthenticated write",async()=>{
 const {env}=setup();
 assert.equal((await handleAppearanceApi(request("GET","/api/appearance/catalog"),{})).status,503);
 assert.equal((await handleAppearanceApi(request("PUT","/api/appearance/identities/AP008","{}",false),env)).status,401);
});
test("PNG submit -> blocked from public -> reviewed -> approved image serving",async()=>{
 const {env}=setup();assert.equal((await identity(env)).status,201);
 const response=await handleAppearanceApi(upload(),env);assert.equal(response.status,201);const candidate=await response.json();
 const imagePath="/api/appearance/assets/"+candidate.assetId;
 assert.equal((await handleAppearanceApi(request("GET",imagePath,undefined,false),env)).status,404);
 assert.equal((await (await handleAppearanceApi(request("GET","/api/appearance/catalog",undefined,false),env)).json()).assets.length,0);
 const note="Original AP008 reference verified for face, stature, silhouette and transparent PNG background.";
 const approved=await handleAppearanceApi(request("POST","/api/appearance/variants/"+candidate.assetId+"/review",JSON.stringify({decision:"approved",notes:note,qa})),env);
 assert.equal(approved.status,200);
 const catalog=await (await handleAppearanceApi(request("GET","/api/appearance/catalog",undefined,false),env)).json();
 assert.equal(catalog.assets.length,1);assert.equal(catalog.assets[0].imagePath,imagePath);
 const image=await handleAppearanceApi(request("GET",imagePath,undefined,false),env);
 assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),png(1024,1536));
});
test("reject bad anchor, missing visual QA and duplicate differing bytes",async()=>{
 const {env}=setup();await identity(env);
 assert.equal((await handleAppearanceApi(upload("AP008:variant:00002",png(1024,1536),profile),env)).status,409);
 const first=await (await handleAppearanceApi(upload(),env)).json();
 assert.equal((await (await handleAppearanceApi(upload(),env)).json()).duplicate,true);
 const malformed=await handleAppearanceApi(upload("AP008:variant:00001",png(1024,1024)),env);
 assert.equal(malformed.status,400);
 const rejected=await handleAppearanceApi(request("POST","/api/appearance/variants/"+first.assetId+"/review",JSON.stringify({decision:"approved",notes:"No verified visual comparison with the official character reference.",qa:{}})),env);
 assert.equal(rejected.status,409);
});
test("invalid PNG CRC never reaches storage", async()=>{
  const {env,db}=setup();await identity(env);
  const bytes=png(1024,1536);bytes[32]^=1;
  const response=await handleAppearanceApi(upload("AP008:variant:brokencrc",bytes),env);
  assert.equal(response.status,400);
  assert.equal(db.assets.size,0);
});
test("101 valid distinct submissions accepted without local two-per-day quota",async()=>{
 const {env,db}=setup();await identity(env);
 const bytes=png(1024,1536);
 for(let i=0;i<101;i++){
   const response=await handleAppearanceApi(upload("AP008:variant:"+String(i).padStart(6,"0"),bytes),env);
   assert.equal(response.status,201);
 }
 assert.equal(db.assets.size,101);
});


test("GPT Action signed image file reference auto-imports without a manual image download",async()=>{
  const {env,db}=setup();await identity(env);
  const bytes=png(1024,1024);
  const link="https://files.oaiusercontent.com/file-EXAMPLE123456789?se=2099-01-01T00%3A00%3A00Z&sig=fakesignature";
  let fetches=0;
  const fetcher=async(url,init)=>{
    fetches++;assert.equal(url,link);
    assert.equal(init.redirect,"error");
    assert.equal(init.credentials,"omit");
    return new Response(bytes,{status:200,headers:{"content-type":"image/png","content-length":String(bytes.length)}});
  };
  const payload=JSON.stringify({appearanceId:"AP008",slot:"portrait",
    openaiFileIdRefs:[{id:"file-EXAMPLE123456789",name:"generated.png",mime_type:"image/png",download_link:link}]});
  const first=await handleAppearanceApi(request("POST","/api/appearance/actions/ingest",payload),env,fetcher);
  assert.equal(first.status,201);
  const a=await first.json();
  assert.equal(a.status,"awaiting_review");assert.ok(a.assetId);
  assert.equal(db.assets.size,1);
  const repeat=await handleAppearanceApi(request("POST","/api/appearance/actions/ingest",payload),env,fetcher);
  assert.equal(repeat.status,200);
  assert.equal((await repeat.json()).duplicate,true);
  assert.equal(fetches,2);
  const pending=await handleAppearanceApi(request("GET","/api/appearance/assets/"+a.assetId,undefined,false),env);
  assert.equal(pending.status,404);
  const privateView=await handleAppearanceApi(request("GET","/api/appearance/admin/assets/"+a.assetId),env);
  assert.equal(privateView.status,200);
  assert.equal(privateView.headers.get("cache-control"),"no-store");
});
test("GPT Action source URL is host-restricted and does not follow redirects",async()=>{
  const {env}=setup();await identity(env);
  let reads=0;
  const badSources=[
    "https://example.net/private",
    "http://files.oaiusercontent.com/file-EXAMPLE123456789",
    "https://files.oaiusercontent.com.evil.invalid/file-EXAMPLE123456789",
    "https://files.oaiusercontent.com@evil.invalid/file-EXAMPLE123456789",
    "https://files.oaiusercontent.com/file-EXAMPLE123456789?se=2020-01-01T00:00:00Z"
  ];
  for(const link of badSources) {
    const payload=JSON.stringify({appearanceId:"AP008",slot:"portrait",
      openaiFileIdRefs:[{id:"file-EXAMPLE123456789",download_link:link}]});
    const res=await handleAppearanceApi(request("POST","/api/appearance/actions/ingest",payload),env,async()=>{reads++;throw Error("SSRF")});
    assert.equal(res.status,422);
  }
  assert.equal(reads,0);
});
test("GPT Action refuses unauthenticated file references",async()=>{
  const {env}=setup();
  const response=await handleAppearanceApi(request("POST","/api/appearance/actions/ingest",JSON.stringify({
    appearanceId:"AP008",slot:"portrait",openaiFileIdRefs:[{id:"file-EXAMPLE123456789",
      download_link:"https://files.oaiusercontent.com/file-EXAMPLE123456789"}]
  }),false),env,async()=>{throw Error("must not download")});
  assert.equal(response.status,401);
});
test("GPT Action cannot claim success when signed link has invalid image bytes",async()=>{
  const {env,db}=setup();await identity(env);
  const payload=JSON.stringify({appearanceId:"AP008",slot:"portrait",
    openaiFileIdRefs:[{id:"file-EXAMPLE123456789",download_link:"https://files.oaiusercontent.com/file-EXAMPLE123456789"}]});
  const response=await handleAppearanceApi(request("POST","/api/appearance/actions/ingest",payload),env,
    async()=>new Response("webp-not-a-png",{status:200}));
  assert.equal(response.status,422);
  assert.equal((await response.json()).error,"image_format_invalid");
  assert.equal(db.assets.size,0);
});


function webpMock(marker=1) {
 const payload=Buffer.from([marker,2,3,4]);
 const body=Buffer.alloc(20+payload.length);
 body.write("RIFF",0);body.writeUInt32LE(body.length-8,4);
 body.write("WEBP",8);body.write("VP8L",12);body.writeUInt32LE(payload.length,16);
 payload.copy(body,20);
 return body;
}
test("optimized derivatives are private before QA and require canonical source SHA-256",async()=>{
 const {env}=setup();await identity(env);
 const candidate=await (await handleAppearanceApi(upload(),env)).json();
 const url="/api/appearance/variants/"+candidate.assetId+"/derivatives/320";
 const b=webpMock();
 const unauth=await handleAppearanceApi(request("PUT",url,b,false),env);
 assert.equal(unauth.status,401);
 const wrong=await handleAppearanceApi(new Request(host+url,{method:"PUT",
   headers:{authorization:"Bearer "+token,"content-type":"image/webp","x-source-sha256":profile},body:b}),env);
 assert.equal(wrong.status,409);
 const pngHash=await crypto.subtle.digest("SHA-256",png(1024,1536));
 const sourceHash=Buffer.from(pngHash).toString("hex");
 const good=()=>new Request(host+url,{method:"PUT",
   headers:{authorization:"Bearer "+token,"content-type":"image/webp","x-source-sha256":sourceHash},body:b});
 assert.equal((await handleAppearanceApi(good(),env)).status,201);
 assert.equal((await handleAppearanceApi(good(),env)).status,200);
 const conflict=new Request(host+url,{method:"PUT",headers:{
    authorization:"Bearer "+token,"content-type":"image/webp","x-source-sha256":sourceHash},
   body:webpMock(99)});
 assert.equal((await handleAppearanceApi(conflict,env)).status,409);
 const imagePath="/api/appearance/assets/"+candidate.assetId+"?w=320";
 assert.equal((await handleAppearanceApi(request("GET",imagePath,undefined,false),env)).status,404);
 await handleAppearanceApi(request("POST","/api/appearance/variants/"+candidate.assetId+"/review",JSON.stringify({
   decision:"approved",notes:"This fictional AP008 image was independently checked against its locked original dimensions and reference silhouette.",
   qa})),env);
 const optimized=await handleAppearanceApi(request("GET",imagePath,undefined,false),env);
 assert.equal(optimized.headers.get("content-type"),"image/webp");
 assert.deepEqual(Buffer.from(await optimized.arrayBuffer()),b);
 const fallback=await handleAppearanceApi(request("GET","/api/appearance/assets/"+candidate.assetId+"?w=160",undefined,false),env);
 assert.equal(fallback.headers.get("content-type"),"image/png");
 assert.equal((await handleAppearanceApi(request("GET","/api/appearance/assets/"+candidate.assetId+"?w=123",undefined,false),env)).status,400);
});


test("owner can set official per-AP goals without modifying image approval",async()=>{
 const {env,db}=setup();await identity(env);
 const endpoint="/api/appearance/identities/AP008/targets";
 const content=JSON.stringify({slot:"fullBody",targetCount:12,source:"verified_official_reservation",profileSha256:profile});
 assert.equal((await handleAppearanceApi(request("PUT",endpoint,content,false),env)).status,401);
 assert.equal((await handleAppearanceApi(request("PUT",endpoint,content),env)).status,201);
 assert.equal((await handleAppearanceApi(request("PUT",endpoint,content),env)).status,200);
 assert.equal(db.targetAudit.length,1);
 const path="/api/appearance/admin/inventory/AP008";
 assert.equal((await handleAppearanceApi(request("GET",path,undefined,false),env)).status,401);
 const inv=(await (await handleAppearanceApi(request("GET",path),env)).json()).inventory;
 assert.equal(inv.counts.fullBody.targetCount,12);
 assert.equal(inv.counts.fullBody.approved,0);
 assert.equal(inv.counts.fullBody.remainingToApprove,12);
 assert.equal(inv.counts.portrait.targetCount,null);
 const image=await handleAppearanceApi(upload("AP008:dynamic:001"),env);
 assert.equal(image.status,201);
 const after=(await (await handleAppearanceApi(request("GET",path),env)).json()).inventory;
 assert.equal(after.counts.fullBody.awaitingReview,1);
 assert.equal(after.counts.fullBody.remainingToApprove,12);
 assert.equal(after.counts.fullBody.unfilledAfterPending,11);
 assert.equal((await (await handleAppearanceApi(request("GET","/api/appearance/catalog",undefined,false),env)).json()).assets.length,0);
});
test("all registered AP IDs, including future IDs, appear with unknown rather than guessed targets",async()=>{
 const {env}=setup();await identity(env);
 for(const id of ["AP001","AP020","AP021","AP10000"]){
  const p=JSON.stringify({gender:"여성",ageMin:20,ageMax:29,profileSha256:profile,
    portraitAnchorSha256:portrait,fullBodyAnchorSha256:body,qaSource:"reviewed_official_reservation"});
  assert.equal((await handleAppearanceApi(request("PUT","/api/appearance/identities/"+id,p),env)).status,201);
 }
 const res=await handleAppearanceApi(request("GET","/api/appearance/admin/inventory"),env);
 assert.equal(res.status,200);
 const payload=await res.json();
 assert.equal(payload.officialDatabaseIncluded,false);
 assert.equal(payload.totalIdentities,5);
 assert.deepEqual(payload.inventory.map(i=>i.appearanceId),["AP001","AP008","AP020","AP021","AP10000"]);
 assert.equal(payload.inventory.find(i=>i.appearanceId==="AP10000").counts.fullBody.targetCount,null);
 assert.equal((await handleAppearanceApi(request("GET","/api/appearance/admin/inventory/AP999"),env)).status,404);
});
test("profile locked target updates reject fabricated or obsolete reservation metadata",async()=>{
 const {env,db}=setup();await identity(env);
 const endpoint="/api/appearance/identities/AP008/targets";
 const valid={slot:"fullBody",targetCount:12,source:"verified_official_reservation",profileSha256:profile};
 assert.equal((await handleAppearanceApi(request("PUT",endpoint,JSON.stringify({...valid,profileSha256:body})),env)).status,409);
 assert.equal((await handleAppearanceApi(request("PUT",endpoint,JSON.stringify({...valid,targetCount:-1})),env)).status,400);
 assert.equal((await handleAppearanceApi(request("PUT",endpoint,JSON.stringify({...valid,targetCount:"12"})),env)).status,400);
 assert.equal((await handleAppearanceApi(request("PUT",endpoint,JSON.stringify({...valid,source:"unverified_ai_guess"})),env)).status,400);
 assert.equal(db.targets.size,0);
 assert.equal((await handleAppearanceApi(request("PUT",endpoint,JSON.stringify(valid)),env)).status,201);
 assert.equal((await handleAppearanceApi(request("PUT",endpoint,JSON.stringify({...valid,targetCount:14})),env)).status,200);
 assert.equal(db.targets.get("AP008:fullBody").target_count,14);
 assert.equal(db.targetAudit.length,2);
});

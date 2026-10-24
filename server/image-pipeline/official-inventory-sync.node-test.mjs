import test from "node:test";
import assert from "node:assert/strict";
import { synchronizeOfficialImageTargets, createGameTargetApiClient } from "./official-inventory-sync.mjs";

const VALID="a".repeat(64);
const ids=Array.from({length:20},(_,i)=>"AP"+String(i+1).padStart(3,"0"));

test("dynamic provider list covers original AP001-020 and arbitrary future AP IDs",async()=>{
 const seen=[],database=new Map();
 const result=await synchronizeOfficialImageTargets({},{
   listOfficialAppearanceIds:async()=>[...ids,"AP021","AP12345","AP021"],
   getOfficialReservation:async({appearanceId})=>({
     appearanceId,status:"approved",brief:{fullBodyTarget:12}
   }),
   getGameIdentity:async({appearanceId})=>({
     appearanceId,reviewedOfficialReservation:true,profileSha256:VALID
   }),
   submitGameTarget:async target=>{
     seen.push(target.appearanceId);
     const key=target.appearanceId+":"+target.slot;
     const old=database.get(key);database.set(key,target.targetCount);
     return {...target,status:old===target.targetCount?"unchanged":"recorded"};
   }
 });
 assert.equal(result.scope,"dynamic_official_list");
 assert.equal(result.scanned,22);
 assert.equal(result.synced,22);
 assert.equal(result.complete,true);
 assert.equal(database.get("AP12345:fullBody"),12);
 assert.equal(new Set(seen).size,22);
});
test("missing server enumerator is a blocking dependency, never a successful empty scan",async()=>{
 await assert.rejects(()=>synchronizeOfficialImageTargets({},{
   getOfficialReservation:async()=>null,
   getGameIdentity:async()=>null,
   submitGameTarget:async()=>null
 }),/official_character_list_action_not_exposed/);
});
test("does not invent a count for old APs when official reservation omits target",async()=>{
 const result=await synchronizeOfficialImageTargets({appearanceIds:["AP001","AP008","AP021"]},{
   getOfficialReservation:async({appearanceId})=>({
     appearanceId,status:"approved",brief:appearanceId==="AP008"?{fullBodyTarget:12}:{}
   }),
   getGameIdentity:async({appearanceId})=>({
     appearanceId,reviewedOfficialReservation:true,profileSha256:VALID
   }),
   submitGameTarget:async target=>({...target,status:"recorded"})
 });
 assert.equal(result.complete,false);
 assert.equal(result.synced,1);
 assert.equal(result.entries[0].status,"target_not_reported");
 assert.equal(result.entries[1].status,"synced");
 assert.equal(result.entries[2].status,"target_not_reported");
});
test("unverified game identity blocks only that AP; other IDs can continue",async()=>{
 const attempted=[];
 const result=await synchronizeOfficialImageTargets({appearanceIds:["AP008","AP009"]},{
   getOfficialReservation:async({appearanceId})=>({
     appearanceId,status:"approved",brief:{fullBodyTarget:12}
   }),
   getGameIdentity:async({appearanceId})=>appearanceId==="AP008"?null:{
     appearanceId,reviewedOfficialReservation:true,profileSha256:VALID
   },
   submitGameTarget:async target=>{attempted.push(target.appearanceId);return {...target,status:"recorded"};}
 });
 assert.equal(result.complete,false);
 assert.equal(result.blocked,1);
 assert.deepEqual(attempted,["AP009"]);
});
test("missing acknowledgement never claims registered target",async()=>{
 const result=await synchronizeOfficialImageTargets({appearanceIds:["AP008"]},{
   getOfficialReservation:async({appearanceId})=>({
     appearanceId,status:"approved",brief:{fullBodyTarget:12}
   }),
   getGameIdentity:async({appearanceId})=>({
     appearanceId,reviewedOfficialReservation:true,profileSha256:VALID
   }),
   submitGameTarget:async()=>({status:"failed"})
 });
 assert.equal(result.complete,false);
 assert.equal(result.entries[0].status,"sync_failed");
 assert.equal(result.entries[0].targetsRecorded,0);
});

test("privileged HTTPS transport reads canonical game metadata and records target",async()=>{
 const urls=[],body=[];
 const client=createGameTargetApiClient({
   gameApiOrigin:"https://nanal.example/",
   adminToken:"t".repeat(48),
   fetchFn:async (url,init)=>{
     urls.push(url);
     assert.equal(init.headers.authorization,"Bearer "+"t".repeat(48));
     assert.equal(init.redirect,"error");
     if(init.method==="PUT"){
       body.push(JSON.parse(init.body));
       return Response.json({appearanceId:"AP008",slot:"fullBody",targetCount:12,status:"recorded"});
     }
     return Response.json({appearanceId:"AP008",reviewedOfficialReservation:true,profileSha256:VALID});
   }
 });
 const id=await client.getGameIdentity({appearanceId:"AP008"});
 assert.equal(id.reviewedOfficialReservation,true);
 const result=await client.submitGameTarget({appearanceId:"AP008",slot:"fullBody",
   targetCount:12,source:"verified_official_reservation",profileSha256:VALID});
 assert.equal(result.status,"recorded");
 assert.equal(urls.length,2);
 assert.deepEqual(body,[{slot:"fullBody",targetCount:12,source:"verified_official_reservation",profileSha256:VALID}]);
});
test("target transport fails closed on insecure origin or invalid source",async()=>{
 assert.throws(()=>createGameTargetApiClient({
   gameApiOrigin:"http://nanal.example/",adminToken:"t".repeat(48)
 }),/trusted_https_game_origin_required/);
 const client=createGameTargetApiClient({
   gameApiOrigin:"https://nanal.example/",adminToken:"t".repeat(48),
   fetchFn:async()=>{throw Error("must not fetch");}
 });
 await assert.rejects(()=>client.submitGameTarget({appearanceId:"AP008",slot:"fullBody",
   targetCount:12,source:"unverified",profileSha256:VALID}),/invalid_verified_target/);
});

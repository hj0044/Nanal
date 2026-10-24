import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {compareAppearancePngs,describeAppearancePng,evaluateVisualConsistency} from "./visual-consistency.mjs";

async function sample({role="fullbody",x=280,y=120,width=420,height=1170,tint="#8c7862"}={}){
 const h=role==="fullbody"?1536:1024;
 if(role==="portrait"&&height>800)height=720;
 return sharp({create:{width:1024,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
  .composite([{input:{create:{width,height,channels:4,background:tint}},left:x,top:y}])
  .png().toBuffer();
}
const profile={heightCm:164,weightKg:50};
test("stable silhouette descriptor is reproducible, and never approves automatically",async()=>{
 const png=await sample();
 const a=await describeAppearancePng(png,"fullbody");
 const b=await describeAppearancePng(png,"fullbody");
 assert.deepEqual(a,b);
 assert.ok(a.bbox.height>0.6);
 assert.equal(a.upperImageDhash.length,64);
 const report=evaluateVisualConsistency(a,b,{appearanceId:"AP010",lockedProfile:profile});
 assert.equal(report.approved,false);
 assert.equal(report.automatedIdentityConfirmed,false);
 assert.ok(report.flags.includes("exact_original_duplicate"));
});
test("shifted or resized body silhouette is flagged for manual QA",async()=>{
 const ref=await sample();
 const candidate=await sample({height:780,width:290,y:410});
 const report=await compareAppearancePngs({referencePng:ref,candidatePng:candidate,
  role:"fullbody",appearanceId:"AP010",lockedProfile:profile});
 assert.equal(report.recommendedAction,"manual_review_priority");
 assert.ok(report.flags.includes("foreground_canvas_scale_differs"));
 assert.ok(report.evidence.foregroundScaleDelta>0.12);
});
test("image metrics never establish same face despite identical input",async()=>{
 const p=await sample({role:"portrait",x:270,y:100,width:460,height:640});
 const r=await compareAppearancePngs({referencePng:p,candidatePng:p,
   role:"portrait",appearanceId:"AP008",lockedProfile:profile});
 assert.equal(r.approved,false);
 assert.ok(r.limitations.some(x=>x.includes("NOT a face embedding")));
});
test("wrong slot, unsafe profile, or missing alpha is rejected",async()=>{
 const base=await sample();
 await assert.rejects(()=>describeAppearancePng(base,"portrait"),/canonical_RGBA_PNG_required/);
 const raw=await sharp({create:{width:1024,height:1536,channels:4,
  background:{r:80,g:80,b:80,alpha:1}}}).png().toBuffer();
 await assert.rejects(()=>describeAppearancePng(raw,"fullbody"),/transparent_background_missing/);
 const d=await describeAppearancePng(base,"fullbody");
 assert.throws(()=>evaluateVisualConsistency(d,d,{appearanceId:"../../",lockedProfile:profile}),/canonical_AP_ID_required/);
 assert.throws(()=>evaluateVisualConsistency(d,d,{appearanceId:"AP008"}),/locked_height_weight_profile_required/);
});

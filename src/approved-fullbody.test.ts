import { afterEach, describe, expect, it } from "vitest";
import {
  approvedFullBodiesForIdentity,
  clearApprovedFullBodyCacheForTest,
  importApprovedFullBodies
} from "./approved-fullbody";

afterEach(clearApprovedFullBodyCacheForTest);
const id1="12345678-1234-4234-9234-123456789abc";
const id2="22345678-1234-4234-9234-123456789abc";
const item=(id:string,appearance="AP008")=>({
  assetId:id,characterId:appearance,slot:"fullBody",
  status:"approved",runtimeEligible:true,imagePath:"/api/appearance/assets/"+id
});
describe("automatically approved full-body game delivery",()=>{
 it("never publishes unreviewed or externally hosted candidates",()=>{
  const accepted=importApprovedFullBodies({assets:[
    item(id1),
    {...item(id2),status:"awaiting_review"},
    {...item(id2),runtimeEligible:false},
    {...item(id2),imagePath:"https://evil.invalid/"+id2},
    {...item(id2),slot:"portrait"}
  ]});
  expect(accepted).toBe(1);
  expect(approvedFullBodiesForIdentity("AP008").map(r=>r.assetId)).toEqual([id1]);
 });
 it("supports all future AP IDs with no hardcoded roster or stale duplicates",()=>{
  expect(importApprovedFullBodies({assets:[item(id1,"AP008"),item(id2,"AP12345")]})).toBe(2);
  expect(importApprovedFullBodies({assets:[item(id2,"AP12345")]})).toBe(0);
  expect(approvedFullBodiesForIdentity("AP12345")).toHaveLength(1);
  expect(approvedFullBodiesForIdentity("AP008")).toHaveLength(1);
  expect(approvedFullBodiesForIdentity("AP_NOT_VALID")).toEqual([]);
 });
 it("rejects arbitrary URLs, IDs and catalog rows without server QA status",()=>{
  expect(importApprovedFullBodies({assets:[
    {...item(id1),status:"blocked"},
    {...item(id2),assetId:"../bad"},
    {...item(id2),characterId:"AP008/../"}
  ]})).toBe(0);
  expect(approvedFullBodiesForIdentity("AP008")).toHaveLength(0);
 });
});

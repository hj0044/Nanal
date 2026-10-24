import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAppearanceInventory,
  officialReservationTargetUpdates
} from "./appearance-inventory.ts";

const h = (char) => char.repeat(64);
const asset = (appearance_id, slot, status, file_sha256) =>
  ({ appearance_id, slot, status, file_sha256 });

test("AP001–AP020 and every future AP ID use the same inventory rules", () => {
  const identities = Array.from({length:20},(_,i) => ({
    appearance_id:"AP"+String(i+1).padStart(3,"0")
  }));
  identities.push({appearance_id:"AP021"},{appearance_id:"AP10000"});
  const inventory = buildAppearanceInventory(
    identities,
    [{appearance_id:"AP008",slot:"fullBody",target_count:12,
      source:"verified_official_reservation",profile_sha256:h("a"),updated_at:"2026-10-24"}],
    [asset("AP008","fullBody","approved",h("b")),
     asset("AP008","fullBody","awaiting_review",h("c")),
     asset("AP021","portrait","approved",h("d")),
     asset("AP10000","fullBody","blocked",h("e"))]
  );
  assert.equal(inventory.length,22);
  const old = inventory.find(v=>v.appearanceId==="AP001");
  const known = inventory.find(v=>v.appearanceId==="AP008");
  const future = inventory.find(v=>v.appearanceId==="AP10000");
  assert.equal(old.counts.fullBody.targetCount,null);
  assert.equal(old.counts.fullBody.remainingToApprove,null);
  assert.equal(known.counts.fullBody.targetCount,12);
  assert.equal(known.counts.fullBody.approved,1);
  assert.equal(known.counts.fullBody.awaitingReview,1);
  assert.equal(known.counts.fullBody.remainingToApprove,11);
  assert.equal(known.counts.fullBody.unfilledAfterPending,10);
  assert.equal(future.counts.fullBody.blocked,1);
  assert.equal(future.counts.fullBody.targetCount,null);
  assert.equal(future.source,"game_d1_r2");
});
test("same PNG content is counted once, prioritizing approved over pending/blocked", () => {
  const rows = buildAppearanceInventory(
    [{appearance_id:"AP008"}],
    [{appearance_id:"AP008",slot:"portrait",target_count:1,
      source:"explicit_owner_target",profile_sha256:h("f")}],
    [asset("AP008","portrait","blocked",h("b")),
     asset("AP008","portrait","awaiting_review",h("b")),
     asset("AP008","portrait","approved",h("b")),
     asset("AP008","portrait","approved",h("b")),
     asset("AP008","portrait","blocked",h("c")),
     asset("AP008","portrait","awaiting_review",h("d"))]
  );
  const row=rows[0].counts.portrait;
  assert.equal(row.approved,1);
  assert.equal(row.awaitingReview,1);
  assert.equal(row.blocked,1);
  assert.equal(row.totalUnique,3);
  assert.equal(row.remainingToApprove,0);
  assert.equal(row.approvedOverTarget,0);
});
test("invalid assets and unknown identities do not count toward any AP target", () => {
  const rows=buildAppearanceInventory([{appearance_id:"AP008"}, {appearance_id:"BAD"}],
    [{appearance_id:"AP008",slot:"fullBody",target_count:-1,source:"explicit_owner_target"},
     {appearance_id:"AP999",slot:"fullBody",target_count:5,source:"explicit_owner_target"}],
    [asset("AP008","fullBody","approved",h("a")),
     asset("AP008","fullBody","approved","invalid-sha"),
     asset("AP999","fullBody","approved",h("b"))]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].counts.fullBody.approved,1);
  assert.equal(rows[0].counts.fullBody.targetCount,null);
});
test("target overflow cannot become negative deficit", () => {
  const rows=buildAppearanceInventory(
    [{appearance_id:"AP008"}],
    [{appearance_id:"AP008",slot:"fullBody",target_count:0,source:"explicit_owner_target",profile_sha256:h("a")}],
    [asset("AP008","fullBody","approved",h("b"))]);
  assert.equal(rows[0].counts.fullBody.remainingToApprove,0);
  assert.equal(rows[0].counts.fullBody.approvedOverTarget,1);
});
test("only actual official reservation target fields are imported", () => {
  const reservation={appearanceId:"AP008",status:"approved",
    brief:{fullBodyTarget:12}};
  assert.deepEqual(officialReservationTargetUpdates(reservation),[
    {appearanceId:"AP008",slot:"fullBody",targetCount:12,source:"verified_official_reservation"}
  ]);
  assert.deepEqual(officialReservationTargetUpdates({
    appearanceId:"AP021",status:"queued",
    brief:{portraitTarget:3,fullBodyTarget:7}
  }),[
    {appearanceId:"AP021",slot:"fullBody",targetCount:7,source:"verified_official_reservation"},
    {appearanceId:"AP021",slot:"portrait",targetCount:3,source:"verified_official_reservation"}
  ]);
  assert.deepEqual(officialReservationTargetUpdates({
    appearanceId:"AP022",status:"approved",brief:{}
  }),[]);
  assert.deepEqual(officialReservationTargetUpdates({
    appearanceId:"AP023",status:"approved",brief:{fullBodyTarget:"12"}
  }),[]);
});

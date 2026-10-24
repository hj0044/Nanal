/** Dynamic AP inventory for the game-side D1/R2 store. No API/provider quotas. */
export type ImageSlot = "portrait" | "fullBody";
export type InventoryStatus = "awaiting_review" | "approved" | "blocked";
export type InventoryIdentity = { appearance_id: string };
export type InventoryTarget = {
  appearance_id: string;
  slot: ImageSlot;
  target_count: number;
  source: string;
  profile_sha256: string;
  updated_at?: string;
};
export type InventoryAsset = {
  appearance_id: string;
  slot: ImageSlot;
  status: InventoryStatus;
  file_sha256: string;
};
export type ImageCount = {
  slot: ImageSlot;
  targetCount: number | null;
  targetSource: string | null;
  targetUpdatedAt: string | null;
  approved: number;
  awaitingReview: number;
  blocked: number;
  totalUnique: number;
  remainingToApprove: number | null;
  approvedOverTarget: number | null;
  unfilledAfterPending: number | null;
};
export type AppearanceInventory = {
  appearanceId: string;
  source: "game_d1_r2";
  counts: { portrait: ImageCount; fullBody: ImageCount };
};

const VALID_ID = /^AP[0-9]{3,5}$/;
const HEX_64 = /^[a-f0-9]{64}$/i;
const slots: ImageSlot[] = ["portrait", "fullBody"];
const priorities: Record<InventoryStatus, number> = {
  blocked: 1, awaiting_review: 2, approved: 3
};

function newCount(slot: ImageSlot): ImageCount {
  return {
    slot, targetCount: null, targetSource: null, targetUpdatedAt: null,
    approved: 0, awaitingReview: 0, blocked: 0, totalUnique: 0,
    remainingToApprove: null, approvedOverTarget: null, unfilledAfterPending: null
  };
}

/**
 * Accepts every registered AP ID, not a hardcoded AP001–AP020 list.
 * Same-character/slot/image SHA duplicates count only once, with
 * approved > awaiting_review > blocked precedence. This is NOT a count of
 * official connector assets (independent database).
 *
 * Missing target is unknown (null), not zero and not a fabricated default.
 */
export function buildAppearanceInventory(
  identities: InventoryIdentity[],
  targets: InventoryTarget[],
  variants: InventoryAsset[]
): AppearanceInventory[] {
  const byId = new Map<string, AppearanceInventory>();
  for (const identity of identities) {
    const id = identity?.appearance_id;
    if (typeof id !== "string" || !VALID_ID.test(id)) continue;
    if (!byId.has(id)) byId.set(id, {
      appearanceId: id, source: "game_d1_r2",
      counts: { portrait: newCount("portrait"), fullBody: newCount("fullBody") }
    });
  }

  for (const row of targets) {
    const inv = byId.get(row?.appearance_id);
    if (!inv || !slots.includes(row.slot) ||
      !Number.isSafeInteger(row.target_count) || row.target_count < 0 ||
      row.target_count > 9999 ||
      !["verified_official_reservation","explicit_owner_target"].includes(row.source)) continue;
    const item = inv.counts[row.slot];
    item.targetCount = row.target_count;
    item.targetSource = row.source;
    item.targetUpdatedAt = row.updated_at ?? null;
  }

  const distinct = new Map<string, InventoryStatus>();
  for (const v of variants) {
    if (!byId.has(v?.appearance_id) || !slots.includes(v.slot) ||
        !Object.hasOwn(priorities, v.status) || !HEX_64.test(v.file_sha256 ?? "")) continue;
    const uniqueKey = v.appearance_id + "|" + v.slot + "|" + v.file_sha256.toLowerCase();
    const previous = distinct.get(uniqueKey);
    if (!previous || priorities[v.status] > priorities[previous])
      distinct.set(uniqueKey, v.status);
  }

  for (const [key, status] of distinct) {
    const [id, slot] = key.split("|") as [string, ImageSlot];
    const item = byId.get(id)!.counts[slot];
    if (status === "approved") item.approved += 1;
    else if (status === "awaiting_review") item.awaitingReview += 1;
    else item.blocked += 1;
    item.totalUnique += 1;
  }

  for (const inventory of byId.values()) {
    for (const slot of slots) {
      const item = inventory.counts[slot];
      if (item.targetCount === null) continue;
      item.remainingToApprove = Math.max(0, item.targetCount - item.approved);
      item.approvedOverTarget = Math.max(0, item.approved - item.targetCount);
      item.unfilledAfterPending = Math.max(0,
        item.targetCount - item.approved - item.awaitingReview);
    }
  }
  return [...byId.values()].sort((a,b) => a.appearanceId.localeCompare(b.appearanceId, "en"));
}

/**
 * Sync hint ONLY: the caller must have authenticated the official reservation.
 * No fabricated defaults. Existing target records remain intact when the
 * source does not provide a targetCount for a slot.
 */
export function officialReservationTargetUpdates(reservation: unknown): Array<{
  appearanceId: string; slot: ImageSlot; targetCount: number;
  source: "verified_official_reservation";
}> {
  if (!reservation || typeof reservation !== "object") return [];
  const r = reservation as Record<string, unknown>;
  const brief = (r.brief && typeof r.brief === "object") ? r.brief as Record<string, unknown> : null;
  const id = r.appearanceId;
  if (typeof id !== "string" || !VALID_ID.test(id) || !brief ||
      !["approved","queued","awaiting_review","blocked","failed"].includes(String(r.status))) return [];
  const updates: Array<{
    appearanceId: string; slot: ImageSlot; targetCount: number;
    source: "verified_official_reservation";
  }> = [];
  for (const [slot, key] of [["fullBody","fullBodyTarget"],["portrait","portraitTarget"]] as const) {
    const value = brief[key];
    if (Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 9999)
      updates.push({appearanceId:id,slot,targetCount:value as number,source:"verified_official_reservation"});
  }
  return updates;
}

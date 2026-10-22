import { describe, expect, it } from "vitest";
import {
  appearanceKey, changeAppearanceStyle, createAppearance, ensureAppearance, getApprovedCompositeUrl,
  type ApprovedCompositeAsset,
} from "./appearance";

describe("Nanal semi-real dual-view appearance contract", () => {
  const base = createAppearance(54321, "여성", 26, 166, 55);
  const key = appearanceKey(base);
  const shared = {
    faceId: base.identity.faceId, appearanceKey: key,
    artStyleVersion: "semi-real-v1" as const,
    sha256: "a".repeat(64), approved: true as const,
  };
  const bust: ApprovedCompositeAsset = {
    ...shared, assetId: "approved-bust", view: "bust", url: "https://cdn.example.org/approved/bust.webp",
  };
  const full: ApprovedCompositeAsset = {
    ...shared, assetId: "approved-full", view: "full", url: "https://cdn.example.org/approved/full.webp",
  };
  const catalog = { [bust.assetId]: bust, [full.assetId]: full };
  const refs = { bustCompositeId: bust.assetId, fullCompositeId: full.assetId };

  it("generates deterministic but game-seed-dependent identities", () => {
    expect(createAppearance(54321, "여성", 26, 166, 55)).toEqual(base);
    expect(createAppearance(54322, "여성", 26).identity.faceId).not.toBe(base.identity.faceId);
  });

  it("persists a saved face across reload and style changes", () => {
    const changed = changeAppearanceStyle(base, { hairStyleId: "hair-f-4", outfitId: "office-jacket" });
    expect(changed.identity).toEqual(base.identity);
    expect(base.style.outfitId).not.toBe("office-jacket");
    expect(ensureAppearance(changed, 123, "여성", 36)).toEqual(changed);
  });

  it("allows bust/full only with exact matching approved assets", () => {
    expect(getApprovedCompositeUrl(base, refs, "bust", catalog)).toBe(bust.url);
    expect(getApprovedCompositeUrl(base, refs, "full", catalog)).toBe(full.url);
    expect(getApprovedCompositeUrl(base, refs, "bust")).toBeNull();
    expect(getApprovedCompositeUrl(base, { fullCompositeId: full.assetId }, "bust", catalog)).toBeNull();
  });

  it("rejects a changed hairstyle, another face, another view and insecure URL", () => {
    const changed = changeAppearanceStyle(base, { hairStyleId: "hair-f-new" });
    expect(getApprovedCompositeUrl(changed, refs, "bust", catalog)).toBeNull();
    const otherFace = createAppearance(98765, "여성", 26);
    expect(getApprovedCompositeUrl(otherFace, refs, "bust", catalog)).toBeNull();
    expect(getApprovedCompositeUrl(base, { bustCompositeId: full.assetId }, "bust", catalog)).toBeNull();
    expect(getApprovedCompositeUrl(base, refs, "full", {
      ...catalog, [full.assetId]: { ...full, url: "http://example.org/full.webp" },
    })).toBeNull();
  });

  it("rejects missing approval evidence and never silently infers an image", () => {
    expect(getApprovedCompositeUrl(base, undefined, "full", catalog)).toBeNull();
    expect(getApprovedCompositeUrl(base, refs, "bust", {
      ...catalog, [bust.assetId]: { ...bust, sha256: "" },
    })).toBeNull();
    expect(getApprovedCompositeUrl(base, refs, "bust", {
      ...catalog, [bust.assetId]: { ...bust, approved: false as true },
    })).toBeNull();
  });

  it("uses age-appropriate cohorts, with bust and full sharing identity", () => {
    expect(createAppearance(1, "남성", 8).identity.baseAgeGroupId).toBe("child");
    expect(createAppearance(1, "남성", 70).identity.baseAgeGroupId).toBe("senior");
    expect(createAppearance(1, "남성", 25, 177, 51).identity.bodyTypeId).toBe("slim");
    expect(createAppearance(1, "남성", 25, 177, 100).identity.bodyTypeId).toBe("broad");
    expect(bust.faceId).toBe(full.faceId);
  });
});

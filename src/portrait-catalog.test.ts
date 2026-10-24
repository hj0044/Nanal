import { describe, expect, it } from "vitest";
import { getPortrait, portraitCatalog, trustedPortraitUrl, importApprovedRemoteCatalog } from "./portrait-catalog";

describe("approved portrait delivery", () => {
  it("rejects unknown or unreviewed artwork", () => {
    expect(getPortrait("AP999")).toBeUndefined();
    expect(portraitCatalog).toEqual([]);
  });
  it("accepts only HTTPS URLs inside configured ImageKit folder", () => {
    const base="https://ik.imagekit.io/example/nanal";
    expect(trustedPortraitUrl("https://ik.imagekit.io/example/nanal/AP017.jpg",base))
      .toBe("https://ik.imagekit.io/example/nanal/AP017.jpg");
    expect(trustedPortraitUrl("https://ik.imagekit.io/example/nanal-evil/other.jpg",base)).toBeUndefined();
    expect(trustedPortraitUrl("https://ik.imagekit.io.attacker.tld/example/nanal/AP017.jpg",base)).toBeUndefined();
    expect(trustedPortraitUrl("http://ik.imagekit.io/example/nanal/AP017.jpg",base)).toBeUndefined();
    expect(trustedPortraitUrl("https://ik.imagekit.io/example/nanal/AP017.jpg",undefined)).toBeUndefined();
  });

  it("only imports reviewed same-origin portrait assets", () => {
    const good="c4ac2f55-238c-41c2-9077-5ab44cf382a4";
    const bad="f3be4899-5e0a-4a1a-9d11-920d42170b99";
    const fields={ characterId:"AP008",gender:"여성",ageEstimate:{min:20,max:29},status:"approved",runtimeEligible:true };
    expect(importApprovedRemoteCatalog({assets:[
      {...fields,assetId:bad,slot:"fullBody",imagePath:"/api/appearance/assets/"+bad},
      {...fields,assetId:good,slot:"portrait",imagePath:"https://evil.invalid/"+good},
      {...fields,assetId:good,slot:"portrait",imagePath:"/api/appearance/assets/"+good}
    ]})).toBe(1);
    expect(getPortrait(good)?.imageUrl).toBe("/api/appearance/assets/"+good);
    expect(getPortrait(bad)).toBeUndefined();
  });
});

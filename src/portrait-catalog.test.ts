import { describe, expect, it } from "vitest";
import { getApprovedAppearanceSet, getPortrait, portraitCatalog, trustedPortraitUrl, importApprovedRemoteCatalog, importOfficialIdentityCatalog } from "./portrait-catalog";
import { fullBodyUrl } from "./portrait-image";

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
    ]})).toBe(2);
    expect(getPortrait(good)?.imageUrl).toBe("/api/appearance/assets/"+good);
    expect(getPortrait(bad)).toBeUndefined();
  });

  it("pairs only approved same-ID face/body and requires locked physical dimensions to render a body", () => {
    const portrait = "a4ac2f55-238c-41c2-9077-5ab44cf382a4";
    const body = "b4ac2f55-238c-41c2-9077-5ab44cf382a4";
    const wrong = "d4ac2f55-238c-41c2-9077-5ab44cf382a4";
    const asset = (assetId: string, characterId: string, slot: string, status = "approved", heightCm = 164) => ({ assetId, characterId, slot, status, runtimeEligible: true, gender: "여성", ageEstimate: { min: 20, max: 29 }, heightCm, weightKg: 52, imagePath: "/api/appearance/assets/" + assetId });
    importApprovedRemoteCatalog({ assets: [asset(body, "AP011", "fullBody"), asset(wrong, "AP012", "fullBody"), asset(portrait, "AP011", "portrait")] });
    expect(getApprovedAppearanceSet(portrait)?.fullBody?.id).toBe(body);
    expect(fullBodyUrl(portrait, 164, 52, 320)).toBe(`/api/appearance/assets/${body}?w=320`);
    expect(fullBodyUrl(portrait, 170, 52, 320)).toBeUndefined();
    expect(importApprovedRemoteCatalog({ assets: [asset("e4ac2f55-238c-41c2-9077-5ab44cf382a4", "AP011", "fullBody", "awaiting_review")] })).toBe(0);
    expect(getApprovedAppearanceSet(portrait)?.fullBody?.id).toBe(body);
  });
  it("keeps official AP IDs and rejects unapproved or foreign portrait paths", () => {
    const base={id:"AP043",gender:"female",ageBand:"30s",runtimeEligible:true,heightCm:165,weightKg:57};
    expect(importOfficialIdentityCatalog({identities:[
      {...base,id:"AP044",runtimeEligible:false,portrait:"assets/AP044_face.png"},
      {...base,id:"AP045",portrait:"https://other.example/AP045_face.png"},
      {...base,portrait:"assets/AP043_face.png"},
    ]})).toBe(1);
    expect(getPortrait("AP043")?.imageUrl).toBe("/assets/AP043_face.png");
    expect(getPortrait("AP044")).toBeUndefined();
    expect(importOfficialIdentityCatalog({identities:[{...base,portrait:"assets/AP043_face.png"}]})).toBe(0);
  });
});

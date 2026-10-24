import { describe, expect, it } from "vitest";
import { getPortrait, portraitCatalog, trustedPortraitUrl } from "./portrait-catalog";

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
});

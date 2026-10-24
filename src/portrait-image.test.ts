import { describe, expect, it } from "vitest";
import { portraitUrl } from "./portrait-image";

describe("portrait delivery", () => {
  it("never generates image requests for unknown or unapproved asset IDs", () => {
    expect(portraitUrl("AP999-portrait-001", 160)).toBeUndefined();
  });
});

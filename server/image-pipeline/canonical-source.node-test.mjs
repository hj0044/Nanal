import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  canonicalIdentitySha256,
  recoverCanonicalSource
} from "./canonical-source.mjs";

function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const content = Buffer.concat([Buffer.from(type), data]);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc(content));
  return Buffer.concat([len, content, check]);
}
function png(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.alloc(height * (1 + width * 4)))),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

function fixture() {
  const identity = {
    gender: "female", ageBand: "20s", heightCm: 162, weightKg: 49,
    bodyBuild: "balanced adult build", underbustCm: 70, bustCm: 87.5,
    deltaCm: 17.5, bustCup: "D", faceDesign: { id: "soft_square" }
  };
  const portrait = png(1024, 1024);
  const fullBody = png(1024, 1536);
  const portraitSha = sha(portrait), fullBodySha = sha(fullBody);
  const reservation = {
    appearanceId: "AP008", status: "approved", designVersion: "appearance-v3",
    brief: {
      gender: "female", ageBand: "20s", heightCm: 162, weightKg: 49,
      bustCup: "D", physique: { underbustCm: 70, bustCm: 87.5, deltaCm: 17.5 }
    },
    design: { faceDesign: { id: "soft_square" } },
    images: { portrait: "/api/appearance-files/p.png", fullBody: "/api/appearance-files/f.png" }
  };
  const pack = {
    appearanceId: "AP008", designVersion: "appearance-v3", identity,
    identitySha256: canonicalIdentitySha256(identity),
    portrait: {
      role: "portrait", assetId: "p", approved: true, sha256: portraitSha,
      sourcePath: reservation.images.portrait, png: portrait
    },
    fullBody: {
      role: "fullBody", assetId: "f", approved: true, sha256: fullBodySha,
      sourcePath: reservation.images.fullBody, png: fullBody
    },
    approvalEvidence: {
      appearanceId: "AP008",
      faceIdentityPass: true, heightScalePass: true,
      bodyProfilePass: true, chestSilhouettePass: true,
      referencePairIdentityPass: true,
      portraitSha256: portraitSha, fullBodySha256: fullBodySha,
      reviewer: "authorized-official-qa",
      reviewedAt: "2026-10-24T00:00:00Z",
      notes: "Both reference images were visually compared with the locked facial geometry and physique."
    }
  };
  return { reservation, pack };
}
const verify = async (_png, _role) => ({ width: 1024 });

test("recovery refuses fake image URLs and missing official read action", async () => {
  await assert.rejects(() => recoverCanonicalSource({ appearanceId: "AP008" }, {
    getReservation: async () => ({})
  }), /official_canonical_asset_read_action_not_exposed/);
  await assert.rejects(() => recoverCanonicalSource({ appearanceId: "../AP008" }), /valid_appearance_id_required/);
});
test("recovery requires locked identity and validated source bytes", async () => {
  const { reservation, pack } = fixture();
  const dir = await mkdtemp(path.join(os.tmpdir(), "nanal-canon-test-"));
  const adapters = {
    getReservation: async () => reservation,
    getCanonicalAssets: async () => pack,
    verifyPng: verify
  };
  try {
    const result = await recoverCanonicalSource({
      appearanceId: "AP008", privateRoot: dir
    }, adapters);
    assert.equal(result.status, "ready_for_same_identity_variant_generation");
    assert.equal(result.appearanceId, "AP008");
    assert.equal(sha(await readFile(result.portraitAnchor.privatePath)), pack.portrait.sha256);
    assert.equal(sha(await readFile(result.fullBodyAnchor.privatePath)), pack.fullBody.sha256);
    const again = await recoverCanonicalSource({
      appearanceId: "AP008", privateRoot: dir
    }, adapters);
    assert.deepEqual(again, result);
    assert.ok(result.fullBodyAnchor.privatePath.includes("canonical"));
    assert.ok(!("png" in result.fullBodyAnchor));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("AP identity drift cannot be treated as approved canonical reference", async () => {
  const { reservation, pack } = fixture();
  pack.identity.weightKg = 51;
  await assert.rejects(() => recoverCanonicalSource({ appearanceId: "AP008" }, {
    getReservation: async () => reservation,
    getCanonicalAssets: async () => pack,
    verifyPng: verify
  }), /canonical_profile_mismatch:weightKg/);
});
test("file checksum and source asset identity must match official reservation", async () => {
  const { reservation, pack } = fixture();
  pack.fullBody.sha256 = "f".repeat(64);
  await assert.rejects(() => recoverCanonicalSource({ appearanceId: "AP008" }, {
    getReservation: async () => reservation,
    getCanonicalAssets: async () => pack,
    verifyPng: verify
  }), /canonical_anchor_sha256_mismatch:fullBody/);
  pack.fullBody.sha256 = sha(pack.fullBody.png);
  pack.fullBody.sourcePath = "/api/appearance-files/untrusted.png";
  await assert.rejects(() => recoverCanonicalSource({ appearanceId: "AP008" }, {
    getReservation: async () => reservation,
    getCanonicalAssets: async () => pack,
    verifyPng: verify
  }), /canonical_anchor_bytes_unavailable:fullBody/);
});
test("approval flags alone cannot replace detailed visual evidence", async () => {
  const { reservation, pack } = fixture();
  pack.approvalEvidence.notes = "ok";
  await assert.rejects(() => recoverCanonicalSource({ appearanceId: "AP008" }, {
    getReservation: async () => reservation,
    getCanonicalAssets: async () => pack,
    verifyPng: verify
  }), /canonical_visual_qa_incomplete/);
});

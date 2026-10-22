/**
 * Nanal dual-view appearance data contract.
 *
 * This module contains NO AI inference and ships NO unapproved artwork.
 * Identity is separate from mutable styling and a finished image is used
 * only when the approved manifest validates that exact appearance.
 */
export type PortraitView = "bust" | "full";
export type PersonGender = "남성" | "여성";

export interface AppearanceIdentity {
  faceId: string;
  headShapeId: string;
  bodyTypeId: string;
  skinToneId: string;
  baseAgeGroupId: string;
}

export interface AppearanceStyle {
  hairStyleId: string;
  hairColorId: string;
  outfitId: string;
  accessoryIds: string[];
}

export interface AppearanceState {
  schemaVersion: 2;
  artStyleVersion: "semi-real-v1";
  identity: AppearanceIdentity;
  style: AppearanceStyle;
}

export interface PortraitAssetRef {
  bustCompositeId?: string;
  fullCompositeId?: string;
}

export interface ApprovedCompositeAsset {
  assetId: string;
  view: PortraitView;
  faceId: string;
  appearanceKey: string;
  artStyleVersion: AppearanceState["artStyleVersion"];
  url: string;
  sha256: string;
  approved: true;
}

/** No beta pictures are published by default. Add only human-reviewed art. */
export const approvedCompositeCatalog: Readonly<Record<string, ApprovedCompositeAsset>> = Object.freeze({});

function scramble(seed: number): number {
  let x = (seed >>> 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
function pickIndex(seed: number, count: number): number {
  return scramble(seed) % count;
}
function ageGroup(age: number): string {
  if (age < 13) return "child";
  if (age < 20) return "teen";
  if (age < 40) return "young-adult";
  if (age < 65) return "middle-age";
  return "senior";
}
function bodyType(heightCm?: number, weightKg?: number): string {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return "average";
  const bmi = weightKg / ((heightCm / 100) ** 2);
  return bmi < 19 ? "slim" : bmi >= 26 ? "broad" : "average";
}

/** Seed should be derived from game seed + stable person ID, never an array index alone. */
export function createAppearance(
  seed: number, gender: PersonGender, age: number, heightCm?: number, weightKg?: number,
): AppearanceState {
  const identityToken = scramble(seed ^ 0x1234567).toString(36);
  const genderKey = gender === "남성" ? "m" : "f";
  return {
    schemaVersion: 2,
    artStyleVersion: "semi-real-v1",
    identity: {
      // These are logical identities, NOT claims that finished faces exist.
      faceId: `identity-${genderKey}-${identityToken}`,
      headShapeId: `head-${genderKey}-${pickIndex(seed ^ 0x7654321, 3) + 1}`,
      bodyTypeId: bodyType(heightCm, weightKg),
      skinToneId: `skin-${pickIndex(seed ^ 0x13579, 4) + 1}`,
      baseAgeGroupId: ageGroup(age),
    },
    style: {
      hairStyleId: `hair-${genderKey}-${pickIndex(seed ^ 0x24680, 4) + 1}`,
      hairColorId: ["black", "dark-brown", "brown"][pickIndex(seed ^ 0x112233, 3)],
      outfitId: `outfit-${genderKey}-${pickIndex(seed ^ 0x445566, 4) + 1}`,
      accessoryIds: [],
    },
  };
}
export function ensureAppearance(
  current: AppearanceState | undefined,
  seed: number, gender: PersonGender, age: number, heightCm?: number, weightKg?: number,
): AppearanceState {
  // Do not regenerate saved identity on reload, NPC departure or reunion.
  if (current?.schemaVersion === 2 && current.artStyleVersion === "semi-real-v1"
    && current.identity?.faceId && current.style?.hairStyleId) return current;
  return createAppearance(seed, gender, age, heightCm, weightKg);
}

/** Immutable style change: a hairstyle or job change may never alter the face ID. */
export function changeAppearanceStyle(
  appearance: AppearanceState, changes: Partial<AppearanceStyle>,
): AppearanceState {
  return {
    ...appearance,
    identity: { ...appearance.identity },
    style: {
      ...appearance.style,
      ...changes,
      accessoryIds: changes.accessoryIds ? [...changes.accessoryIds] : [...appearance.style.accessoryIds],
    },
  };
}

/** Exact appearance key prevents showing the wrong hair/outfit under the same face. */
export function appearanceKey(appearance: AppearanceState): string {
  const i = appearance.identity, s = appearance.style;
  return [
    appearance.artStyleVersion, i.faceId, i.headShapeId, i.bodyTypeId,
    i.skinToneId, i.baseAgeGroupId, s.hairStyleId, s.hairColorId,
    s.outfitId, ...[...s.accessoryIds].sort(),
  ].join("|");
}

export function getApprovedCompositeUrl(
  appearance: AppearanceState | undefined, refs: PortraitAssetRef | undefined,
  view: PortraitView,
  catalog: Readonly<Record<string, ApprovedCompositeAsset>> = approvedCompositeCatalog,
): string | null {
  if (!appearance || !refs) return null;
  const assetId = view === "bust" ? refs.bustCompositeId : refs.fullCompositeId;
  if (!assetId) return null;
  const asset = catalog[assetId];
  if (!asset || asset.approved !== true || asset.assetId !== assetId) return null;
  if (asset.view !== view || asset.faceId !== appearance.identity.faceId) return null;
  if (asset.artStyleVersion !== appearance.artStyleVersion || asset.appearanceKey !== appearanceKey(appearance)) return null;
  if (!/^[a-f0-9]{64}$/i.test(asset.sha256)) return null;
  try {
    const parsed = new URL(asset.url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
  } catch { return null; }
  return asset.url;
}

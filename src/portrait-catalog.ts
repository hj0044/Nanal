import sourceManifest from "./assets/character-portraits/catalog.json";

export type PersonGender = "남성" | "여성";
export type PortraitAgeBand = string;

export interface PortraitRecord {
  id: string;
  characterId?: string;
  gender: PersonGender;
  age: number;
  ageMin: number;
  ageMax: number;
  ageBand: PortraitAgeBand;
  source: "single";
  filename?: string;
}

type SourceAsset = {
  assetId: string;
  characterId: string;
  gender: PersonGender;
  ageEstimate: { min: number; max: number };
  filename: string;
  runtimeEligible: boolean;
};

const imageUrls = import.meta.glob<string>("./assets/character-portraits/*.webp", {
  eager: true, query: "?url", import: "default",
});
const ageBand = (min: number, max: number) => `${min}–${max}세`;
const usedCharacterIds = new Set<string>();
const eligiblePortraits: PortraitRecord[] = (sourceManifest.assets as SourceAsset[])
  .filter((asset) => asset.runtimeEligible)
  .filter((asset) => imageUrls[`./assets/character-portraits/${asset.filename.split("/").pop()}`])
  .map((asset) => ({
    id: asset.assetId, characterId: asset.characterId, gender: asset.gender,
    age: Math.round((asset.ageEstimate.min + asset.ageEstimate.max) / 2),
    ageMin: asset.ageEstimate.min, ageMax: asset.ageEstimate.max,
    ageBand: ageBand(asset.ageEstimate.min, asset.ageEstimate.max),
    filename: asset.filename.split("/").pop(), source: "single",
  }));
export const portraitVariantCatalog: PortraitRecord[] = eligiblePortraits;
const individualPortraits: PortraitRecord[] = eligiblePortraits
  .filter((asset) => {
    const characterId = asset.characterId ?? asset.id;
    if (usedCharacterIds.has(characterId)) return false;
    usedCharacterIds.add(characterId);
    return true;
  });

// Only individually registered generated portraits enter new games. Legacy
// atlas IDs resolve to undefined and are reassigned while loading old saves.
export const portraitCatalog: PortraitRecord[] = [...individualPortraits];

export function getPortrait(id?: string): PortraitRecord | undefined {
  return portraitCatalog.find((portrait) => portrait.id === id);
}

/** Stable visual identity shared by approved alternate portraits of one person. */
export function getPortraitIdentityId(id?: string): string | undefined {
  const portrait = getPortrait(id);
  return portrait?.characterId ?? portrait?.id;
}

/** Resolve an approved same-person image for a new age stage, if the art pack has one. */
export function getPortraitAgeVariant(id: string | undefined, age: number): string | undefined {
  const current = getPortrait(id);
  if (!current?.characterId || (age >= current.ageMin && age <= current.ageMax)) return id;
  const options = portraitVariantCatalog
    .filter((portrait) => portrait.characterId === current.characterId && age >= portrait.ageMin && age <= portrait.ageMax)
    .sort((a, b) => Math.abs(a.age - age) - Math.abs(b.age - age));
  return options[0]?.id ?? id;
}

/** Age- and gender-matched faces, with identities already used in this save removed. */
export function getPortraitCandidates(gender: PersonGender, age: number, excludedIdentities: string[] = []): PortraitRecord[] {
  const excluded = new Set(excludedIdentities.map((id) => getPortraitIdentityId(id) ?? id));
  const pool = portraitCatalog.filter((portrait) =>
    portrait.gender === gender && !excluded.has(getPortraitIdentityId(portrait.id) ?? portrait.id),
  );
  const distance = (portrait: PortraitRecord) => age < portrait.ageMin ? portrait.ageMin - age : age > portrait.ageMax ? age - portrait.ageMax : 0;
  return pool.sort((a, b) => distance(a) - distance(b) || Math.abs(a.age - age) - Math.abs(b.age - age) || a.id.localeCompare(b.id));
}

// This is a public image-delivery URL, not an API key. The original assets remain available.
export function getImageKitPortraitUrl(endpoint: string | undefined, filename: string, directory = "nanal/portraits"): string | null {
  if (!endpoint?.trim()) return null;
  try {
    const base = new URL(endpoint.trim());
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) return null;
    const segments = [...directory.split("/"), filename].filter(Boolean);
    if (segments.some((segment) => segment === "." || segment === "..")) return null;
    return `${base.toString().replace(/\/+$/, "")}/${segments.map(encodeURIComponent).join("/")}`;
  } catch { return null; }
}

export function getPortraitFallbackImageUrl(id?: string): string {
  const portrait = getPortrait(id) ?? portraitCatalog[0];
  return imageUrls[`./assets/character-portraits/${portrait.filename}`] ?? "";
}

export function getPortraitImageUrl(id?: string): string {
  const portrait = getPortrait(id) ?? portraitCatalog[0];
  const filename = portrait.filename;
  return getImageKitPortraitUrl(
    import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT,
    filename ?? "",
    import.meta.env.VITE_IMAGEKIT_PORTRAIT_PATH || "nanal/portraits",
  ) ?? getPortraitFallbackImageUrl(id);
}

export function choosePortraitId(gender: PersonGender, age: number, seed: number, excluded: string[] = []): string {
  const available = getPortraitCandidates(gender, age, excluded);
  const pool = available.length ? available : portraitCatalog.filter((portrait) => portrait.gender === gender);
  const overlapping = pool.filter((portrait) => age >= portrait.ageMin && age <= portrait.ageMax);
  const candidates = overlapping.length ? overlapping : pool.filter((portrait) => {
    const distance = age < portrait.ageMin ? portrait.ageMin - age : age - portrait.ageMax;
    const nearest = Math.min(...pool.map((item) => age < item.ageMin ? item.ageMin - age : age > item.ageMax ? age - item.ageMax : 0));
    return distance === nearest;
  });
  // Mix the game seed before indexing so nearby seeds don't merely cycle by
  // the catalog length. This keeps assignment reproducible within a save while
  // making new-game seeds distribute portraits across the eligible pool.
  let mixed = (seed >>> 0) ^ 0x9e3779b9;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b);
  mixed = (mixed ^ (mixed >>> 16)) >>> 0;
  return candidates[mixed % candidates.length].id;
}

export function portraitPosition(_id?: string): string {
  return "center";
}

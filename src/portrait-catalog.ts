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
  imageUrl?: string;
}

type SourceAsset = {
  assetId: string;
  characterId: string;
  gender: PersonGender;
  ageEstimate: { min: number; max: number };
  filename: string;
  cdnUrl?: string;
  status?: string;
  runtimeEligible: boolean;
  role?: "portrait" | "fullbody";
};

const ageBand = (min: number, max: number) => `${min}–${max}세`;

// Only explicitly approved assets from our public ImageKit delivery path can be rendered.
// This does not grant asset approval or trust arbitrary user-provided URLs.
export function trustedPortraitUrl(url: string | undefined, endpoint: string | undefined): string | undefined {
  if (!url || !endpoint) return undefined;
  try {
    const asset = new URL(url);
    const trusted = new URL(endpoint);
    const prefix = trusted.pathname.replace(/\/+$/, "");
    return asset.protocol === "https:" && trusted.protocol === "https:" &&
      asset.origin === trusted.origin &&
      (asset.pathname === prefix || asset.pathname.startsWith(prefix + "/"))
      ? asset.href : undefined;
  } catch {
    return undefined;
  }
}
const imagekitEndpoint = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT as string | undefined;
// Only sourceManifest-approved metadata is eligible for display.
const eligiblePortraits: PortraitRecord[] = (sourceManifest.assets as unknown as SourceAsset[])
  .filter((asset) => asset.role !== "fullbody" && asset.status === "approved" && asset.runtimeEligible === true)
  .map((asset) => ({
    id: asset.assetId,
    characterId: asset.characterId,
    gender: asset.gender,
    age: Math.round((asset.ageEstimate.min + asset.ageEstimate.max) / 2),
    ageMin: asset.ageEstimate.min,
    ageMax: asset.ageEstimate.max,
    ageBand: ageBand(asset.ageEstimate.min, asset.ageEstimate.max),
    filename: asset.filename.split("/").pop(),
    imageUrl: trustedPortraitUrl(asset.cdnUrl, imagekitEndpoint),
    source: "single",
  }));

export const portraitVariantCatalog: PortraitRecord[] = eligiblePortraits;
const usedCharacterIds = new Set<string>();
export const portraitCatalog: PortraitRecord[] = eligiblePortraits.filter((asset) => {
  const characterId = asset.characterId ?? asset.id;
  if (usedCharacterIds.has(characterId)) return false;
  usedCharacterIds.add(characterId);
  return true;
});

/**
 * Import approved assets from the SAME-ORIGIN game asset API.
 * Never turn pending/blocked uploads into runtime artwork.
 */
export function importApprovedRemoteCatalog(payload: unknown): number {
  if (!payload || typeof payload !== "object" || !("assets" in payload)) return 0;
  const assets = (payload as { assets?: unknown }).assets;
  if (!Array.isArray(assets)) return 0;
  let added=0;
  for (const raw of assets) {
    if (!raw || typeof raw !== "object") continue;
    const a=raw as Record<string, unknown>;
    if (a.status!=="approved" || a.runtimeEligible!==true || a.slot!=="portrait" ||
        typeof a.assetId!=="string" || !/^[a-f0-9-]{36}$/.test(a.assetId) ||
        typeof a.characterId!=="string" || !/^AP\d{3,5}$/.test(a.characterId) ||
        (a.gender!=="남성" && a.gender!=="여성") ||
        typeof a.imagePath!=="string" || a.imagePath!=="/api/appearance/assets/"+a.assetId) continue;
    const ages=a.ageEstimate as {min?:unknown;max?:unknown}|undefined;
    if (!ages || typeof ages.min!=="number" || typeof ages.max!=="number" ||
        !Number.isInteger(ages.min) || !Number.isInteger(ages.max) ||
        ages.min<20 || ages.max>59 || ages.min>ages.max) continue;
    if (portraitVariantCatalog.some(p=>p.id===a.assetId)) continue;
    const item:PortraitRecord = {
      id:a.assetId,characterId:a.characterId,gender:a.gender,ageMin:ages.min,ageMax:ages.max,
      age:Math.round((ages.min+ages.max)/2),ageBand:ageBand(ages.min,ages.max),
      filename:a.assetId+".png",imageUrl:a.imagePath,source:"single"
    };
    portraitVariantCatalog.push(item);
    if (!portraitCatalog.some(p=>(p.characterId??p.id)===a.characterId)) portraitCatalog.push(item);
    added++;
  }
  return added;
}

export function getPortrait(id?: string): PortraitRecord | undefined {
  return portraitVariantCatalog.find((portrait) => portrait.id === id);
}

export function getPortraitIdentityId(id?: string): string | undefined {
  const portrait = getPortrait(id);
  return portrait?.characterId ?? portrait?.id;
}

export function getPortraitAgeVariant(id: string | undefined, age: number): string | undefined {
  const current = getPortrait(id);
  if (!current?.characterId || (age >= current.ageMin && age <= current.ageMax)) return id;
  const options = portraitVariantCatalog
    .filter((portrait) => portrait.characterId === current.characterId && age >= portrait.ageMin && age <= portrait.ageMax)
    .sort((a, b) => Math.abs(a.age - age) - Math.abs(b.age - age));
  return options[0]?.id ?? id;
}

export function getPortraitCandidates(gender: PersonGender, age: number, excludedIdentities: string[] = []): PortraitRecord[] {
  const excluded = new Set(excludedIdentities.map((id) => getPortraitIdentityId(id) ?? id));
  const pool = portraitCatalog.filter((portrait) =>
    portrait.gender === gender && !excluded.has(getPortraitIdentityId(portrait.id) ?? portrait.id),
  );
  const distance = (portrait: PortraitRecord) => age < portrait.ageMin ? portrait.ageMin - age : age > portrait.ageMax ? age - portrait.ageMax : 0;
  return pool.sort((a, b) => distance(a) - distance(b) || Math.abs(a.age - age) - Math.abs(b.age - age) || a.id.localeCompare(b.id));
}

export function choosePortraitId(gender: PersonGender, age: number, seed: number, excluded: string[] = []): string | undefined {
  const available = getPortraitCandidates(gender, age, excluded);
  if (!available.length) return undefined;
  let mixed = (seed >>> 0) ^ 0x9e3779b9;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b);
  mixed = (mixed ^ (mixed >>> 16)) >>> 0;
  const overlapping = available.filter((portrait) => age >= portrait.ageMin && age <= portrait.ageMax);
  const candidates = overlapping.length ? overlapping : available;
  return candidates[mixed % candidates.length].id;
}

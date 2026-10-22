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

const ageBand = (min: number, max: number) => `${min}–${max}세`;
// Keep portrait IDs as save metadata; no artwork is bundled or requested at runtime.
const eligiblePortraits: PortraitRecord[] = (sourceManifest.assets as unknown as SourceAsset[])
  .filter((asset) => asset.runtimeEligible)
  .map((asset) => ({
    id: asset.assetId,
    characterId: asset.characterId,
    gender: asset.gender,
    age: Math.round((asset.ageEstimate.min + asset.ageEstimate.max) / 2),
    ageMin: asset.ageEstimate.min,
    ageMax: asset.ageEstimate.max,
    ageBand: ageBand(asset.ageEstimate.min, asset.ageEstimate.max),
    filename: asset.filename.split("/").pop(),
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

export function getPortrait(id?: string): PortraitRecord | undefined {
  return portraitCatalog.find((portrait) => portrait.id === id);
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

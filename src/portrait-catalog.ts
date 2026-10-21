import atlasUrl from "./assets/npc-portrait-atlas-v1.webp";
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
  column?: number;
  row?: number;
  source: "atlas" | "single";
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
const atlasAges = [21, 23, 26, 28, 31, 33, 25, 29, 35, 37, 22, 24, 34, 38, 27, 30];
const atlasGenders: PersonGender[] = ["여성", "남성", "여성", "남성", "남성", "여성", "남성", "여성", "여성", "남성", "여성", "남성", "남성", "여성", "남성", "여성"];
const atlasPortraits: PortraitRecord[] = atlasAges.map((age, index) => ({
  id: `npc-${String(index + 1).padStart(2, "0")}`,
  gender: atlasGenders[index], age, ageMin: age, ageMax: age,
  ageBand: ageBand(Math.floor(age / 5) * 5, Math.floor(age / 5) * 5 + 4),
  column: index % 4, row: Math.floor(index / 4), source: "atlas",
}));
const usedCharacterIds = new Set<string>();
const individualPortraits: PortraitRecord[] = (sourceManifest.assets as SourceAsset[])
  .filter((asset) => asset.runtimeEligible && asset.ageEstimate.min <= 39 && asset.ageEstimate.max >= 20)
  .filter((asset) => imageUrls[`./assets/character-portraits/${asset.filename.split("/").pop()}`])
  .filter((asset) => {
    if (usedCharacterIds.has(asset.characterId)) return false;
    usedCharacterIds.add(asset.characterId);
    return true;
  })
  .map((asset) => ({
    id: asset.assetId, characterId: asset.characterId, gender: asset.gender,
    age: Math.round((asset.ageEstimate.min + asset.ageEstimate.max) / 2),
    ageMin: asset.ageEstimate.min, ageMax: asset.ageEstimate.max,
    ageBand: ageBand(asset.ageEstimate.min, asset.ageEstimate.max),
    filename: asset.filename.split("/").pop(), source: "single",
  }));

export const portraitCatalog: PortraitRecord[] = [...atlasPortraits, ...individualPortraits];

export function getPortrait(id?: string): PortraitRecord | undefined {
  return portraitCatalog.find((portrait) => portrait.id === id);
}

export function getPortraitImageUrl(id?: string): string {
  const portrait = getPortrait(id) ?? portraitCatalog[0];
  if (portrait.source === "atlas") return atlasUrl;
  return imageUrls[`./assets/character-portraits/${portrait.filename}`] ?? atlasUrl;
}

export function choosePortraitId(gender: PersonGender, age: number, seed: number, excluded: string[] = []): string {
  const available = portraitCatalog.filter((portrait) => portrait.gender === gender && !excluded.includes(portrait.id));
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

export function portraitPosition(id?: string): string {
  const portrait = getPortrait(id) ?? portraitCatalog[0];
  if (portrait.source === "single") return "center";
  return `${(portrait.column! / 3) * 100}% ${(portrait.row! / 3) * 100}%`;
}

export type PersonGender = "남성" | "여성";
export type PortraitAgeBand = "20–24세" | "25–29세" | "30–34세" | "35–39세";

export interface PortraitRecord {
  id: string;
  gender: PersonGender;
  age: number;
  ageBand: PortraitAgeBand;
  column: number;
  row: number;
}

const ages = [21, 23, 26, 28, 31, 33, 25, 29, 35, 37, 22, 24, 34, 38, 27, 30];
const genders: PersonGender[] = ["여성", "남성", "여성", "남성", "남성", "여성", "남성", "여성", "여성", "남성", "여성", "남성", "남성", "여성", "남성", "여성"];
export const portraitCatalog: PortraitRecord[] = ages.map((age, index) => ({
  id: `npc-${String(index + 1).padStart(2, "0")}`,
  gender: genders[index], age,
  ageBand: age < 25 ? "20–24세" : age < 30 ? "25–29세" : age < 35 ? "30–34세" : "35–39세",
  column: index % 4,
  row: Math.floor(index / 4),
}));

export function getPortrait(id?: string): PortraitRecord | undefined {
  return portraitCatalog.find((portrait) => portrait.id === id);
}

export function choosePortraitId(gender: PersonGender, age: number, seed: number, excluded: string[] = []): string {
  const available = portraitCatalog.filter((portrait) => portrait.gender === gender && !excluded.includes(portrait.id));
  const pool = available.length ? available : portraitCatalog.filter((portrait) => portrait.gender === gender);
  const nearestDistance = Math.min(...pool.map((portrait) => Math.abs(portrait.age - age)));
  const nearest = pool.filter((portrait) => Math.abs(portrait.age - age) === nearestDistance);
  return nearest[(seed >>> 0) % nearest.length].id;
}

export function portraitPosition(id?: string): string {
  const portrait = getPortrait(id) ?? portraitCatalog[0];
  return `${(portrait.column / 3) * 100}% ${(portrait.row / 3) * 100}%`;
}

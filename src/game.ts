export type Background = "student" | "jobseeker" | "worker";
export type Palette = "clean" | "warm" | "dark";
export type SensitiveTopic = "affair" | "illness" | "pregnancy";
export type Tab = "life" | "people" | "work" | "goals" | "record";

export interface Character {
  name: string;
  age: number;
  year: number;
  background: Background;
  gender: "남성" | "여성";
  region: string;
  housing: string;
  education?: string;
  family?: string;
  startingMoney?: number;
}
export interface Stats {
  money: number;
  energy: number;
  stress: number;
  mood: number;
  focus: number;
}
export interface Contact {
  id: string;
  name: string;
  role: string;
  gender?: "남성" | "여성";
  age?: number;
  occupation?: string;
  personality?: string;
  goal?: string;
  warmth: number;
  note: string;
}
export interface Effect {
  money?: number;
  energy?: number;
  stress?: number;
  mood?: number;
  focus?: number;
  relationship?: number;
}
export interface EventChoice {
  id: string;
  title: string;
  detail: string;
  result: string;
  effect: Effect;
  contactIndex?: number;
}
export interface LifeEvent {
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  topic?: SensitiveTopic;
  choices: EventChoice[];
}
export interface GameState {
  version: 1;
  character: Character;
  week: number;
  day: number;
  phase: "playing" | "event" | "summary";
  seed: number;
  evaluatedDays: number[];
  seenEvents: string[];
  recentEventIds?: string[];
  stats: Stats;
  contacts: Contact[];
  log: string[];
  pendingEvent?: LifeEvent;
  lastChoice?: string;
  settings: {
    palette: Palette;
    nightMode: "off" | "device" | "schedule";
    nightStart: string;
    nightEnd: string;
    topics: Record<SensitiveTopic, boolean>;
  };
}
export interface CharacterDraft {
  name: string;
  age: number | "";
  year: number | "";
  background: Background | "";
  gender: "남성" | "여성" | "";
  region: string;
  housing: string;
  education: string;
  family: string;
  startingMoney: string;
}

export const backgroundLabels: Record<Background, string> = {
  student: "대학생",
  jobseeker: "취업준비생",
  worker: "직장인",
};

import { eventLibrary } from "./scenarios";

const firstNames = ["지우", "서준", "하은", "민재", "수빈", "도윤", "예린", "현우", "유진", "지민", "은서", "준호", "채원", "시우", "다은", "건우", "소연", "태민", "나연", "우진"];
const roles: Record<Background, string[]> = {
  student: ["같은 수업을 듣는 동기", "오래 알고 지낸 친구", "가족", "동아리 선배", "수업 팀원", "아르바이트 동료", "고등학교 친구", "학과 지인", "사촌", "스터디 구성원", "이웃", "온라인으로 알게 된 지인"],
  jobseeker: ["관심 분야를 아는 선배", "오래 알고 지낸 친구", "가족", "스터디 구성원", "이전 아르바이트 동료", "학교 선배", "친척", "취업 커뮤니티 지인", "동네 친구", "교육 과정 동기", "예전 직장 동료", "소개로 알게 된 지인"],
  worker: ["같은 팀 동료", "오래 알고 지낸 친구", "가족", "직장 선배", "이전 직장 동료", "학교 친구", "친척", "취미 모임 지인", "이웃", "업무 협력자", "동기", "소개로 알게 된 지인"],
};
const surnames = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"];
const traits = ["차분하고 신중한", "활발하고 솔직한", "다정하고 세심한", "현실적이고 믿음직한", "호기심 많고 낙천적인", "조용하지만 끈기 있는"];
const goals = ["관심 분야에서 자기 길 찾기", "일과 휴식의 균형 맞추기", "경제적으로 조금 더 독립하기", "오래 갈 관계를 만들어가기", "새로운 경험과 기회 넓히기", "꾸준히 실력을 쌓아가기"];
const occupations: Record<Background, string[]> = {
  student: ["대학생", "카페 아르바이트", "취업 준비 중", "대학원생", "프리랜서", "사무직", "서비스직"],
  jobseeker: ["취업 준비 중", "사무직", "서비스직", "프리랜서", "대학원생", "기술직", "창업 준비 중"],
  worker: ["사무직", "서비스직", "기술직", "프리랜서", "자영업", "공공기관 근무", "대학원생"],
};

export function createSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}
function nextRandom(state: number): [number, number] {
  let x = state || 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0;
  return [next, next / 4294967296];
}
export function generateContacts(background: Background, seed: number, playerAge = 24): Contact[] {
  let state = seed;
  return roles[background].map((role, i) => {
    const [next, value] = nextRandom(state + i + 1);
    const [afterName, nameRoll] = nextRandom(next);
    const [, genderRoll] = nextRandom(afterName);
    const [afterTrait, traitRoll] = nextRandom(afterName + 101);
    const [afterGoal, goalRoll] = nextRandom(afterTrait + 211);
    const [afterJob, jobRoll] = nextRandom(afterGoal + 307);
    const [, ageRoll] = nextRandom(afterJob + 401);
    state = next;
    const name = `${surnames[Math.floor(value * surnames.length)]}${firstNames[Math.floor(nameRoll * firstNames.length)]}`;
    const family = /가족|사촌|친척/.test(role);
    const senior = /선배|부모|가족|친척/.test(role);
    return { id: `person-${i + 1}`, name, role, gender: genderRoll < 0.5 ? "여성" : "남성", age: Math.max(19, playerAge + (family ? 10 : senior ? 3 : -2) + Math.floor(ageRoll * 7)), occupation: occupations[background][Math.floor(jobRoll * occupations[background].length)], personality: traits[Math.floor(traitRoll * traits.length)], goal: goals[Math.floor(goalRoll * goals.length)], warmth: 46 + Math.floor(value * 23), note: i < 2 ? "최근 연락이 이어지고 있다" : "아직 자세히 알지 못한다" };
  });
}
export function createGame(character: Character, seed = createSeed(`${character.name}:${character.year}:${character.age}:${character.background}`)): GameState {
  const money = character.startingMoney ?? (character.background === "student" ? 420_000 : character.background === "jobseeker" ? 650_000 : 1_850_000);
  return {
    version: 1, character, week: 1, day: 1, phase: "playing", seed,
    evaluatedDays: [], seenEvents: [],
    stats: { money, energy: 72, stress: 24, mood: 61, focus: 52 },
    contacts: generateContacts(character.background, seed, character.age),
    log: [`${character.year}년, ${character.name}의 새로운 생활이 시작됐다.`],
    settings: { palette: "clean", nightMode: "device", nightStart: "21:00", nightEnd: "07:00", topics: { affair: true, illness: true, pregnancy: true } },
  };
}
function clamp(value: number, min = 0, max = 100): number { return Math.max(min, Math.min(max, value)); }
function nextEligibleEvent(state: GameState): [LifeEvent | undefined, number] {
  const recent = state.recentEventIds ?? [];
  const eligible = eventLibrary[state.character.background].filter((event) => !state.seenEvents.includes(event.id) && (!event.topic || state.settings.topics[event.topic]));
  const cooled = eligible.filter((event) => !recent.includes(event.id));
  const options = cooled.length ? cooled : eligible;
  const [afterRoll, roll] = nextRandom(state.seed);
  if (!options.length) return [undefined, afterRoll];
  const chance = 0.33 + Math.max(0, state.stats.stress - 30) / 300;
  if (roll > Math.min(chance, 0.58)) return [undefined, afterRoll];
  const [afterSelect, indexRoll] = nextRandom(afterRoll);
  return [options[Math.floor(indexRoll * options.length)], afterSelect];
}
export function advanceDay(state: GameState): GameState {
  if (state.phase !== "playing") return state;
  let next = { ...state, evaluatedDays: [...state.evaluatedDays], seenEvents: [...state.seenEvents], log: [...state.log] };
  if (!next.evaluatedDays.includes(next.day)) {
    next.evaluatedDays.push(next.day);
    const [event, nextSeed] = nextEligibleEvent(next);
    next.seed = nextSeed;
    if (event) {
      next.phase = "event";
      next.pendingEvent = event;
      next.log.unshift(`${next.week}주차 ${next.day}일 · ${event.eyebrow} 상황이 생겼다.`);
      return next;
    }
  }
  next.log.unshift(`${next.week}주차 ${next.day}일 · 큰 일정 없이 하루를 보냈다.`);
  if (next.day >= 7) {
    next.phase = "summary";
    return next;
  }
  next.day += 1;
  return next;
}
export function advanceDays(state: GameState, days: 1 | 3 | 7): GameState {
  let next = state;
  for (let i = 0; i < days && next.phase === "playing"; i += 1) {
    next = advanceDay(next);
    if (next.phase !== "playing") break;
  }
  return next;
}
export function chooseEvent(state: GameState, choiceId: string): GameState {
  if (state.phase !== "event" || !state.pendingEvent) return state;
  const choice = state.pendingEvent.choices.find((item) => item.id === choiceId);
  if (!choice) return state;
  const effect = choice.effect;
  const next: GameState = {
    ...state,
    phase: "playing",
    pendingEvent: undefined,
    lastChoice: choice.result,
    seenEvents: [...state.seenEvents, state.pendingEvent.id],
    recentEventIds: [...(state.recentEventIds ?? []), state.pendingEvent.id].slice(-3),
    stats: {
      money: Math.max(0, state.stats.money + (effect.money ?? 0)),
      energy: clamp(state.stats.energy + (effect.energy ?? 0)),
      stress: clamp(state.stats.stress + (effect.stress ?? 0)),
      mood: clamp(state.stats.mood + (effect.mood ?? 0)),
      focus: clamp(state.stats.focus + (effect.focus ?? 0)),
    },
    contacts: state.contacts.map((contact, index) => index === choice.contactIndex && effect.relationship ? {
      ...contact, warmth: clamp(contact.warmth + effect.relationship), note: "최근 함께한 선택을 기억하고 있다",
    } : contact),
    log: [choice.result, ...state.log],
  };
  return next;
}
export function startNextWeek(state: GameState): GameState {
  if (state.phase !== "summary") return state;
  return {
    ...state, week: state.week + 1, day: 1, phase: "playing",
    evaluatedDays: [], seenEvents: [], lastChoice: undefined,
    stats: { ...state.stats, energy: clamp(state.stats.energy + 12), stress: clamp(state.stats.stress - 7) },
    log: [`${state.week + 1}주차가 시작됐다. 지난주의 경험이 생활에 남아 있다.`, ...state.log],
  };
}
export function setPalette(state: GameState, palette: Palette): GameState {
  return { ...state, settings: { ...state.settings, palette } };
}

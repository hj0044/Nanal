export type Background = "student" | "jobseeker" | "worker";
export type Palette = "clean" | "warm" | "dark";
export type SensitiveTopic = "affair" | "illness" | "pregnancy";
export type Tab = "life" | "people" | "work" | "goals" | "record";
export type DailyAction = "focus" | "rest" | "social" | "organize";

export interface Character {
  name: string;
  age: number;
  year: number;
  background: Background;
  gender: "남성" | "여성";
  heightCm?: number;
  weightKg?: number;
  affiliation?: string;
  portraitId?: string;
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
export interface NPCMemory {
  id: string;
  text: string;
  week: number;
  vividness: number;
}
export interface WeeklyCashflow {
  week: number;
  income: number;
  expenses: number;
  unpaidExpenses: number;
  endingBalance: number;
}
export interface WeeklyCashflowPlan {
  income: number;
  livingExpenses: number;
  housingExpenses: number;
  expenses: number;
  net: number;
  incomeLabel: string;
  expenseLabel: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  gender?: "남성" | "여성";
  age?: number;
  heightCm?: number;
  weightKg?: number;
  affiliation?: string;
  portraitId?: string;
  portraitAgeBand?: import("./portrait-catalog").PortraitAgeBand;
  occupation?: string;
  personality?: string;
  goal?: string;
  goalProgress?: number;
  goalSupport?: number;
  goalStage?: string;
  mood?: string;
  lastAutonomousAction?: string;
  memories?: NPCMemory[];
  warmth: number;
  note: string;
  firstMetWeek?: number;
  lastInteractionWeek?: number;
  archivedWeek?: number;
  returnCount?: number;
}
export interface NPCRelationship {
  id: string;
  contactAId: string;
  contactBId: string;
  warmth: number;
  kind: "family" | "friend" | "work" | "acquaintance";
  lastInteractionWeek?: number;
}
export interface RelationshipRecord { id: string; week: number; kind: "arrival" | "drift" | "departure" | "reunion" | "memory"; contactId: string; contactName: string; text: string }
export interface Effect {
  money?: number;
  energy?: number;
  stress?: number;
  mood?: number;
  focus?: number;
  relationship?: number;
  goalSupport?: number;
  /** Adds a chance to meet someone through the selected event. */
  newContactOpportunity?: number;
}
export interface EventChoice {
  id: string;
  title: string;
  detail: string;
  result: string;
  effect: Effect;
  contactIndex?: number;
  meetingContext?: string;
}
export interface LifeEvent {
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  topic?: SensitiveTopic;
  personalStory?: { contactId: string; stage: number };
  reunion?: { contactId: string };
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
  actionDays?: string[];
  weeklyActions?: Partial<Record<DailyAction, number>>;
  weeklyMeetingMomentum?: number;
  weeklyMeetingContext?: string;
  npcReunionIds?: string[];
  seenEvents: string[];
  recentEventIds?: string[];
  eventLastSeenWeek?: Record<string, number>;
  npcStoryStages?: Record<string, number>;
  npcStoryLastWeek?: Record<string, number>;
  npcStoryChoices?: Record<string, string>;
  weeklyCashflow?: WeeklyCashflow;
  stats: Stats;
  contacts: Contact[];
  archivedContacts?: Contact[];
  relationshipRecords?: RelationshipRecord[];
  npcRelationships?: NPCRelationship[];
  nextContactNumber?: number;
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
  heightCm: number | "";
  weightKg: number | "";
  affiliation: string;
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

export function generateBodyMetrics(gender: Character["gender"], seed: number, heightOverride?: number): { heightCm: number; weightKg: number } {
  const [, heightRoll] = nextRandom(seed ^ createSeed("height"));
  const [, bmiRoll] = nextRandom(seed ^ createSeed("bmi"));
  const heightCm = heightOverride ?? Math.round((gender === "남성" ? 174 : 162) + (heightRoll - 0.5) * 18);
  const bmi = 19 + bmiRoll * 7;
  return { heightCm, weightKg: Math.round(bmi * (heightCm / 100) ** 2) };
}

export function getPlayerAffiliation(character: Character): string {
  if (character.affiliation?.trim()) return character.affiliation.trim();
  if (character.background === "student") return character.education ? `${character.education} · 학교명 미입력` : "대학생 · 학교명 미입력";
  if (character.background === "jobseeker") return character.education ? `${character.education} · 취업 준비 중` : "취업 준비 중 · 희망 분야 탐색";
  return character.education ? `${character.education} · 회사명 미입력` : "직장인 · 회사·부서 미입력";
}

export function getContactAffiliation(role: string, background: Background): string {
  if (/가족|사촌|친척|부모|형제|자매/.test(role)) return "가족";
  if (/이웃/.test(role)) return "동네 생활권";
  if (/동료|직장|업무|팀원|협력자/.test(role)) return "직장 · 업무 관계";
  if (/수업|학과|학교|동아리|대학/.test(role)) return "학교 · 학업 관계";
  if (/스터디|취업|교육 과정|커뮤니티/.test(role)) return "취업 준비 · 학습 모임";
  if (/온라인/.test(role)) return "온라인 커뮤니티";
  if (/취미|모임/.test(role)) return "취미 모임";
  if (/소개/.test(role)) return "지인 소개";
  if (/친구/.test(role)) return "오래된 개인적 인연";
  return background === "student" ? "학교·생활권 인맥" : background === "jobseeker" ? "구직 활동 인맥" : "직장 밖 인맥";
}

import { commonEventLibrary, eventLibrary } from "./scenarios";
import { choosePortraitId, getPortrait } from "./portrait-catalog";

// Keep generated names aligned with the character's selected gender. Korean names
// can be unisex, so these pools favor names commonly associated with each gender.
const firstNamesByGender: Record<Character["gender"], string[]> = {
  여성: ["하은", "예린", "은서", "채원", "다은", "소연", "나연", "서윤", "예진", "유나", "하린", "수아", "지은", "수빈", "아린", "민서", "지원", "다현", "지민", "윤서", "서현", "유진", "혜원", "시은", "보민", "가은", "예원", "수민", "주연", "현지", "다영", "나은", "연우", "채은"],
  남성: ["서준", "민준", "도윤", "현우", "준호", "건우", "태민", "우진", "시우", "민재", "도현", "지훈", "준서", "정우", "승현", "재현", "성민", "동현", "윤호", "시원", "주원", "현준", "민성", "진우", "성현", "유찬", "태윤", "승우", "재민", "정민", "준영", "도훈", "은우"],
};
const roles: Record<Background, string[]> = {
  student: ["같은 수업을 듣는 동기", "오래 알고 지낸 친구", "가족", "동아리 선배", "수업 팀원", "아르바이트 동료", "고등학교 친구", "학과 지인", "사촌", "스터디 구성원", "이웃", "온라인으로 알게 된 지인", "교양 수업에서 만난 친구", "학생회에서 함께 일하는 사람", "동아리 신입 회원", "기숙사 룸메이트", "과외 선생님", "단골 카페 아르바이트생", "친구의 친구", "운동 모임 지인", "같은 프로젝트 팀원", "도서관에서 알게 된 사람", "교환학생 친구", "학과 조교", "예전 학원 친구", "동네에서 자주 마주치는 사람", "봉사활동 동료", "온라인 게임 친구", "선배의 소개로 만난 사람", "가족의 지인"],
  jobseeker: ["관심 분야를 아는 선배", "오래 알고 지낸 친구", "가족", "스터디 구성원", "이전 아르바이트 동료", "학교 선배", "친척", "취업 커뮤니티 지인", "동네 친구", "교육 과정 동기", "예전 직장 동료", "소개로 알게 된 지인", "자격증 스터디 동료", "취업 박람회에서 만난 사람", "같은 분야 지원자", "현직자 멘토", "온라인 커뮤니티 운영진", "직업훈련 과정 친구", "면접에서 알게 된 지원자", "단기 프로젝트 동료", "동네 아르바이트 동료", "친구의 직장 선배", "예전 대학 팀원", "봉사활동 지인", "취미 모임 친구", "헤드헌터 소개 인맥", "창업 준비 모임 지인", "가족의 친구", "이전 직장 선배", "스터디 카페 단골"],
  worker: ["같은 팀 동료", "오래 알고 지낸 친구", "가족", "직장 선배", "이전 직장 동료", "학교 친구", "친척", "취미 모임 지인", "이웃", "업무 협력자", "동기", "소개로 알게 된 지인", "다른 팀 협업자", "신입사원 동료", "거래처 담당자", "업계 모임에서 만난 사람", "직장 동료의 친구", "점심 모임 동료", "예전 프로젝트 파트너", "동네 운동 친구", "동호회 운영진", "단골 가게 사장님", "전 직장 후배", "대학원 동기", "멘토링 모임 지인", "온라인 커뮤니티 친구", "가족의 지인", "동네 이웃", "회사 근처 카페 단골", "친구의 직장 동료"],
};
const surnames = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"];
const allGeneratedFirstNames = new Set(Object.values(firstNamesByGender).flat());
const oppositeGenderNames: Record<Character["gender"], Set<string>> = {
  여성: new Set(firstNamesByGender.남성),
  남성: new Set(firstNamesByGender.여성),
};
const traits = ["차분하고 신중한", "활발하고 솔직한", "다정하고 세심한", "현실적이고 믿음직한", "호기심 많고 낙천적인", "조용하지만 끈기 있는", "낯은 가리지만 마음을 잘 쓰는", "경쟁심이 강하고 추진력 있는", "계획적이고 책임감 있는", "즉흥적이고 유쾌한", "독립적이고 자기 주관이 뚜렷한", "공감은 빠르지만 걱정이 많은", "말수는 적어도 관찰력이 좋은", "사교적이지만 혼자만의 시간도 중시하는", "완벽을 추구하지만 쉽게 지치는", "새로운 사람에게 먼저 다가가는"];
const goals = ["관심 분야에서 자기 길 찾기", "일과 휴식의 균형 맞추기", "경제적으로 조금 더 독립하기", "오래 갈 관계를 만들어가기", "새로운 경험과 기회 넓히기", "꾸준히 실력을 쌓아가기", "가족과 보내는 시간을 늘리기", "지금 사는 곳에서 내 기반 만들기", "미뤄둔 공부나 자격증 끝내기", "건강한 생활 리듬 되찾기", "작은 창작물을 세상에 내놓기", "믿고 의지할 사람을 만들기", "빚이나 생활비 부담 줄이기", "일에서 인정받고 다음 단계로 가기", "오래 품은 여행 계획 실현하기", "좋아하는 취미를 꾸준히 이어가기", "새로운 직무나 진로에 도전하기", "주변 사람과 오래된 오해 풀기", "나만의 집이나 작업 공간 마련하기", "실패해도 다시 시도할 용기 얻기"];
const occupations: Record<Background, string[]> = {
  student: ["대학생", "카페 아르바이트", "취업 준비 중", "대학원생", "프리랜서", "사무직", "서비스직", "과외 강사", "연구 보조원", "디자인 외주 작업자", "편의점 아르바이트", "콘텐츠 제작자", "배달 플랫폼 종사자", "휴학 중", "창업 동아리 활동 중"],
  jobseeker: ["취업 준비 중", "사무직", "서비스직", "프리랜서", "대학원생", "기술직", "창업 준비 중", "자격증 공부 중", "단기 계약직", "직업훈련생", "콘텐츠 제작자", "과외 강사", "플랫폼 노동자", "인턴", "가족 사업 보조"],
  worker: ["사무직", "서비스직", "기술직", "프리랜서", "자영업", "공공기관 근무", "대학원생", "교육·강의직", "의료·복지직", "현장직", "디자이너", "콘텐츠 제작자", "소규모 사업 운영", "계약직", "육아·가사와 일 병행"],
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
export function generateName(gender: Character["gender"], seed: number): string {
  const [, surnameRoll] = nextRandom(seed);
  const [, firstNameRoll] = nextRandom(seed ^ 0x9e3779b9);
  const firstNames = firstNamesByGender[gender];
  return `${surnames[Math.floor(surnameRoll * surnames.length)]}${firstNames[Math.floor(firstNameRoll * firstNames.length)]}`;
}
export function normalizeContactName(name: string, gender: Character["gender"], seed: number): string {
  const givenName = name.slice(-2);
  if (!allGeneratedFirstNames.has(givenName) || !oppositeGenderNames[gender].has(givenName)) return name;
  return `${name.slice(0, -2)}${firstNamesByGender[gender][seed % firstNamesByGender[gender].length]}`;
}
export function generateContacts(background: Background, seed: number, playerAge = 24, excludedPortraitIds: string[] = [], excludedNames: string[] = []): Contact[] {
  let state = seed;
  const usedPortraits = [...excludedPortraitIds];
  const anchors = [roles[background][0], roles[background][1], roles[background][2]];
  const variedRoles = roles[background]
    .filter((role) => !anchors.includes(role))
    .sort((a, b) => createSeed(`${seed}:role:${a}`) - createSeed(`${seed}:role:${b}`));
  const selectedRoles = [...anchors, ...variedRoles.slice(0, 9)];
  const usedNames = new Set(excludedNames);
  return selectedRoles.map((role, i) => {
    const [next, value] = nextRandom(state + i + 1);
    const [afterName] = nextRandom(next);
    const [, genderRoll] = nextRandom(afterName);
    const [afterTrait, traitRoll] = nextRandom(afterName + 101);
    const [afterGoal, goalRoll] = nextRandom(afterTrait + 211);
    const [afterJob, jobRoll] = nextRandom(afterGoal + 307);
    const [, ageRoll] = nextRandom(afterJob + 401);
    state = next;
    const gender = genderRoll < 0.5 ? "여성" : "남성";
    let name = generateName(gender, afterName);
    for (let attempt = 0; usedNames.has(name) && attempt < firstNamesByGender[gender].length; attempt += 1) {
      const surnameIndex = (Math.floor(nextRandom(afterName)[1] * surnames.length) + attempt + 1) % surnames.length;
      const firstIndex = (afterName + attempt + 1) % firstNamesByGender[gender].length;
      name = `${surnames[surnameIndex]}${firstNamesByGender[gender][firstIndex]}`;
    }
    usedNames.add(name);
    const family = /가족|사촌|친척/.test(role);
    const senior = /선배|부모|가족|친척/.test(role);
    const age = Math.max(19, playerAge + (family ? 10 : senior ? 3 : -2) + Math.floor(ageRoll * 7));
    const portraitId = choosePortraitId(gender, age, next, usedPortraits);
    usedPortraits.push(portraitId);
    const body = generateBodyMetrics(gender, next ^ createSeed(`${role}:${age}`));
    return { id: `person-${i + 1}`, name, role, gender, age, ...body, affiliation: getContactAffiliation(role, background), portraitId, portraitAgeBand: getPortrait(portraitId)?.ageBand, occupation: occupations[background][Math.floor(jobRoll * occupations[background].length)], personality: traits[Math.floor(traitRoll * traits.length)], goal: goals[Math.floor(goalRoll * goals.length)], goalProgress: Math.floor(goalRoll * 3), goalSupport: 0, goalStage: ["계획 세우기", "한 걸음 진행", "기회 기다리기"][Math.floor(goalRoll * 3)], mood: "평소와 같음", lastAutonomousAction: "이번 주 계획을 생각하는 중", memories: [], warmth: 46 + Math.floor(value * 23), note: i < 2 ? "최근 연락이 이어지고 있다" : "아직 자세히 알지 못한다" };
  });
}
function relationshipKind(a: Contact, b: Contact): NPCRelationship["kind"] {
  if (/가족|사촌|친척|형제|자매/.test(a.role) && /가족|사촌|친척|형제|자매/.test(b.role)) return "family";
  if (a.affiliation && a.affiliation === b.affiliation) return "work";
  const aType = getRelationshipProfile(a.role).type;
  const bType = getRelationshipProfile(b.role).type;
  if (aType === "friend" || bType === "friend") return "friend";
  if (aType === "work" || bType === "work") return "work";
  return "acquaintance";
}
function makeNPCRelationship(a: Contact, b: Contact, warmth: number, week = 1): NPCRelationship {
  const [contactAId, contactBId] = [a.id, b.id].sort();
  return { id: `npc-link-${contactAId}-${contactBId}`, contactAId, contactBId, warmth, kind: relationshipKind(a, b), lastInteractionWeek: week };
}
export function createInitialNPCRelationships(contacts: Contact[], seed: number): NPCRelationship[] {
  const links: NPCRelationship[] = [];
  for (let i = 0; i < contacts.length; i += 1) {
    for (let j = i + 1; j < contacts.length; j += 1) {
      const a = contacts[i];
      const b = contacts[j];
      const sameGroup = !!a.affiliation && a.affiliation === b.affiliation;
      const socialTie = getRelationshipProfile(a.role).type === "friend" || getRelationshipProfile(b.role).type === "friend";
      const [, roll] = nextRandom(seed ^ createSeed(`npc-link:${a.id}:${b.id}`));
      const chance = sameGroup ? 0.42 : socialTie ? 0.31 : 0.16;
      if (roll < chance) links.push(makeNPCRelationship(a, b, 35 + Math.floor(roll * 50)));
    }
  }
  return links;
}
function evolveNPCRelationships(contacts: Contact[], previous: NPCRelationship[], week: number, seed: number): NPCRelationship[] {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  const links = previous.map((link) => {
    const a = byId.get(link.contactAId);
    const b = byId.get(link.contactBId);
    if (!a || !b) return link;
    const [, encounterRoll] = nextRandom(seed ^ createSeed(`${link.id}:week:${week}:encounter`));
    if (encounterRoll >= 0.16 + (link.kind === "friend" ? 0.08 : link.kind === "work" ? 0.05 : 0)) return link;
    const [, outcomeRoll] = nextRandom(seed ^ createSeed(`${link.id}:week:${week}:outcome`));
    const change = outcomeRoll < 0.7 ? 1 + Math.floor(outcomeRoll * 3) : -1 - Math.floor(outcomeRoll * 2);
    return { ...link, warmth: clamp(link.warmth + change), lastInteractionWeek: week };
  });
  return links;
}
export function createGame(character: Character, seed = createSeed(`${character.name}:${character.year}:${character.age}:${character.background}`)): GameState {
  const money = character.startingMoney ?? (character.background === "student" ? 420_000 : character.background === "jobseeker" ? 650_000 : 1_850_000);
  const body = generateBodyMetrics(character.gender, seed, character.heightCm);
  const player = { ...character, ...body, weightKg: character.weightKg ?? body.weightKg, affiliation: getPlayerAffiliation(character), portraitId: character.portraitId ?? choosePortraitId(character.gender, character.age, seed) };
  const contacts = generateContacts(character.background, seed, character.age, [player.portraitId]).map((person) => ({ ...person, firstMetWeek: 1, lastInteractionWeek: 1, returnCount: 0 }));
  return {
    version: 1, character: player, week: 1, day: 1, phase: "playing", seed,
    evaluatedDays: [], seenEvents: [], npcStoryStages: {}, npcStoryLastWeek: {}, npcStoryChoices: {},
    stats: { money, energy: 72, stress: 24, mood: 61, focus: 52 },
    contacts, archivedContacts: [], relationshipRecords: [], npcRelationships: createInitialNPCRelationships(contacts, seed), nextContactNumber: 13,
    log: [`${character.year}년, ${character.name}의 새로운 생활이 시작됐다.`],
    settings: { palette: "clean", nightMode: "device", nightStart: "21:00", nightEnd: "07:00", topics: { affair: true, illness: true, pregnancy: true } },
  };
}
function clamp(value: number, min = 0, max = 100): number { return Math.max(min, Math.min(max, value)); }
const weeklyCashflowProfiles: Record<Background, { income: number; livingExpenses: number; incomeLabel: string; expenseLabel: string }> = {
  student: { income: 150_000, livingExpenses: 155_000, incomeLabel: "용돈·아르바이트", expenseLabel: "식비·교통·학업" },
  jobseeker: { income: 80_000, livingExpenses: 180_000, incomeLabel: "단기 일·가족 지원", expenseLabel: "식비·교통·구직 준비" },
  worker: { income: 600_000, livingExpenses: 340_000, incomeLabel: "급여", expenseLabel: "식비·교통·생활" },
};
const weeklyHousingExpenses: Record<string, number> = {
  "가족과 동거": 0, "기숙사": 45_000, "전세·월세 동거": 85_000, "자취": 130_000,
};
export function getWeeklyCashflowPlan(character: Character): WeeklyCashflowPlan {
  const profile = weeklyCashflowProfiles[character.background];
  const housingExpenses = weeklyHousingExpenses[character.housing] ?? 85_000;
  const expenses = profile.livingExpenses + housingExpenses;
  return {
    income: profile.income, livingExpenses: profile.livingExpenses, housingExpenses, expenses,
    net: profile.income - expenses, incomeLabel: profile.incomeLabel, expenseLabel: profile.expenseLabel,
  };
}
function settleWeeklyCashflow(state: GameState): GameState {
  if (state.weeklyCashflow?.week === state.week) return state;
  const plan = getWeeklyCashflowPlan(state.character);
  const available = state.stats.money + plan.income;
  const unpaidExpenses = Math.max(0, plan.expenses - available);
  const endingBalance = Math.max(0, available - plan.expenses);
  const cashflow: WeeklyCashflow = {
    week: state.week, income: plan.income, expenses: plan.expenses, unpaidExpenses, endingBalance,
  };
  const line = unpaidExpenses > 0
    ? `${state.week}주차 정산 · 수입 +${plan.income.toLocaleString("ko-KR")}원 / 지출 ${plan.expenses.toLocaleString("ko-KR")}원 · 미납 ${unpaidExpenses.toLocaleString("ko-KR")}원`
    : `${state.week}주차 정산 · 수입 +${plan.income.toLocaleString("ko-KR")}원 / 지출 -${plan.expenses.toLocaleString("ko-KR")}원`;
  return {
    ...state, weeklyCashflow: cashflow,
    stats: { ...state.stats, money: endingBalance, stress: clamp(state.stats.stress + (unpaidExpenses > 0 ? 5 : 0)) },
    log: [line, ...state.log],
  };
}
function personalStoryKind(contact: Contact): "family" | "work" | "friendship" | "goal" {
  if (/가족|사촌|친척|이웃/.test(contact.role)) return "family";
  if (/동료|직장|업무|선배|협력자/.test(contact.role)) return "work";
  if (/친구|지인|동아리|스터디|모임|소개/.test(contact.role)) return "friendship";
  return "goal";
}
export function getPersonalStoryEvents(state: GameState): LifeEvent[] {
  const stages = state.npcStoryStages ?? {};
  const lastWeeks = state.npcStoryLastWeek ?? {};
  const eligible = state.contacts
    .map((contact, index) => ({ contact, index, stage: stages[contact.id] ?? 0 }))
    .filter(({ contact, stage }) => stage < 3 && (contact.warmth >= (stage === 0 ? 63 : stage === 1 ? 52 : 58) || (contact.goalSupport ?? 0) >= 1) && (lastWeeks[contact.id] ?? 0) < state.week)
    .sort((a, b) => b.contact.warmth - a.contact.warmth || a.index - b.index);
  const selected = eligible[0];
  if (!selected) return [];
  const { contact, index, stage } = selected;
  const id = `npc-story-${contact.id}-${stage + 1}`;
  const kind = personalStoryKind(contact);
  const name = contact.name;
  const goal = contact.goal ?? "자기만의 방향을 찾는 일";
  const previousChoice = (state.npcStoryChoices ?? {})[contact.id];
  const context = kind === "family" ? "가족의 돌봄과 생활비 문제" : kind === "work" ? "업무 변화와 앞으로의 진로" : kind === "friendship" ? "가까운 관계와 자신의 생활" : goal;
  const npcUpdate = `${name}은(는) “${goal}”에 신경 쓰고 있고, 요즘 ${contact.mood ?? "평소와 같은 상태"}라고 한다.${(contact.goalSupport ?? 0) >= 1 ? " 네가 건넨 응원이 다음 걸음을 고민하는 데 도움이 됐다고 한다." : ""}`;
  const stageCopy = stage === 0
    ? `${name}이 평소보다 진지한 표정으로 이야기를 꺼냈다. ${npcUpdate} 요즘 ${context} 때문에 고민이 있지만, 누구에게 어떻게 말해야 할지 몰랐다고 한다.`
    : stage === 1
      ? `${name}이 지난번 대화를 기억하며 다시 연락했다. ${previousChoice === "story-listen" ? "그때 충분히 들어준 덕분에 마음을 정리할 수 있었다고 한다." : previousChoice === "story-plan" ? "함께 정리한 계획을 실제로 시도해봤다고 한다." : "서두르지 않고 생각해본 뒤 작은 결정을 내렸다고 한다."} ${npcUpdate} 이제 다음에 무엇을 할지 이야기하고 싶어 한다.`
      : `${name}이 중요한 결정을 내린 뒤 근황을 전했다. ${npcUpdate} ${context}에 대한 고민이 완전히 사라진 것은 아니지만, 이제는 자신의 선택을 조금 더 믿게 됐다고 한다.`;
  const choices: EventChoice[] = stage === 0 ? [
    { id: "story-listen", title: "해결책보다 먼저 충분히 들어준다", detail: "감정을 받아들이고 속도를 맞춘다", result: `${name}의 이야기를 끊지 않고 들었다. ${name}은 마음을 털어놓을 사람이 있다는 것만으로도 한결 편해졌다고 했다.`, effect: { mood: 3, stress: -2, relationship: 5, goalSupport: 1 }, contactIndex: index },
    { id: "story-plan", title: "함께 가능한 선택지를 정리한다", detail: "현실적인 다음 행동을 찾는다", result: `${name}과 상황을 나눠 보고 할 수 있는 일을 정리했다. ${name}은 작은 것부터 시도해보기로 했다.`, effect: { focus: 3, relationship: 4, goalSupport: 2 }, contactIndex: index },
    { id: "story-space", title: "지금 당장 결론 내리지 않아도 된다고 말한다", detail: "조언을 강요하지 않고 시간을 준다", result: `${name}이 스스로 생각을 정리할 시간을 가질 수 있도록 했다. 부담 없이 다시 이야기하기로 약속했다.`, effect: { stress: -2, relationship: 3, goalSupport: 1 }, contactIndex: index },
  ] : stage === 1 ? [
    { id: "story-encourage", title: "시도한 점을 인정하고 응원한다", detail: "결과보다 용기와 노력을 본다", result: `${name}이 직접 움직인 점을 함께 돌아봤다. 완벽하지 않아도 계속해볼 힘을 얻었다고 했다.`, effect: { mood: 4, relationship: 4, goalSupport: 1 }, contactIndex: index },
    { id: "story-adjust", title: "잘되지 않은 부분을 같이 조정한다", detail: "다른 방법과 도움을 찾아본다", result: `${name}이 막힌 부분을 함께 살펴보고 계획을 조금 바꿨다. 혼자 해결해야 한다는 부담이 줄었다.`, effect: { focus: 3, stress: -2, relationship: 3, goalSupport: 2 }, contactIndex: index },
    { id: "story-follow", title: "앞으로 필요한 도움을 구체적으로 묻는다", detail: "필요한 만큼 돕고 경계를 존중한다", result: `${name}에게 어떤 도움이 실제로 필요한지 물었다. 서로 감당 가능한 범위를 정했다.`, effect: { stress: -1, relationship: 4, goalSupport: 1 }, contactIndex: index },
  ] : [
    { id: "story-celebrate", title: "작은 변화라도 함께 축하한다", detail: "성과를 인정하고 관계를 이어간다", result: `${name}의 결정을 함께 기뻐했다. 두 사람은 앞으로도 중요한 변화를 나누기로 했다.`, effect: { mood: 5, relationship: 5, goalSupport: 1 }, contactIndex: index },
    { id: "story-reflect", title: "과정에서 배운 점을 서로 나눈다", detail: "경험을 다음 선택의 밑거름으로 삼는다", result: `${name}과 지나온 과정을 돌아봤다. 고민이 남아 있어도 대응할 방법을 알게 됐다는 점을 확인했다.`, effect: { focus: 3, relationship: 4, goalSupport: 1 }, contactIndex: index },
    { id: "story-continue", title: "앞으로도 편하게 연락하자고 약속한다", detail: "필요할 때 이어질 관계를 만든다", result: `${name}과 앞으로도 부담 없이 안부를 나누기로 했다. 서로의 생활을 존중하며 관계를 이어간다.`, effect: { stress: -2, relationship: 4, goalSupport: 1 }, contactIndex: index },
  ];
  return [{
    id, title: stage === 0 ? `${name}이 속마음을 털어놓았다` : stage === 1 ? `${name}이 그날의 대화를 기억하고 있다` : `${name}의 고민에 한 단락이 더해졌다`,
    eyebrow: `${contact.role} · 개인 이야기`, body: stageCopy,
    personalStory: { contactId: contact.id, stage }, choices,
  }];
}
export function getNpcReunionEvents(state: GameState): LifeEvent[] {
  const ids = state.npcReunionIds ?? [];
  return ids.flatMap((contactId) => {
    const contact = state.contacts.find((item) => item.id === contactId);
    if (!contact) return [];
    const index = state.contacts.findIndex((item) => item.id === contactId);
    const remembered = (contact.memories ?? []).find((memory) => memory.vividness <= 0.45)?.text;
    const memoryLine = remembered
      ? `예전 함께 보낸 날의 한 장면이 어렴풋이 떠올랐다. “우리 그때 ${remembered} 얘기도 했었지?” ${contact.name}도 정확히는 기억나지 않는 듯 웃었다.`
      : "예전에 함께 지낸 시간이 있었지만, 세세한 장면은 희미해져 있었다. 두 사람은 그동안 달라진 일상을 조심스럽게 물었다.";
    return [{
      id: `npc-reunion-${contact.id}-${contact.returnCount ?? 1}`,
      title: `${contact.name}과 다시 마주쳤다`,
      eyebrow: `${contact.role} · 다시 이어진 인연`,
      body: `${contact.name}과(와) 다시 만나 반갑게 인사를 나눴다. ${memoryLine} 예전처럼 바로 가까워지기보다, 지금의 서로를 알아가는 시간이 필요해 보인다.`,
      reunion: { contactId },
      choices: [
        { id: "reunion-memory", title: "희미한 기억을 같이 되짚어본다", detail: "기억이 완전하지 않아도 함께 웃었던 순간을 나눈다", result: `${contact.name}과 예전 일을 천천히 떠올렸다. 기억은 흐릿했지만 함께 웃으며 다시 대화를 이어갈 수 있었다.`, effect: { mood: 3, relationship: 5 }, contactIndex: index },
        { id: "reunion-now", title: "지난 일보다 서로의 요즘을 묻는다", detail: "지금 달라진 생활과 관심사를 알아간다", result: `${contact.name}과 서로의 최근 생활을 나눴다. 예전 관계를 그대로 되돌리기보다 지금의 모습으로 새로 알아가기로 했다.`, effect: { stress: -1, relationship: 4 }, contactIndex: index },
        { id: "reunion-slow", title: "반가움을 전하고 천천히 연락하자고 한다", detail: "서로의 속도를 존중하며 부담 없이 이어간다", result: `${contact.name}에게 다시 만나 반갑다고 전했다. 무리해서 예전처럼 지내려 하지 않고, 편한 때 안부를 나누기로 했다.`, effect: { relationship: 3 }, contactIndex: index },
      ],
    }];
  });
}
function nextEligibleEvent(state: GameState): [LifeEvent | undefined, number] {
  const recent = state.recentEventIds ?? [];
  const lastSeen = state.eventLastSeenWeek ?? {};
  const eligible = [...eventLibrary[state.character.background], ...commonEventLibrary, ...getPersonalStoryEvents(state), ...getNpcReunionEvents(state)].filter((event) => !state.seenEvents.includes(event.id) && (!event.topic || state.settings.topics[event.topic]));
  const cooled = eligible.filter((event) => state.week - (lastSeen[event.id] ?? -100) >= 3 && !recent.includes(event.id));
  const olderButEligible = eligible.filter((event) => state.week - (lastSeen[event.id] ?? -100) >= 3);
  const options = cooled.length ? cooled : olderButEligible.length ? olderButEligible : eligible;
  const [afterRoll, roll] = nextRandom(state.seed);
  if (!options.length) return [undefined, afterRoll];
  const chance = 0.42 + Math.max(0, state.stats.stress - 30) / 300;
  if (roll > Math.min(chance, 0.58)) return [undefined, afterRoll];
  const [afterSelect, indexRoll] = nextRandom(afterRoll);
  const eventWeight = (event: LifeEvent) => event.reunion ? 12 : event.personalStory ? 7 : 1;
  const totalWeight = options.reduce((sum, event) => sum + eventWeight(event), 0);
  let ticket = indexRoll * totalWeight;
  const selected = options.find((event) => {
    ticket -= eventWeight(event);
    return ticket < 0;
  });
  return [selected ?? options[options.length - 1], afterSelect];
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
    const settled = settleWeeklyCashflow(next);
    const npcTurn = simulateNpcWeek(settled);
    return {
      ...settled,
      phase: "summary",
      seed: npcTurn.seed,
      contacts: npcTurn.contacts,
      archivedContacts: npcTurn.archivedContacts,
      relationshipRecords: npcTurn.relationshipRecords,
      npcRelationships: npcTurn.npcRelationships,
      nextContactNumber: npcTurn.nextContactNumber,
      npcReunionIds: npcTurn.reunionIds,
      log: [...npcTurn.logs, ...settled.log],
    };
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
export function takeDailyAction(state: GameState, action: DailyAction, targetContactId?: string): GameState {
  if (state.phase !== "playing") return state;
  const actionDay = `${state.week}-${state.day}`;
  if ((state.actionDays ?? []).includes(actionDay)) return state;
  const focusLabel = state.character.background === "worker" ? "업무에 집중했다" : state.character.background === "jobseeker" ? "구직 준비에 집중했다" : "공부에 집중했다";
  const actionEffects: Record<DailyAction, { log: string; effect: Effect; contactIndex?: number }> = {
    focus: { log: focusLabel, effect: { focus: 5, energy: -5, stress: 2 } },
    rest: { log: "일정을 비우고 제대로 쉬었다", effect: { energy: 10, stress: -5, mood: 2 } },
    social: { log: "가까운 사람과 시간을 보냈다", effect: { mood: 4, energy: -3, relationship: 3 }, contactIndex: 1 },
    organize: { log: "생활과 이번 주 계획을 정리했다", effect: { focus: 2, stress: -2, energy: -1 } },
  };
  const selected = actionEffects[action];
  const requestedContactIndex = action === "social" && targetContactId
    ? state.contacts.findIndex((contact) => contact.id === targetContactId)
    : -1;
  const selectedContactIndex = action === "social"
    ? requestedContactIndex >= 0 ? requestedContactIndex : selected.contactIndex
    : selected.contactIndex;
  const actionLog = action === "social" && selectedContactIndex !== undefined && selectedContactIndex >= 0
    ? `${state.contacts[selectedContactIndex].name}과 시간을 보냈다`
    : selected.log;
  const next: GameState = {
    ...state,
    actionDays: [...(state.actionDays ?? []), actionDay],
    weeklyActions: { ...(state.weeklyActions ?? {}), [action]: ((state.weeklyActions ?? {})[action] ?? 0) + 1 },
    stats: {
      money: Math.max(0, state.stats.money + (selected.effect.money ?? 0)),
      energy: clamp(state.stats.energy + (selected.effect.energy ?? 0)),
      stress: clamp(state.stats.stress + (selected.effect.stress ?? 0)),
      mood: clamp(state.stats.mood + (selected.effect.mood ?? 0)),
      focus: clamp(state.stats.focus + (selected.effect.focus ?? 0)),
    },
    contacts: state.contacts.map((contact, index) => index === selectedContactIndex
      ? { ...contact, warmth: clamp(contact.warmth + (selected.effect.relationship ?? 0)), lastInteractionWeek: state.week, goalSupport: clamp((contact.goalSupport ?? 0) + 1, 0, 3), note: actionLog, memories: addNpcMemory(contact, actionLog, state.week) }
      : contact),
    log: [actionLog, ...state.log],
  };
  return advanceDay(next);
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
    eventLastSeenWeek: { ...(state.eventLastSeenWeek ?? {}), [state.pendingEvent.id]: state.week },
    weeklyMeetingMomentum: Math.min(5, (state.weeklyMeetingMomentum ?? 0) + (effect.newContactOpportunity ?? 0)),
    weeklyMeetingContext: choice.meetingContext ?? state.weeklyMeetingContext,
    npcReunionIds: state.pendingEvent.reunion
      ? (state.npcReunionIds ?? []).filter((id) => id !== state.pendingEvent?.reunion?.contactId)
      : state.npcReunionIds,
    npcStoryStages: state.pendingEvent.personalStory ? {
      ...(state.npcStoryStages ?? {}), [state.pendingEvent.personalStory.contactId]: state.pendingEvent.personalStory.stage + 1,
    } : state.npcStoryStages,
    npcStoryLastWeek: state.pendingEvent.personalStory ? {
      ...(state.npcStoryLastWeek ?? {}), [state.pendingEvent.personalStory.contactId]: state.week,
    } : state.npcStoryLastWeek,
    npcStoryChoices: state.pendingEvent.personalStory ? {
      ...(state.npcStoryChoices ?? {}), [state.pendingEvent.personalStory.contactId]: choice.id,
    } : state.npcStoryChoices,
    stats: {
      money: Math.max(0, state.stats.money + (effect.money ?? 0)),
      energy: clamp(state.stats.energy + (effect.energy ?? 0)),
      stress: clamp(state.stats.stress + (effect.stress ?? 0)),
      mood: clamp(state.stats.mood + (effect.mood ?? 0)),
      focus: clamp(state.stats.focus + (effect.focus ?? 0)),
    },
    contacts: state.contacts.map((contact, index) => {
      const storyContactIndex = state.pendingEvent?.personalStory
        ? state.contacts.findIndex((item) => item.id === state.pendingEvent?.personalStory?.contactId)
        : choice.contactIndex;
      if (index !== storyContactIndex || !(effect.relationship || effect.goalSupport || state.pendingEvent?.personalStory)) return contact;
      return {
        ...contact,
        warmth: clamp(contact.warmth + (effect.relationship ?? 0)),
        goalSupport: clamp((contact.goalSupport ?? 0) + (effect.goalSupport ?? 0), 0, 3),
        note: choice.result,
        memories: addNpcMemory(contact, choice.result, state.week),
      };
    }),
    log: [choice.result, ...state.log],
  };
  return next;
}
function addNpcMemory(contact: Contact, text: string, week: number): NPCMemory[] {
  const previous = contact.memories ?? [];
  return [
    { id: `${contact.id}-memory-${week}-${previous.length}`, text, week, vividness: 1 },
    ...previous,
  ].slice(0, 8);
}

export type RelationshipType = "family" | "friend" | "work" | "acquaintance";
export function getRelationshipProfile(role: string): { type: RelationshipType; graceWeeks: number; warmthDrift: number; departureMultiplier: number } {
  if (/가족|부모|사촌|친척|형제|자매/.test(role)) return { type: "family", graceWeeks: 12, warmthDrift: 0.18, departureMultiplier: 0.48 };
  if (/오래 알고 지낸 친구|친구|절친|동아리|스터디|모임/.test(role)) return { type: "friend", graceWeeks: 10, warmthDrift: 0.28, departureMultiplier: 0.68 };
  if (/동료|직장|업무|선배|협력자|팀원/.test(role)) return { type: "work", graceWeeks: 8, warmthDrift: 0.4, departureMultiplier: 0.9 };
  return { type: "acquaintance", graceWeeks: 6, warmthDrift: 0.58, departureMultiplier: 1.15 };
}

function simulateNpcWeek(state: GameState): { contacts: Contact[]; archivedContacts: Contact[]; relationshipRecords: RelationshipRecord[]; npcRelationships: NPCRelationship[]; nextContactNumber: number; reunionIds: string[]; seed: number; logs: string[] } {
  let seed = state.seed;
  const logs: string[] = [];
  const records = [...(state.relationshipRecords ?? [])];
  const archived = [...(state.archivedContacts ?? [])];
  const reunionIds = [...(state.npcReunionIds ?? [])];
  let npcRelationships = [...(state.npcRelationships ?? createInitialNPCRelationships(state.contacts, state.seed))];
  let nextContactNumber = state.nextContactNumber ?? (state.contacts.length + archived.length + 1);
  const survivors: Contact[] = [];
  for (const original of state.contacts) {
    let contact = original;
    const weeksSinceContact = Math.max(0, state.week - (contact.lastInteractionWeek ?? contact.firstMetWeek ?? 1));
    const relationship = getRelationshipProfile(contact.role);
    if (weeksSinceContact >= relationship.graceWeeks && contact.warmth > 15) {
      const weeklyDrift = relationship.warmthDrift + Math.min(0.65, Math.max(0, weeksSinceContact - relationship.graceWeeks) * 0.035);
      contact = { ...contact, warmth: Math.max(15, contact.warmth - weeklyDrift) };
    }
    const warmthFactor = contact.warmth <= 25 ? 1.25 : contact.warmth <= 40 ? 0.78 : contact.warmth <= 55 ? 0.38 : 0.12;
    const timeFactor = weeksSinceContact < relationship.graceWeeks ? 0 : 0.008 + Math.min(0.085, (weeksSinceContact - relationship.graceWeeks) * 0.0065);
    const [, departureRoll] = nextRandom(state.seed ^ createSeed(`distance:${contact.id}:${state.week}`));
    const departureChance = timeFactor * warmthFactor * relationship.departureMultiplier;
    if (departureChance > 0 && departureRoll < departureChance) {
      const departed = { ...contact, archivedWeek: state.week, note: "서로의 생활이 달라져 한동안 연락이 뜸해졌다." };
      archived.push(departed);
      const text = `${contact.name}과(와) 연락이 뜸해져 각자의 생활을 이어가게 됐다. 함께한 기억은 생애기록에 남아 있다.`;
      logs.push(text);
      records.push({ id: `departure-${contact.id}-${state.week}`, week: state.week, kind: "departure", contactId: contact.id, contactName: contact.name, text });
      continue;
    }
    survivors.push(contact);
  }
  const contacts: Contact[] = survivors.map((contact) => {
    const [nextSeed, roll] = nextRandom(seed ^ createSeed(`${contact.id}:${state.week}`));
    seed = nextSeed;
    const warmth = contact.warmth;
    const playerSupport = clamp(contact.goalSupport ?? 0, 0, 3);
    const chance = clamp(55 + (warmth - 50) * 0.45 + playerSupport * 9, 30, 90) / 100;
    const oldGoal = contact.goal ?? "자기만의 방향을 찾는 일";
    const memories = (contact.memories ?? [])
      .map((memory) => ({ ...memory, vividness: memory.vividness * 0.94 }))
      .filter((memory) => memory.vividness >= 0.2);
    const currentProgress = contact.goalProgress ?? 0;
    const advanced = roll < chance || playerSupport >= 3;
    let goal = oldGoal;
    let goalProgress = advanced ? currentProgress + 1 : currentProgress;
    let goalStage = advanced
      ? ["계획 세우기", "한 걸음 진행", "마무리 준비", "완료"][Math.min(goalProgress, 3)]
      : contact.goalStage ?? "기회 기다리기";
    let mood = advanced ? "자기 일에 집중하는 중" : "일정이 조금 꼬임";
    let lastAutonomousAction = advanced
      ? playerSupport > 0 ? `“${goal}”을(를) 이어갔어요. 네가 건넨 응원이 도움이 됐어요.` : `“${goal}”을(를) 이어갔어요.`
      : playerSupport > 0 ? `네가 건넨 응원을 생각하며 “${goal}” 다음 단계를 준비하고 있어요.` : "갑작스러운 일정 때문에 계획을 미뤘어요.";
    if (goalProgress >= 3) {
      const [goalSeed, goalRoll] = nextRandom(seed ^ createSeed(`${contact.id}:${state.week}:next-goal`));
      seed = goalSeed;
      const nextGoals = goals.filter((candidate) => candidate !== oldGoal);
      goal = nextGoals[Math.floor(goalRoll * nextGoals.length)] ?? "새로운 기회를 살펴보기";
      goalProgress = 0;
      goalStage = "새 목표를 살펴보는 중";
      mood = "작은 성취 뒤 다음 계획을 생각하는 중";
      lastAutonomousAction = playerSupport > 0
        ? `“${oldGoal}”의 한 단계를 마쳤어요. 네가 곁에서 도와준 것도 힘이 됐어요.`
        : `“${oldGoal}”의 한 단계를 마치고 다음 목표를 찾기 시작했어요.`;
      logs.push(`${contact.name}이(가) “${oldGoal}”에서 한 단계를 마쳤어요.`);
      return {
        ...contact, goal, goalProgress, goalStage, mood, lastAutonomousAction, goalSupport: Math.max(0, playerSupport - 1),
        memories: addNpcMemory({ ...contact, memories }, lastAutonomousAction, state.week),
      };
    }
    return { ...contact, goal, goalProgress, goalStage, mood, lastAutonomousAction, goalSupport: Math.max(0, playerSupport - 1), memories };
  });
  for (let index = archived.length - 1; index >= 0; index -= 1) {
    const old = archived[index];
    const weeksAway = state.week - (old.archivedWeek ?? state.week);
    if (weeksAway < 6) continue;
    const [, reunionRoll] = nextRandom(state.seed ^ createSeed(`reunion:${old.id}:${state.week}`));
    const reunionChance = Math.min(0.16, 0.025 + weeksAway * 0.0025) * (/가족|부모|사촌|친척|친구/.test(old.role) ? 1.25 : 1);
    if (reunionRoll >= reunionChance) continue;
    archived.splice(index, 1);
    const returned = { ...old, archivedWeek: undefined, warmth: Math.min(35, Math.max(18, old.warmth - 12)), goalSupport: 0, memories: (old.memories ?? []).map((memory) => ({ ...memory, vividness: Math.min(memory.vividness, 0.28) })), lastInteractionWeek: state.week, returnCount: (old.returnCount ?? 0) + 1, note: "우연히 다시 만나 어색하지만 반갑게 안부를 나눴다." };
    contacts.push(returned);
    reunionIds.push(returned.id);
    const text = `${old.name}과(와) 우연히 다시 만났다. 예전만큼 가깝지는 않지만, 서로의 근황을 나누며 새롭게 관계를 이어가기 시작했다.`;
    logs.push(text);
    records.push({ id: `reunion-${old.id}-${state.week}`, week: state.week, kind: "reunion", contactId: old.id, contactName: old.name, text });
  }
  const actions = state.weeklyActions ?? {};
  const arrivalChance = Math.min(0.85, 0.06 + (actions.social ?? 0) * 0.11 + (actions.focus ?? 0) * 0.025 + (actions.organize ?? 0) * 0.02 + (state.weeklyMeetingMomentum ?? 0) * 0.18);
  const [, arrivalRoll] = nextRandom(state.seed ^ createSeed(`arrival-chance:${state.week}:${nextContactNumber}`));
  if (arrivalRoll < arrivalChance) {
    const [nextSeed, roll] = nextRandom(seed ^ createSeed(`arrival:${state.week}:${nextContactNumber}`)); seed = nextSeed;
    const knownPeople = [...contacts, ...archived];
    const generated = generateContacts(
      state.character.background,
      Math.floor(roll * 0xffffffff),
      state.character.age,
      [state.character.portraitId ?? "", ...knownPeople.map((person) => person.portraitId ?? "")],
      knownPeople.map((person) => person.name),
    )[Math.floor(roll * 12)];
    const social = (actions.social ?? 0) > 0;
    const focus = (actions.focus ?? 0) > 0;
    const meetingContext = state.weeklyMeetingContext ?? (social ? "취미나 동네 모임" : focus ? (state.character.background === "student" ? "수업이나 스터디" : state.character.background === "jobseeker" ? "취업 준비 모임" : "업무나 프로젝트") : "일상을 정리하던 중 들른 동네 공간");
    const person: Contact = { ...generated, id: `person-${nextContactNumber++}`, firstMetWeek: state.week, lastInteractionWeek: state.week, returnCount: 0, warmth: 42 + Math.floor(roll * 13), note: `${meetingContext}에서 처음 인사를 나눴다.` };
    contacts.push(person);
    const newTies = contacts.filter((candidate) => candidate.id !== person.id)
      .map((candidate) => ({ candidate, score: createSeed(`${state.seed}:${person.id}:${candidate.id}:tie`) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, Math.min(2, contacts.length - 1));
    for (const { candidate } of newTies) npcRelationships.push(makeNPCRelationship(person, candidate, 28 + createSeed(`${person.id}:${candidate.id}`) % 28, state.week));
    const text = `${meetingContext}에서 ${person.name}을(를) 새롭게 알게 됐다. ${person.role}로 만나 가볍게 인사를 나눴다.`;
    logs.push(text);
    records.push({ id: `arrival-${person.id}-${state.week}`, week: state.week, kind: "arrival", contactId: person.id, contactName: person.name, text });
  }
  npcRelationships = evolveNPCRelationships(contacts, npcRelationships, state.week, state.seed);
  return { contacts, archivedContacts: archived, relationshipRecords: records, npcRelationships, nextContactNumber, reunionIds, seed, logs };
}

export function startNextWeek(state: GameState): GameState {
  if (state.phase !== "summary") return state;
  const week = state.week + 1;
  return {
    ...state, week, day: 1, phase: "playing",
    evaluatedDays: [], actionDays: [], weeklyActions: {}, weeklyMeetingMomentum: 0, weeklyMeetingContext: undefined, seenEvents: [], lastChoice: undefined,
    stats: { ...state.stats, energy: clamp(state.stats.energy + 12), stress: clamp(state.stats.stress - 7) },
    log: [`${week}주차가 시작됐다. 지난주의 경험이 생활에 남아 있다.`, ...state.log],
  };
}
export function setPalette(state: GameState, palette: Palette): GameState {
  return { ...state, settings: { ...state.settings, palette } };
}

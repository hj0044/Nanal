import type { GameState } from "./game";
import { migrateEconomy } from "./economy";
import { lifeDate } from "./korean";

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === "string";
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);

/** Retain the original payload on failure; callers can export it before any replacement. */
export function parseSave(input: unknown): GameState {
  if (!object(input) || ![1, 2, 3, 4].includes(Number(input.version))) throw new Error("지원하지 않는 저장 버전입니다.");
  const c = input.character, s = input.stats;
  if (!object(c) || !text(c.name) || !finite(c.age) || c.age < 0 || !finite(c.year) ||
    !["student", "jobseeker", "worker"].includes(String(c.background)) || !["여성", "남성"].includes(String(c.gender)) ||
    !text(c.region) || !text(c.housing) || !object(s) ||
    ![s.money, s.energy, s.stress, s.mood, s.focus].every(finite) ||
    !finite(input.week) || input.week < 1 || !finite(input.day) || input.day < 1 || input.day > 7 ||
    !finite(input.seed) || !["playing", "event", "summary"].includes(String(input.phase)) ||
    !Array.isArray(input.contacts) || !input.contacts.every((p) => object(p) && text(p.id) && text(p.name) && text(p.role) && finite(p.warmth) && text(p.note)) ||
    !Array.isArray(input.log) || !input.log.every(text)) throw new Error("저장 파일의 필수 데이터가 손상됐습니다.");
  if (input.phase === "event" && (!object(input.pendingEvent) || !text(input.pendingEvent.id) ||
    !Array.isArray(input.pendingEvent.choices) || !input.pendingEvent.choices.length ||
    !input.pendingEvent.choices.every((choice) => object(choice) && text(choice.id) && text(choice.title) && text(choice.result) && object(choice.effect)))) {
    throw new Error("진행 중인 사건이 손상됐습니다. 원본을 보관하고 복구가 필요합니다.");
  }
  if (!object(input.settings)) throw new Error("화면 설정이 손상됐습니다.");
  const settings = input.settings;
  const migrated = {
    ...input,
    version: 4,
    lastAgedCalendarYear: finite(input.lastAgedCalendarYear) ? input.lastAgedCalendarYear : Math.max(lifeDate(Number(c.year), Number(input.week)).getFullYear(), Number(c.year) + Math.floor((Number(input.week) - 1) / 52)),
    economy: Number(input.version) >= 3 && object(input.economy) ? input.economy : migrateEconomy(c as unknown as GameState["character"], Number(input.week)),
    evaluatedDays: Array.isArray(input.evaluatedDays) ? input.evaluatedDays : [],
    actionDays: stringList(input.actionDays) ? input.actionDays : [],
    seenEvents: stringList(input.seenEvents) ? input.seenEvents : [],
    recentEventIds: stringList(input.recentEventIds) ? input.recentEventIds : [],
    playerGoals: Array.isArray(input.playerGoals) ? input.playerGoals : [],
    storyArcs: object(input.storyArcs) ? input.storyArcs : {},
    worldFacts: Array.isArray(input.worldFacts) ? input.worldFacts : [],
    playerRelationships: object(input.playerRelationships) ? input.playerRelationships : Object.fromEntries((input.contacts as Array<Record<string, unknown>>).filter((person) => /가족|부모|사촌|친척|형제|자매/.test(String(person.role))).map((person) => [person.id, { kind: "family", sinceWeek: 1 }])),
    favoriteContactIds: stringList(input.favoriteContactIds) ? input.favoriteContactIds : [],
    eventThreads: object(input.eventThreads) ? input.eventThreads : {},
    archivedContacts: Array.isArray(input.archivedContacts) ? input.archivedContacts : [],
    relationshipRecords: Array.isArray(input.relationshipRecords) ? input.relationshipRecords : [],
    settings: {
      palette: ["clean", "warm", "dark"].includes(String(settings.palette)) ? settings.palette : "clean",
      nightMode: ["off", "device", "schedule"].includes(String(settings.nightMode)) ? settings.nightMode : "device",
      nightStart: text(settings.nightStart) ? settings.nightStart : "21:00",
      nightEnd: text(settings.nightEnd) ? settings.nightEnd : "07:00",
      topics: { affair: true, illness: true, pregnancy: true, ...(object(settings.topics) ? settings.topics : {}) },
    },
  };
  if (object(input.weeklyCashflow) && !finite(input.weeklyCashflow.unpaidExpenses)) {
    throw new Error("주간 정산 데이터가 손상됐습니다.");
  }
  const e = migrated.economy;
  if (!object(e) || !object(e.employment) || !["student", "seeking", "employed", "unemployed"].includes(String(e.employment.status)) ||
    !finite(e.employment.monthlySalary) || !finite(e.employment.tenureWeeks) || !finite(e.debt) || e.debt < 0 ||
    !finite(e.monthlyDebtPayment) || !finite(e.activationMonth) || !Array.isArray(e.transactions) ||
    !e.transactions.every((entry) => object(entry) && text(entry.id) && finite(entry.week) && finite(entry.amount) && text(entry.label))) throw new Error("경제 데이터가 손상됐습니다.");
  return migrated as unknown as GameState;
}

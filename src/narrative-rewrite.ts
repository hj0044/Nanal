import { getEventFamily, getWeeklyCashflowPlan, type Contact, type GameState, type LifeEvent } from "./game";

type Signal = "support" | "promise" | "conflict" | "reconciliation" | "goal-step" | "setback" | "milestone" | "shared-time";
type Family = ReturnType<typeof getEventFamily>;
type RewritePerson = {
  role: "family" | "work" | "friend" | "acquaintance";
  ageBand: "unknown" | "19-22" | "23-26" | "27-30";
  occupation: "unknown" | "student" | "office-work" | "service-work" | "creative-work" | "job-seeking" | "other-work";
  personality: "unknown" | "outgoing" | "cautious" | "empathetic" | "independent" | "playful" | "steady";
  goalTheme: "general" | "finance-independence" | "learning" | "career" | "relationships" | "health" | "personal-growth";
  goalStage: "planning" | "in-progress" | "finishing" | "considering";
  moodBand: "focused" | "under-pressure" | "recovering" | "steady";
  relationshipBand: "close" | "developing" | "distant";
  memorySignals: Signal[];
};
type RewriteRequest = {
  schemaVersion: 1;
  context: {
    yearBand: string; month: number; season: string; calendarLabel: string;
    regionType: "capital" | "other-city"; background: GameState["character"]["background"];
    housing: "family-home" | "independent-or-shared"; pressure: "steady" | "money" | "energy" | "stress";
    housingPressure: boolean; people: RewritePerson[]; recentEventFamilies: Family[];
  };
  event: {
    id: string; family: Family; title: string; eyebrow: string; body: string; speakerPresent: boolean;
    choices: Array<{ id: string; title: string; detail: string; result: string }>;
  };
};

const sanitize = (text: string, state: GameState) => {
  const names = [state.character.name, ...state.contacts.map((person) => person.name), ...(state.archivedContacts ?? []).map((person) => person.name)]
    .filter((name) => name.trim().length >= 2).sort((a, b) => b.length - a.length);
  const goals = [...state.contacts, ...(state.archivedContacts ?? [])].map((person) => person.goal)
    .filter((goal): goal is string => Boolean(goal && goal.trim().length >= 3)).sort((a, b) => b.length - a.length);
  return [...names, ...goals].reduce((value, privateText) => value.split(privateText).join(names.includes(privateText) ? "주변 인물" : "개인적인 목표"), text);
};

function ageBand(age?: number): RewritePerson["ageBand"] {
  return age == null ? "unknown" : age < 23 ? "19-22" : age < 27 ? "23-26" : "27-30";
}
function personSignals(contact: Contact): RewritePerson {
  const role: RewritePerson["role"] = /가족|부모|사촌|친척/.test(contact.role) ? "family"
    : /동료|직장|업무|팀원|선배/.test(contact.role) ? "work"
      : /친구|동아리|스터디|모임/.test(contact.role) ? "friend" : "acquaintance";
  const occupation: RewritePerson["occupation"] = !contact.occupation ? "unknown"
    : /학생|대학생|고등학생|대학원/.test(contact.occupation) ? "student"
      : /개발|디자인|기획|마케팅|사무|연구|공무원/.test(contact.occupation) ? "office-work"
        : /서비스|매장|카페|음식|판매|고객/.test(contact.occupation) ? "service-work"
          : /프리랜서|창작|작가|예술/.test(contact.occupation) ? "creative-work"
            : /취업|구직|준비/.test(contact.occupation) ? "job-seeking" : "other-work";
  const personality: RewritePerson["personality"] = !contact.personality ? "unknown"
    : /활발|사교|먼저 다가/.test(contact.personality) ? "outgoing"
      : /차분|신중|계획|현실/.test(contact.personality) ? "cautious"
        : /다정|공감|걱정/.test(contact.personality) ? "empathetic"
          : /독립|주관|경쟁|추진/.test(contact.personality) ? "independent"
            : /즉흥|유쾌|호기심/.test(contact.personality) ? "playful" : "steady";
  const goal = contact.goal ?? "";
  const goalTheme: RewritePerson["goalTheme"] = /돈|경제|생활비|빚|독립|집/.test(goal) ? "finance-independence"
    : /공부|자격|실력|학습/.test(goal) ? "learning"
      : /일|직무|진로|취업|인정/.test(goal) ? "career"
        : /관계|가족|친구|사람|오해/.test(goal) ? "relationships"
          : /건강|리듬|휴식/.test(goal) ? "health"
            : /취미|여행|창작|경험/.test(goal) ? "personal-growth" : "general";
  const goalStage: RewritePerson["goalStage"] = /마무리|완료/.test(contact.goalStage ?? "") ? "finishing"
    : /한 걸음|실천|진행/.test(contact.goalStage ?? "") ? "in-progress"
      : /계획|준비/.test(contact.goalStage ?? "") ? "planning" : "considering";
  const moodBand: RewritePerson["moodBand"] = /작은 성취|집중/.test(contact.mood ?? "") ? "focused"
    : /일정|예상치 못한/.test(contact.mood ?? "") ? "under-pressure"
      : /회복|편안/.test(contact.mood ?? "") ? "recovering" : "steady";
  const memorySignals = (contact.memories ?? []).filter((memory) => memory.significance === "meaningful" || (memory.emotionalTrace ?? memory.vividness) >= 0.5)
    .slice(0, 2).flatMap((memory): Signal[] => {
      const text = memory.text;
      const signals: Signal[] = [];
      if (/응원|도움|곁/.test(text)) signals.push("support");
      if (/약속|다음에/.test(text)) signals.push("promise");
      if (/갈등|서먹|상처|오해|다투/.test(text)) signals.push("conflict");
      if (/화해|사과|마음을 풀/.test(text)) signals.push("reconciliation");
      if (/목표|계획|시도|준비/.test(text)) signals.push("goal-step");
      if (/미뤘|실패|어려|막힌|예상치 못한/.test(text)) signals.push("setback");
      if (/마쳤|해냈|완료|성과|첫걸음/.test(text)) signals.push("milestone");
      if (/함께|시간을 보냈|식사|대화/.test(text)) signals.push("shared-time");
      return signals.length ? signals : ["shared-time"];
    }).slice(0, 4);
  return { role, ageBand: ageBand(contact.age), occupation, personality, goalTheme, goalStage, moodBand,
    relationshipBand: contact.warmth >= 70 ? "close" : contact.warmth >= 42 ? "developing" : "distant",
    memorySignals: memorySignals.length ? memorySignals : ["shared-time"] };
}

function eventContacts(event: LifeEvent, state: GameState): Contact[] {
  const targetIds = new Set([
    event.personalStory?.contactId, event.reunion?.contactId, event.npcPair?.contactAId, event.npcPair?.contactBId,
    ...event.choices.map((choice) => choice.contactId),
    ...event.choices.map((choice) => choice.contactIndex === undefined ? undefined : state.contacts[choice.contactIndex]?.id),
  ].filter((id): id is string => Boolean(id)));
  const targets = state.contacts.filter((contact) => targetIds.has(contact.id));
  return (targets.length ? targets : [...state.contacts].sort((a, b) => b.warmth - a.warmth)).slice(0, 3);
}

function calendarLabel(background: GameState["character"]["background"], month: number): string {
  if (background === "student") return month === 3 || month === 9 ? "새 학기와 일정 조정"
    : month === 6 || month === 12 ? "학기 마무리와 시험 준비"
      : month === 7 || month === 8 ? "방학과 생활 리듬 변화" : "평소와 같은 생활 흐름";
  if (background === "jobseeker" && (month === 3 || month === 9)) return "채용 공고와 지원 일정";
  if (background === "worker" && [3, 6, 9, 12].includes(month)) return "분기 마감과 업무 일정";
  return "평소와 같은 생활 흐름";
}

export function buildNarrativeRewriteRequest(event: LifeEvent, state: GameState): RewriteRequest {
  const date = new Date(state.character.year, 0, (state.week - 1) * 7 + state.day);
  const month = date.getMonth() + 1;
  const cashflow = getWeeklyCashflowPlan(state.character);
  const pressure: RewriteRequest["context"]["pressure"] = state.stats.money <= 120_000 ? "money"
    : state.stats.energy <= 40 ? "energy" : state.stats.stress >= 55 ? "stress" : "steady";
  const recentEventFamilies = Object.entries(state.eventFamilyLastSeenWeek ?? {})
    .filter(([family]) => ["romance", "family", "career", "study", "work", "money", "health", "housing", "friendship", "social", "npc-story", "daily"].includes(family))
    .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([family]) => family as Family);
  const scrub = (value: string) => sanitize(value, state);
  return {
    schemaVersion: 1,
    context: {
      yearBand: `${Math.floor(state.character.year / 10) * 10}s`, month,
      season: month <= 2 || month === 12 ? "겨울" : month <= 5 ? "봄" : month <= 8 ? "여름" : "가을",
      calendarLabel: calendarLabel(state.character.background, month),
      regionType: state.character.region === "서울" ? "capital" : "other-city",
      background: state.character.background,
      housing: /가족/.test(state.character.housing) ? "family-home" : "independent-or-shared",
      pressure,
      housingPressure: cashflow.housingExpenses > 0 && state.stats.money < cashflow.expenses * 2,
      people: eventContacts(event, state).map(personSignals),
      recentEventFamilies,
    },
    event: {
      // Avoid sending stable per-NPC event IDs to the provider.
      id: `event-${getEventFamily(event)}-${state.week}-${state.day}`,
      family: getEventFamily(event),
      title: scrub(event.title), eyebrow: scrub(event.eyebrow), body: scrub(event.body),
      speakerPresent: Boolean(event.npcDialogue),
      choices: event.choices.map(({ id, title, detail, result }) => ({ id, title: scrub(title), detail: scrub(detail), result: scrub(result) })),
    },
  };
}

const cleanText = (value: unknown, limit: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 0 && text.length <= limit ? text : undefined;
};

/** Applies text only; ids, targets, and all authored gameplay effects stay unchanged. */
export function applyNarrativeRewrite(event: LifeEvent, value: unknown, state: GameState): LifeEvent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const title = cleanText(raw.title, 70);
  const eyebrow = cleanText(raw.eyebrow, 32);
  const body = cleanText(raw.body, 420);
  if (!title || !eyebrow || !body || !Array.isArray(raw.choices) || raw.choices.length !== event.choices.length) return undefined;
  const returned = new Map<string, Record<string, unknown>>();
  for (const item of raw.choices) {
    if (!item || typeof item !== "object") return undefined;
    const choice = item as Record<string, unknown>;
    if (typeof choice.id !== "string" || returned.has(choice.id)) return undefined;
    returned.set(choice.id, choice);
  }
  if (returned.size !== event.choices.length || event.choices.some((choice) => !returned.has(choice.id))) return undefined;
  const choices = event.choices.map((choice) => {
    const rewritten = returned.get(choice.id)!;
    const rewrittenTitle = cleanText(rewritten.title, 64);
    const detail = cleanText(rewritten.detail, 100);
    const result = cleanText(rewritten.result, 220);
    return rewrittenTitle && detail && result
      ? { ...choice, title: sanitize(rewrittenTitle, state), detail: sanitize(detail, state), result: sanitize(result, state) }
      : undefined;
  });
  if (choices.some((choice) => !choice)) return undefined;
  const dialogueLine = event.npcDialogue ? cleanText(raw.npcDialogueLine, 220) : undefined;
  if (event.npcDialogue && !dialogueLine) return undefined;
  return {
    ...event,
    title: sanitize(title, state), eyebrow: sanitize(eyebrow, state), body: sanitize(body, state),
    choices: choices as LifeEvent["choices"],
    narrativeCopyGenerated: true,
    ...(event.npcDialogue && dialogueLine ? { npcDialogue: { ...event.npcDialogue, line: sanitize(dialogueLine, state) } } : {}),
  };
}

export async function rewriteNarrative(event: LifeEvent, state: GameState, signal: AbortSignal): Promise<LifeEvent | undefined> {
  const response = await fetch("/api/narrative-event", {
    method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
    body: JSON.stringify(buildNarrativeRewriteRequest(event, state)), signal,
  });
  if (!response.ok) throw new Error(`Narrative service returned ${response.status}`);
  return applyNarrativeRewrite(event, await response.json(), state);
}

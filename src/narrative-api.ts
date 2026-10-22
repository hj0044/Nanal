/** Portable server handler for the same-origin Gemini narrative routes. */

const enumValues = {
  seasons: ["겨울", "봄", "여름", "가을"],
  calendarLabels: ["평소와 같은 생활 흐름", "새 학기와 일정 조정", "학기 마무리와 시험 준비", "방학과 생활 리듬 변화", "채용 공고와 지원 일정", "분기 마감과 업무 일정"],
  backgrounds: ["student", "jobseeker", "worker"],
  pressures: ["steady", "money", "energy", "stress"],
  families: ["romance", "family", "career", "study", "work", "money", "health", "housing", "friendship", "social", "npc-story", "daily"],
  regions: ["capital", "other-city"],
  housing: ["family-home", "independent-or-shared"],
  roles: ["family", "work", "friend", "acquaintance"],
  ages: ["unknown", "19-22", "23-26", "27-30"],
  occupations: ["unknown", "student", "office-work", "service-work", "creative-work", "job-seeking", "other-work"],
  personalities: ["unknown", "outgoing", "cautious", "empathetic", "independent", "playful", "steady"],
  goalThemes: ["general", "finance-independence", "learning", "career", "relationships", "health", "personal-growth"],
  goalStages: ["planning", "in-progress", "finishing", "considering"],
  moods: ["focused", "under-pressure", "recovering", "steady"],
  relationships: ["close", "developing", "distant"],
  signals: ["support", "promise", "conflict", "reconciliation", "goal-step", "setback", "milestone", "shared-time"],
} as const;

type Env = { NANAL_GEMINI_API_KEY?: string; NANAL_GEMINI_MODEL?: string };
type Json = Record<string, unknown>;
const asObject = (value: unknown): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isEnum = (value: unknown, values: readonly string[]) => typeof value === "string" && values.includes(value);
const boundedText = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

function validContext(value: unknown): value is Json {
  if (!asObject(value)) return false;
  const c = value;
  if (!boundedText(c.yearBand, 8) || !Number.isInteger(c.month) || Number(c.month) < 1 || Number(c.month) > 12 ||
      !isEnum(c.season, enumValues.seasons) || !isEnum(c.calendarLabel, enumValues.calendarLabels) ||
      !isEnum(c.regionType, enumValues.regions) || !isEnum(c.background, enumValues.backgrounds) ||
      !isEnum(c.housing, enumValues.housing) || !isEnum(c.pressure, enumValues.pressures) || typeof c.housingPressure !== "boolean" ||
      !Array.isArray(c.people) || c.people.length > 3 || !Array.isArray(c.recentEventFamilies) || c.recentEventFamilies.length > 4 ||
      !c.recentEventFamilies.every((x) => isEnum(x, enumValues.families))) return false;
  return c.people.every((person) => {
    if (!asObject(person)) return false;
    return isEnum(person.role, enumValues.roles) && isEnum(person.ageBand, enumValues.ages) &&
      isEnum(person.occupation, enumValues.occupations) && isEnum(person.personality, enumValues.personalities) &&
      isEnum(person.goalTheme, enumValues.goalThemes) && isEnum(person.goalStage, enumValues.goalStages) &&
      isEnum(person.moodBand, enumValues.moods) && isEnum(person.relationshipBand, enumValues.relationships) &&
      Array.isArray(person.memorySignals) && person.memorySignals.length <= 4 && person.memorySignals.every((x) => isEnum(x, enumValues.signals));
  });
}

function validRequest(value: unknown): value is Json {
  if (!asObject(value) || value.schemaVersion !== 1 || !validContext(value.context) || !asObject(value.event)) return false;
  const e = value.event;
  return boundedText(e.id, 80) && isEnum(e.family, enumValues.families) && boundedText(e.title, 70) &&
    boundedText(e.eyebrow, 32) && boundedText(e.body, 420) && typeof e.speakerPresent === "boolean" &&
    Array.isArray(e.choices) && e.choices.length >= 2 && e.choices.length <= 3 && e.choices.every((choice) => {
      if (!asObject(choice)) return false;
      return boundedText(choice.id, 48) && boundedText(choice.title, 64) && boundedText(choice.detail, 100) && boundedText(choice.result, 220);
    }) && new Set(e.choices.map((choice) => (choice as Json).id)).size === e.choices.length;
}

function responseSchema(choiceCount: number, speakerPresent: boolean) {
  const properties: Json = {
    title: { type: "STRING" }, eyebrow: { type: "STRING" }, body: { type: "STRING" },
    choices: { type: "ARRAY", minItems: choiceCount, maxItems: choiceCount, items: { type: "OBJECT", properties: { id: { type: "STRING" }, title: { type: "STRING" }, detail: { type: "STRING" }, result: { type: "STRING" } }, required: ["id", "title", "detail", "result"] } },
  };
  const required = ["title", "eyebrow", "body", "choices"];
  if (speakerPresent) { properties.npcDialogueLine = { type: "STRING" }; required.push("npcDialogueLine"); }
  return { type: "OBJECT", properties, required };
}

function validateCopy(value: unknown, request: Json): Json | undefined {
  if (!asObject(value) || !asObject(request.event)) return undefined;
  const e = request.event;
  const choices = value.choices;
  if (!boundedText(value.title, 70) || !boundedText(value.eyebrow, 32) || !boundedText(value.body, 420) || !Array.isArray(choices) || choices.length !== (e.choices as unknown[]).length) return undefined;
  const expected = (e.choices as Json[]).map((choice) => choice.id);
  const byId = new Map<string, Json>();
  for (const raw of choices) {
    if (!asObject(raw) || typeof raw.id !== "string" || byId.has(raw.id)) return undefined;
    byId.set(raw.id, raw);
  }
  if (byId.size !== expected.length || expected.some((id) => typeof id !== "string" || !byId.has(id))) return undefined;
  const cleanChoices: Json[] = [];
  for (const id of expected as string[]) {
    const choice = byId.get(id)!;
    if (!boundedText(choice.title, 64) || !boundedText(choice.detail, 100) || !boundedText(choice.result, 220)) return undefined;
    cleanChoices.push({ id, title: choice.title, detail: choice.detail, result: choice.result });
  }
  const result: Json = { title: value.title, eyebrow: value.eyebrow, body: value.body, choices: cleanChoices };
  if (e.speakerPresent) {
    if (!boundedText(value.npcDialogueLine, 220)) return undefined;
    result.npcDialogueLine = value.npcDialogueLine;
  }
  return result;
}

const systemInstruction = `너는 한국어 생활 시뮬레이션의 문장 편집자다. 이미 정해진 사건과 선택지 문구를 자연스럽고 구체적인 한국어로 다듬는다. 사실, 인물, 사건, 금액을 새로 만들거나 원문에 없는 구체 정보를 추측하지 않는다. 제공된 성격·목표 단계·기분·관계·기억 신호만 은근히 반영한다. 실명이나 개인정보를 묻거나 출력하지 않는다. 선택지의 의도와 결과 의미를 바꾸지 말고, 짧고 자연스럽게 쓴다. 각 choice id는 그대로 보존한다. JSON 스키마에 맞는 문구만 반환하고 효과나 게임 규칙은 쓰지 않는다.`;

/** Host Worker should pass its request and env here for /api/narrative-* routes. */
export async function handleNarrativeApi(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname === "/api/narrative-status" && request.method === "GET") return json({ available: Boolean(env.NANAL_GEMINI_API_KEY) });
  if (url.pathname !== "/api/narrative-event") return undefined;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).origin !== url.origin) return json({ error: "origin_not_allowed" }, 403); }
    catch { return json({ error: "invalid_origin" }, 403); }
  }
  if (!env.NANAL_GEMINI_API_KEY) return json({ error: "narrative_unavailable" }, 503);
  const raw = await request.text();
  if (raw.length > 18_000) return json({ error: "request_too_large" }, 413);
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  if (!validRequest(payload)) return json({ error: "invalid_request" }, 400);
  const event = payload.event as Json;
  const choices = event.choices as Json[];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const model = env.NANAL_GEMINI_MODEL || "gemini-3.8-flash";
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": env.NANAL_GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: "low" }, maxOutputTokens: 1000, responseMimeType: "application/json", responseSchema: responseSchema(choices.length, Boolean(event.speakerPresent)) },
      }),
    });
    if (!response.ok) return json({ error: "provider_error" }, 502);
    const provider = await response.json() as Json;
    const candidates = provider.candidates as Json[] | undefined;
    const content = candidates?.[0]?.content as Json | undefined;
    const parts = content?.parts as Json[] | undefined;
    const text = parts?.find((part) => typeof part.text === "string")?.text;
    if (typeof text !== "string") return json({ error: "invalid_provider_response" }, 502);
    let decoded: unknown;
    try { decoded = JSON.parse(text); } catch { return json({ error: "invalid_provider_response" }, 502); }
    const copy = validateCopy(decoded, payload);
    return copy ? json(copy) : json({ error: "invalid_provider_response" }, 502);
  } catch {
    return json({ error: "provider_unavailable" }, 502);
  } finally { clearTimeout(timeout); }
}

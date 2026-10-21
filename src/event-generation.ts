import type { Background, LifeEvent, SensitiveTopic } from "./game";

/** Minimal, non-identifying context for a future server-side narrative provider. */
export interface EventGenerationRequest {
  background: Background;
  year: number;
  ageBand: "19-22" | "23-26" | "27-30";
  week: number;
  day: number;
  recentEventIds: string[];
  enabledTopics: Record<SensitiveTopic, boolean>;
  relationshipSignals: Array<"new-contact" | "close-friend" | "family" | "coworker" | "dating">;
}

/** Provider is injected by a future server adapter; the browser ships no API key. */
export interface EventGenerationProvider {
  generate(request: EventGenerationRequest, signal?: AbortSignal): Promise<unknown>;
}

const allowedEffects = ["money", "energy", "stress", "mood", "focus", "relationship"] as const;
const topics: SensitiveTopic[] = ["affair", "illness", "pregnancy"];
const cleanText = (value: unknown, limit: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 0 && text.length <= limit ? text : undefined;
};

/** Reject malformed, disallowed, or extreme model output before game code sees it. */
export function validateGeneratedEvent(value: unknown, enabledTopics: Record<SensitiveTopic, boolean>): LifeEvent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !/^ai-[a-z0-9-]{3,48}$/.test(raw.id)) return undefined;
  const title = cleanText(raw.title, 70);
  const eyebrow = cleanText(raw.eyebrow, 32);
  const body = cleanText(raw.body, 420);
  if (!title || !eyebrow || !body) return undefined;
  let topic: SensitiveTopic | undefined;
  if (raw.topic !== undefined) {
    if (typeof raw.topic !== "string" || !topics.includes(raw.topic as SensitiveTopic)) return undefined;
    topic = raw.topic as SensitiveTopic;
    if (!enabledTopics[topic]) return undefined;
  }
  if (!Array.isArray(raw.choices) || raw.choices.length < 2 || raw.choices.length > 3) return undefined;
  const seenChoiceIds = new Set<string>();
  const choices: LifeEvent["choices"] = [];
  for (const item of raw.choices) {
    if (!item || typeof item !== "object") return undefined;
    const choice = item as Record<string, unknown>;
    if (typeof choice.id !== "string" || !/^[a-z0-9-]{2,48}$/.test(choice.id) || seenChoiceIds.has(choice.id)) return undefined;
    seenChoiceIds.add(choice.id);
    const choiceTitle = cleanText(choice.title, 64);
    const detail = cleanText(choice.detail, 100);
    const result = cleanText(choice.result, 220);
    if (!choiceTitle || !detail || !result || !choice.effect || typeof choice.effect !== "object") return undefined;
    const effect: NonNullable<LifeEvent["choices"][number]["effect"]> = {};
    for (const [key, amount] of Object.entries(choice.effect as Record<string, unknown>)) {
      if (!(allowedEffects as readonly string[]).includes(key) || typeof amount !== "number" || !Number.isFinite(amount)) return undefined;
      const limit = key === "money" ? 100_000 : key === "relationship" ? 12 : 20;
      if (Math.abs(amount) > limit) return undefined;
      effect[key as keyof typeof effect] = Math.trunc(amount);
    }
    choices.push({ id: choice.id, title: choiceTitle, detail, result, effect });
  }
  return { id: raw.id, title, eyebrow, body, topic, choices };
}

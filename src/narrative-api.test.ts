import { describe, expect, it, vi } from "vitest";
import { handleNarrativeApi } from "./narrative-api";

const requestBody = {
  schemaVersion: 1,
  context: {
    yearBand: "20s", month: 4, season: "봄", calendarLabel: "평소와 같은 생활 흐름", regionType: "capital", background: "student",
    housing: "independent-or-shared", pressure: "steady", housingPressure: false, people: [], recentEventFamilies: ["daily"],
  },
  event: {
    id: "event-daily-1-1", family: "daily", title: "하루의 선택", eyebrow: "일상", body: "오늘 무엇을 할까?", speakerPresent: true,
    choices: [
      { id: "choice-0", title: "산책한다", detail: "잠깐 바람을 쐰다", result: "기분이 조금 나아졌다." },
      { id: "choice-1", title: "쉰다", detail: "집에서 휴식한다", result: "피로가 풀렸다." },
    ],
  },
};
const copy = { title: "바람을 쐰 오후", eyebrow: "일상", body: "잠깐 밖을 걸으며 생각을 정리했다.", npcDialogueLine: "오늘은 좀 괜찮네.", choices: [
  { id: "choice-0", title: "가볍게 걷는다", detail: "집 근처를 천천히 돈다", result: "기분이 조금 환기됐다." },
  { id: "choice-1", title: "집에서 쉰다", detail: "무리하지 않고 쉬어간다", result: "몸의 긴장이 조금 풀렸다." },
] };
const post = (body: unknown, origin = "https://game.example") => new Request("https://game.example/api/narrative-event", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

describe("Gemini narrative API", () => {
  it("reports availability without exposing the credential", async () => {
    const response = await handleNarrativeApi(new Request("https://game.example/api/narrative-status"), { NANAL_GEMINI_API_KEY: "secret" });
    expect(await response?.json()).toEqual({ available: true });
    expect(response?.headers.get("cache-control")).toBe("no-store");
  });

  it("sends only validated text context to Gemini and returns text with original ids", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(copy) }] } }] }), { status: 200 }));
    const response = await handleNarrativeApi(post(requestBody), { NANAL_GEMINI_API_KEY: "server-only" }, fetcher);
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual(copy);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain("gemini-3.8-flash:generateContent");
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("server-only");
    expect(JSON.parse(String(init?.body)).contents[0].parts[0].text).toContain("event-daily-1-1");
  });

  it("rejects invalid data and cross-origin requests before contacting Gemini", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const foreign = await handleNarrativeApi(post(requestBody, "https://evil.example"), { NANAL_GEMINI_API_KEY: "key" }, fetcher);
    expect(foreign?.status).toBe(403);
    const invalid = await handleNarrativeApi(post({ ...requestBody, event: { ...requestBody.event, choices: [] } }), { NANAL_GEMINI_API_KEY: "key" }, fetcher);
    expect(invalid?.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("falls back with an error for missing credentials or unsafe provider output", async () => {
    const unavailable = await handleNarrativeApi(post(requestBody), {});
    expect(unavailable?.status).toBe(503);
    const badCopy = { ...copy, choices: [{ ...copy.choices[0], id: "changed-id" }, copy.choices[1]] };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(badCopy) }] } }] }), { status: 200 }));
    const invalid = await handleNarrativeApi(post(requestBody), { NANAL_GEMINI_API_KEY: "key" }, fetcher);
    expect(invalid?.status).toBe(502);
  });

  it("returns undefined for host paths it does not own", async () => {
    expect(await handleNarrativeApi(new Request("https://game.example/"), {})).toBeUndefined();
  });
});

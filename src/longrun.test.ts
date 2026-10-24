import { describe, expect, it } from "vitest";
import { advanceDays, chooseEvent, createGame, startNextWeek, type Character } from "./game";
import { parseSave } from "./save";

const character: Character = { name: "장기 테스트", age: 26, year: 2024, background: "worker", gender: "여성", region: "서울", housing: "자취", startingMoney: 2_000_000 };

function runUntil(targetDays: number, seed: number) {
  let state = createGame(character, seed);
  let meaningful = 0;
  for (let step = 0; step < 30_000 && (state.week - 1) * 7 + state.day < targetDays; step++) {
    if (state.phase === "event") {
      meaningful++;
      state = chooseEvent(state, state.pendingEvent!.choices[0].id);
    } else if (state.phase === "summary") state = startNextWeek(state);
    else state = advanceDays(state, 7);
  }
  expect((state.week - 1) * 7 + state.day).toBeGreaterThanOrEqual(targetDays);
  return { state, meaningful };
}

describe("seeded long-run regression", () => {
  it("offers a meaningful first-week choice for multiple seeds by the third day", () => {
    for (const seed of [1, 7, 77, 713, 1001]) {
      const state = advanceDays(createGame(character, seed), 3);
      expect(state.phase).toBe("event");
      expect(state.pendingEvent?.choices.length).toBeGreaterThanOrEqual(2);
    }
  });
  it.each([30, 90, 365, 1095, 3650])("runs %i days with valid saves and no duplicate salary or money mismatch", (days) => {
    const { state, meaningful } = runUntil(days, 713);
    const loaded = parseSave(JSON.parse(JSON.stringify(state)));
    expect(loaded.stats.money).toBe(state.stats.money);
    expect(loaded.contacts.map((person) => person.id)).toEqual(state.contacts.map((person) => person.id));
    expect(loaded.worldFacts).toEqual(state.worldFacts);
    expect(state.stats.money).toBeGreaterThanOrEqual(0);
    expect(state.economy!.debt).toBeGreaterThanOrEqual(0);
    const ids = state.economy!.transactions.map((transaction) => transaction.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(meaningful).toBeGreaterThan(0);
    if (days === 30) expect(state.seenEvents.length + state.recentEventIds!.length).toBeGreaterThan(0);
  }, 60_000);

  it("replays an independent 3-year seed identically", () => {
    const first = runUntil(1095, 77).state;
    const second = runUntil(1095, 77).state;
    expect(second).toEqual(first);
  }, 60_000);
});

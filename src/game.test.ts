import { describe, expect, it } from "vitest";
import { chooseEvent, createGame, finishWeek, takeAction, type Background } from "./game";

function startingGame(background: Background = "student") {
  return createGame({ name: "하진", age: 24, year: 2026, background, seedText: "test-seed" });
}

describe("Nanal first-week simulation", () => {
  it("creates the same initial world for the same seed", () => {
    expect(startingGame()).toEqual(startingGame());
  });

  it("choice changes only relevant state and remembers the interaction", () => {
    const initial = startingGame();
    const next = chooseEvent(initial, initial.pendingEvent!.choices[0].id);
    expect(next.pendingEvent).toBeNull();
    expect(next.npcs[0].memories[0].week).toBe(1);
    expect(next.log[0].category).toBe("선택");
    expect(initial.pendingEvent).not.toBeNull();
  });

  it("blocks weekly actions until the event has been handled", () => {
    expect(() => takeAction(startingGame(), "rest")).toThrow(/사건 선택/);
  });

  it("requires exactly two actions before closing the week", () => {
    const afterEvent = chooseEvent(startingGame(), "coordinate");
    expect(() => finishWeek(afterEvent)).toThrow(/행동을 모두/);
    const afterOne = takeAction(afterEvent, "rest");
    expect(() => takeAction(afterOne, "rest")).not.toThrow();
    const afterTwo = takeAction(afterOne, "study");
    expect(() => takeAction(afterTwo, "rest")).toThrow(/모두 사용/);
    expect(finishWeek(afterTwo).week).toBe(2);
  });

  it("advances NPC goals and stores a readable weekly summary", () => {
    let state = startingGame("jobseeker");
    state = chooseEvent(state, "ask");
    state = takeAction(state, "connect", "doyun");
    state = takeAction(state, "search");
    const next = finishWeek(state);
    expect(next.week).toBe(2);
    expect(next.npcs.some((npc) => npc.lastAction.length > 0)).toBe(true);
    expect(next.lastWeekSummary).toHaveLength(3);
    expect(next.log.some((entry) => entry.category === "주간 정리")).toBe(true);
  });

  it("keeps NPC memory visibility bounded over many weeks", () => {
    let state = startingGame("worker");
    state = chooseEvent(state, "prioritize");
    state = takeAction(state, "connect", "junho");
    state = takeAction(state, "rest");
    for (let i = 0; i < 12; i += 1) {
      state = finishWeek(state);
      if (state.pendingEvent) state = chooseEvent(state, state.pendingEvent.choices[0].id);
      state = takeAction(state, "rest");
      state = takeAction(state, "study");
    }
    expect(state.npcs.every((npc) => npc.memories.length <= 6)).toBe(true);
    expect(state.npcs.every((npc) => npc.memories.every((memory) => memory.vividness > 0.18))).toBe(true);
  });
});
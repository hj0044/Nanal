import { describe, expect, it } from "vitest";
import { advanceDay, chooseEvent, createGame, generateContacts, startNextWeek, type Character } from "./game";

const character: Character = {
  name: "지우", age: 24, year: 2024, background: "student",
  gender: "여성", region: "서울", housing: "자취",
};

describe("first week simulation", () => {
  it("creates twelve stable contacts for the selected background", () => {
    const first = generateContacts("student", 12345);
    const second = generateContacts("student", 12345);
    expect(first).toHaveLength(12);
    expect(first).toEqual(second);
    expect(new Set(first.map((contact) => contact.id)).size).toBe(12);
  });

  it("pauses time while an event waits for a choice", () => {
    let state = createGame(character, 54321);
    for (let i = 0; i < 20 && state.phase === "playing"; i += 1) state = advanceDay(state);
    if (state.phase === "event") {
      const paused = advanceDay(state);
      expect(paused).toBe(state);
      expect(paused.day).toBe(state.day);
    } else {
      expect(["summary", "playing"]).toContain(state.phase);
    }
  });

  it("applies a selected choice and advances into the week", () => {
    let state = createGame(character, 54321);
    for (let i = 0; i < 20 && state.phase !== "event" && state.phase !== "summary"; i += 1) state = advanceDay(state);
    if (state.phase === "event" && state.pendingEvent) {
      const oldEnergy = state.stats.energy;
      state = chooseEvent(state, state.pendingEvent.choices[0].id);
      expect(state.phase).toBe("playing");
      expect(state.stats.energy).not.toBe(oldEnergy);
    }
    let guard = 0;
    while (state.phase !== "summary" && guard < 20) {
      state = advanceDay(state);
      if (state.phase === "event" && state.pendingEvent) state = chooseEvent(state, state.pendingEvent.choices[0].id);
      guard += 1;
    }
    expect(state.phase).toBe("summary");
    const next = startNextWeek(state);
    expect(next.week).toBe(2);
    expect(next.day).toBe(1);
    expect(next.phase).toBe("playing");
  });

  it("ignores an unknown choice id", () => {
    const state = createGame(character, 1);
    expect(chooseEvent(state, "missing")).toBe(state);
  });
});

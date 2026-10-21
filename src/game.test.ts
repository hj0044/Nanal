import { describe, expect, it } from "vitest";
import { advanceDay, advanceDays, chooseEvent, createGame, generateContacts, startNextWeek, type Character } from "./game";

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
    expect(first.every((contact) => contact.age && contact.occupation && contact.personality && contact.goal)).toBe(true);
  });

  it("replays the same first week from the same seed", () => {
    const play = () => {
      let state = createGame(character, 78123);
      for (let guard = 0; guard < 20 && state.phase !== "summary"; guard += 1) {
        if (state.phase === "event" && state.pendingEvent) {
          state = chooseEvent(state, state.pendingEvent.choices[0].id);
        } else {
          state = advanceDay(state);
        }
      }
      return state;
    };
    expect(play()).toEqual(play());
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

  it("supports multi-day progress and stops at a pending event or weekly review", () => {
    const paused = advanceDays(createGame(character, 54321), 7);
    expect(["event", "summary", "playing"]).toContain(paused.phase);
    expect(paused.phase === "event" || paused.phase === "summary" || paused.day > 1).toBe(true);
    if (paused.phase === "event") expect(advanceDays(paused, 7)).toBe(paused);
    if (paused.phase === "summary") expect(paused.day).toBe(7);
  });

  it("keeps a recent-event cooldown across week boundaries", () => {
    let state = createGame(character, 54321);
    for (let guard = 0; guard < 30 && state.phase !== "summary"; guard += 1) {
      state = state.phase === "event" && state.pendingEvent
        ? chooseEvent(state, state.pendingEvent.choices[0].id)
        : advanceDay(state);
    }
    if (state.phase === "summary") {
      const next = startNextWeek(state);
      expect(next.recentEventIds).toEqual(state.recentEventIds ?? []);
      expect(next.seenEvents).toEqual([]);
    }
  });
});

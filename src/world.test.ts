import { describe, expect, it } from "vitest";
import { advanceDay, chooseEvent, createGame, getWorldFactEvents, type Character } from "./game";
import { commonEventLibrary } from "./scenarios";

const character: Character = { name: "민서", age: 26, year: 2024, background: "worker", gender: "여성", region: "서울", housing: "가족과 동거" };

describe("NPC world changes", () => {
  it("settles close NPC life weekly and distant NPC life in elapsed batches", () => {
    const state = createGame(character, 413);
    const close = { ...state.contacts[0], warmth: 90, savings: 1_000_000, lastLifeWeek: 0 };
    const far = { ...state.contacts[1], warmth: 30, savings: 1_000_000, lastLifeWeek: 0 };
    const end = (week: number) => advanceDay({ ...state, week, day: 7, evaluatedDays: [7], contacts: [close, far] });
    const first = end(1);
    expect(first.contacts[0].lastLifeWeek).toBe(1);
    expect(first.contacts[0].savings).not.toBe(1_000_000);
    expect(first.contacts[1].lastLifeWeek).toBe(0);
    const fourth = end(4);
    expect(fourth.contacts[1].lastLifeWeek).toBe(4);
    expect(fourth.contacts[1].savings).not.toBe(1_000_000);
    expect(end(4)).toEqual(fourth);
  });

  it("turns an NPC job change into a resolvable later event with one relationship effect", () => {
    const base = createGame(character, 221);
    const contact = { ...base.contacts[0], employmentStatus: "seeking" as const, savings: 500_000, warmth: 95 };
    const result = Array.from({ length: 20 }, (_, index) => advanceDay({ ...base, contacts: [contact], week: index + 1, day: 7, evaluatedDays: [7] }))
      .find((state) => state.worldFacts?.some((fact) => fact.kind === "career"));
    expect(result).toBeDefined();
    const fact = result!.worldFacts!.find((item) => item.kind === "career")!;
    const due = { ...result!, week: fact.dueWeek };
    const event = getWorldFactEvents(due)[0];
    expect(event.worldFactId).toBe(fact.id);
    const chosen = chooseEvent({ ...due, phase: "event", pendingEvent: event }, "world-check-in");
    expect(chosen.contacts[0].warmth).toBeGreaterThan(due.contacts[0].warmth);
    expect(chosen.worldFacts?.find((item) => item.id === fact.id)?.resolved).toBe(true);
    expect(getWorldFactEvents(chosen)).toHaveLength(0);
    expect(chooseEvent(chosen, "world-check-in")).toBe(chosen);
  });

  it("stores story arc outcome and next due week without resetting the chosen route", () => {
    const state = createGame(character, 17);
    const root = commonEventLibrary.find((event) => event.thread?.stage === 0)!;
    const result = chooseEvent({ ...state, phase: "event", pendingEvent: root }, root.choices[0].id);
    expect(result.storyArcs?.[`thread:${root.thread!.id}`]).toMatchObject({ status: "active", nextWeek: 2, lastOutcome: root.choices[0].result });
    expect(result.eventThreads?.[root.thread!.id]).toBeDefined();
  });
});

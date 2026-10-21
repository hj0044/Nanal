import { describe, expect, it } from "vitest";
import { advanceDay, advanceDays, chooseEvent, createGame, generateContacts, getPersonalStoryEvents, startNextWeek, type Character } from "./game";
import { commonEventLibrary, eventLibrary } from "./scenarios";
import { validateGeneratedEvent } from "./event-generation";
import { getPortrait } from "./portrait-catalog";

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
    expect(first.every((contact) => contact.portraitId && contact.portraitAgeBand)).toBe(true);
    expect(new Set(first.map((contact) => contact.portraitId)).size).toBe(12);
    expect(first.every((contact) => contact.portraitId?.startsWith("npc-"))).toBe(true);
  });

  it("assigns the player and contacts distinct stable portraits from matching age and gender ranges", () => {
    const first = createGame(character, 48291);
    const second = createGame(character, 48291);
    expect(first.character.portraitId).toBe(second.character.portraitId);
    expect(first.contacts.map((person) => person.portraitId)).toEqual(second.contacts.map((person) => person.portraitId));
    expect(new Set([first.character.portraitId, ...first.contacts.map((person) => person.portraitId)]).size).toBe(13);
    expect(first.contacts.every((person) => getPortrait(person.portraitId)?.gender === person.gender)).toBe(true);
    expect(first.contacts.every((person) => getPortrait(person.portraitId)?.ageBand === person.portraitAgeBand)).toBe(true);
  });

  it("provides a broad, unique pool of reviewed events per background", () => {
    const ids = [...commonEventLibrary, ...Object.values(eventLibrary).flat()].map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(60);
    for (const background of ["student", "jobseeker", "worker"] as const) {
      expect(eventLibrary[background].length + commonEventLibrary.length).toBeGreaterThanOrEqual(25);
      expect([...eventLibrary[background], ...commonEventLibrary].every((event) => event.choices.length >= 2)).toBe(true);
    }
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
      const oldStats = { ...state.stats };
      state = chooseEvent(state, state.pendingEvent.choices[0].id);
      expect(state.phase).toBe("playing");
      expect(state.stats).not.toEqual(oldStats);
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

  it("validates future AI output and rejects unsafe effects or disabled topics", () => {
    const settings = { affair: false, illness: true, pregnancy: false };
    const candidate = {
      id: "ai-campus-meeting", title: "새 모임 제안", eyebrow: "관계 · 약속", body: "친구가 모임에 초대했다.",
      choices: [
        { id: "join-a", title: "참여한다", detail: "새 사람을 만난다", result: "즐거운 시간을 보냈다.", effect: { mood: 3, relationship: 2 } },
        { id: "skip-b", title: "다음에 간다", detail: "일정을 조정한다", result: "다음 기회를 잡기로 했다.", effect: { stress: -1 } },
      ],
    };
    expect(validateGeneratedEvent(candidate, settings)?.choices).toHaveLength(2);
    expect(validateGeneratedEvent({ ...candidate, choices: candidate.choices.map((choice) => ({ ...choice, effect: { money: 500_000 } })) }, settings)).toBeUndefined();
    expect(validateGeneratedEvent({ ...candidate, topic: "affair" }, settings)).toBeUndefined();
  });

  it("unlocks a named NPC personal story over multiple weeks and preserves the chosen response", () => {
    let state = createGame(character, 321);
    state.contacts = state.contacts.map((person, index) => index === 0 ? { ...person, warmth: 90 } : person);
    const first = getPersonalStoryEvents(state)[0];
    expect(first?.title).toContain(state.contacts[0].name);
    state = { ...state, phase: "event", pendingEvent: first };
    state = chooseEvent(state, "story-plan");
    expect(state.npcStoryStages?.[state.contacts[0].id]).toBe(1);
    expect(state.npcStoryChoices?.[state.contacts[0].id]).toBe("story-plan");
    expect(state.contacts[0].note).toContain(state.contacts[0].name);
    expect(getPersonalStoryEvents(state).some((event) => event.personalStory?.contactId === state.contacts[0].id)).toBe(false);
    const nextWeek = { ...state, week: 2 };
    const followUp = getPersonalStoryEvents(nextWeek)[0];
    expect(followUp?.personalStory?.stage).toBe(1);
    expect(followUp?.body).toContain("함께 정리한 계획");
  });
});

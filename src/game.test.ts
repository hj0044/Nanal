import { describe, expect, it } from "vitest";
import { addPlayerGoal, advanceDay, advanceDays, chooseEvent, contactArchivedNpc, createGame, createInitialNPCRelationships, generateBodyMetrics, generateContacts, getContactAffiliation, getEventFamily, getNpcRelationshipEvents, getNpcReunionEvents, getPersonalStoryEvents, getPlayerAffiliation, getRelationshipProfile, getWeeklyCashflowPlan, normalizeContactName, personalizeAuthoredEvent, setPlayerGoalStatus, startNextWeek, takeDailyAction, type Character, type LifeEvent } from "./game";
import { commonEventLibrary, eventLibrary } from "./scenarios";
import { validateGeneratedEvent } from "./event-generation";
import { applyNarrativeRewrite, buildNarrativeRewriteRequest } from "./narrative-rewrite";
import { getEventThreadEvents } from "./event-threads";
import { getPortrait, getPortraitCandidates, getPortraitIdentityId, portraitCatalog } from "./portrait-catalog";

const character: Character = {
  name: "지우", age: 24, year: 2024, background: "student",
  gender: "여성", region: "서울", housing: "자취",
};

function finishWeek(state: ReturnType<typeof createGame>) {
  return advanceDay({ ...state, day: 7, phase: "playing", evaluatedDays: [...new Set([...state.evaluatedDays, 7])] });
}

describe("first week simulation", () => {
  it("sends sanitized context to Gemini and keeps authored effects intact", () => {
    const state = createGame(character, 71010);
    const target = state.contacts[2];
    const event: LifeEvent = {
      id: `story-${target.id}-1`, title: `${target.name}이 고민을 털어놓았다`, eyebrow: `${target.role} · 개인 이야기`,
      body: `${character.name}에게 ${target.name}이 “${target.goal}”에 대해 말했다.`,
      personalStory: { contactId: target.id, stage: 0 },
      npcDialogue: { speakerName: target.name, line: "원래 문장" },
      choices: [{ id: `story-listen-${target.id}`, title: "이야기를 듣는다", detail: "천천히 듣는다", result: `${target.name}의 이야기를 들었다.`, effect: { relationship: 4, money: -2_000 }, contactId: target.id }],
    };
    const request = buildNarrativeRewriteRequest(event, state);
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain(character.name);
    expect(serialized).not.toContain(target.name);
    expect(serialized).not.toContain(target.goal);
    expect(serialized).not.toContain(target.id);
    expect(serialized).not.toContain(event.choices[0].id);
    expect(request.event.choices[0].id).toBe("choice-0");
    expect(serialized).not.toContain("effect");
    expect(request.context.people).toHaveLength(1);

    const rewritten = applyNarrativeRewrite(event, {
      title: `${target.name}의 고민`, eyebrow: "개인 이야기", body: `${character.name}과 대화를 나눴다.`, npcDialogueLine: "마음을 나눴다.",
      choices: [{ id: "choice-0", title: "조용히 듣는다", detail: "이야기를 재촉하지 않는다", result: `${target.name}의 말을 끝까지 들었다.` }],
    }, state);
    expect(rewritten?.narrativeCopyGenerated).toBe(true);
    expect(rewritten?.title).not.toContain(target.name);
    expect(rewritten?.npcDialogue?.speakerName).toBe(target.name);
    expect(rewritten?.personalStory).toEqual(event.personalStory);
    expect(rewritten?.choices[0]).toMatchObject({ id: event.choices[0].id, contactId: target.id, effect: { relationship: 4, money: -2_000 } });
  });

  it("rejects Gemini copy that changes or drops an authored choice id", () => {
    const state = createGame(character, 71011);
    const event = { id: "event-test", title: "기존 사건", eyebrow: "일상", body: "기존 문장", choices: [
      { id: "choice-a", title: "A", detail: "A 설명", result: "A 결과", effect: {} },
      { id: "choice-b", title: "B", detail: "B 설명", result: "B 결과", effect: {} },
    ] };
    expect(applyNarrativeRewrite(event, {
      title: "수정 사건", eyebrow: "일상", body: "수정 문장",
      choices: [
        { id: "choice-0", title: "A", detail: "A 설명", result: "A 결과" },
        { id: "invented-choice", title: "B", detail: "B 설명", result: "B 결과" },
      ],
    }, state)).toBeUndefined();
  });

  it("keeps the featured person tied to the latest targeted interaction", () => {
    const state = createGame(character, 71000);
    const target = state.contacts[3];
    const social = takeDailyAction(state, "social", target.id);
    expect(social.lastChoiceContactIds).toEqual([target.id]);
    expect(social.contacts[3].note).toContain(target.name);

    const ambientEvent = chooseEvent({ ...state, phase: "event", pendingEvent: {
      id: "ambient-check", title: "하루의 선택", eyebrow: "일상", body: "잠시 생각했다.",
      choices: [{ id: "quiet", title: "계속 생각한다", detail: "", result: "잠시 생각을 정리했다.", effect: {} }],
    } }, "quiet");
    expect(ambientEvent.lastChoiceContactIds).toEqual([]);
  });

  it("connects daily actions to save-local player goals and caps concurrent goals at three", () => {
    let state = createGame(character, 71001);
    state = addPlayerGoal(state, "learning-skill");
    state = addPlayerGoal(state, "career-direction");
    state = addPlayerGoal(state, "relationship-close");
    const duplicateCategory = addPlayerGoal(state, "career-step");
    expect(duplicateCategory.playerGoals).toHaveLength(3);
    const full = addPlayerGoal(state, "health-rhythm");
    expect(full.playerGoals).toHaveLength(3);
    const advanced = takeDailyAction(state, "focus");
    expect(advanced.playerGoals?.find((goal) => goal.id === "learning-skill")?.progress).toBe(1);
    expect(advanced.playerGoals?.find((goal) => goal.id === "learning-skill")?.weeklyProgress).toBe(1);
    expect(advanced.playerGoals?.find((goal) => goal.id === "career-direction")?.progress).toBe(0);
    const paused = setPlayerGoalStatus(advanced, "learning-skill", "paused");
    expect(addPlayerGoal(paused, "health-rhythm").playerGoals?.some((goal) => goal.id === "health-rhythm" && goal.status === "active")).toBe(true);
  });

  it("tracks a four-week goal cycle and pauses unfinished goals for review", () => {
    let state = addPlayerGoal(createGame(character, 71003), "learning-skill");
    const goal = state.playerGoals![0];
    state = { ...state, week: 4, phase: "summary", playerGoals: [{ ...goal, progress: 5, weeklyProgress: 2 }] };
    const weekFive = startNextWeek(state);
    expect(weekFive.playerGoals?.[0]).toMatchObject({ status: "paused", reviewDue: true, weeklyProgress: 0, progress: 5 });
    const continued = setPlayerGoalStatus(weekFive, goal.id, "active");
    expect(continued.playerGoals?.[0]).toMatchObject({ status: "active", reviewDue: false, createdWeek: 5, cycleNumber: 2, progress: 5, weeklyProgress: 0 });
  });

  it("resets weekly goal progress while preserving compatible older goal saves", () => {
    const state = addPlayerGoal(createGame(character, 71004), "health-rhythm");
    const oldGoal = { ...state.playerGoals![0] };
    delete oldGoal.weeklyProgress;
    delete oldGoal.cycleNumber;
    const next = startNextWeek({ ...state, phase: "summary", playerGoals: [oldGoal] });
    expect(next.playerGoals?.[0]).toMatchObject({ weeklyProgress: 0, progress: 0 });
    expect(next.playerGoals?.[0].cycleNumber).toBeUndefined();
  });

  it("lets a related event choice move one goal and records completion", () => {
    let state = addPlayerGoal(createGame(character, 71002), "career-direction");
    state = { ...state, playerGoals: state.playerGoals?.map((goal) => ({ ...goal, progress: 7 })), phase: "event", pendingEvent: {
      id: "goal-career-check", title: "진로 면접 기회가 찾아오다", eyebrow: "CAREER", body: "기회가 찾아왔다.", choices: [
        { id: "take-step", title: "준비를 시작한다", detail: "", result: "첫 준비를 시작했다.", effect: { goalProgress: 1 } },
      ],
    } };
    const next = chooseEvent(state, "take-step");
    expect(next.playerGoals?.[0]).toMatchObject({ status: "completed", progress: 8, completedWeek: 1 });
    expect(next.log[0]).toContain("목표를 이루었다");
  });

  it("keeps generated NPC names consistent with gender and repairs old mismatched names", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const contacts = generateContacts("student", seed);
      expect(contacts.every((person) => normalizeContactName(person.name, person.gender!, seed) === person.name)).toBe(true);
    }
    expect(normalizeContactName("김서준", "여성", 42)).not.toBe("김서준");
    expect(normalizeContactName("박하은", "남성", 42)).not.toBe("박하은");
    expect(normalizeContactName("김지우", "여성", 42)).toBe("김지우");
  });

  it("creates twelve stable contacts for the selected background", () => {
    const first = generateContacts("student", 12345);
    const second = generateContacts("student", 12345);
    expect(first).toHaveLength(12);
    expect(first).toEqual(second);
    expect(new Set(first.map((contact) => contact.id)).size).toBe(12);
    expect(first.every((contact) => contact.age && contact.occupation && contact.personality && contact.goal)).toBe(true);
    expect(first.every((contact) => !contact.portraitId && !contact.portraitAgeBand)).toBe(true);
  });

  it("varies the starting social circle by game seed while keeping a few grounding relationships", () => {
    const first = generateContacts("student", 10101);
    const replay = generateContacts("student", 10101);
    const newLife = generateContacts("student", 20202);
    expect(first).toEqual(replay);
    expect(newLife.map((person) => person.role)).not.toEqual(first.map((person) => person.role));
    expect(first.some((person) => /가족/.test(person.role))).toBe(true);
    expect(first.some((person) => /친구/.test(person.role))).toBe(true);
    expect(new Set(first.map((person) => person.role)).size).toBe(12);
  });

  it("builds a reproducible NPC social web and evolves ties independently over time", () => {
    const started = createGame(character, 6251);
    const replay = createGame(character, 6251);
    expect(started.npcRelationships).toEqual(replay.npcRelationships);
    expect(createInitialNPCRelationships(started.contacts, 6251)).toEqual(started.npcRelationships);
    expect(started.npcRelationships!.length).toBeGreaterThan(0);
    expect(new Set(started.npcRelationships!.map((link) => link.id)).size).toBe(started.npcRelationships!.length);
    const pair = started.npcRelationships![0];
    const oneTie = [{ ...pair, warmth: 50, kind: "friend" as const }];
    const resolveWithSeed = (seed: number) => advanceDay({
      ...started, week: 2, day: 7, seed, phase: "playing", npcRelationships: oneTie,
      evaluatedDays: [1, 2, 3, 4, 5, 6, 7],
    });
    const changingSeed = Array.from({ length: 300 }, (_, index) => index + 1)
      .find((seed) => resolveWithSeed(seed).npcRelationships?.[0].warmth !== 50);
    expect(changingSeed).toBeDefined();
    expect(resolveWithSeed(changingSeed!)).toEqual(resolveWithSeed(changingSeed!));
  });

  it("turns NPC bond, conflict, and reconciliation states into voiced events that change their relationship", () => {
    const started = createGame(character, 30411);
    const link = started.npcRelationships![0];
    const stateFor = (warmth: number, lastInteractionWeek: number) => ({
      ...started, week: 8,
      npcRelationships: [{ ...link, warmth, lastInteractionWeek }],
    });
    const conflict = getNpcRelationshipEvents(stateFor(20, 2))[0];
    expect(conflict.npcPair?.kind).toBe("conflict");
    expect(conflict.npcDialogue?.line.length).toBeGreaterThan(10);
    const conflictResolved = chooseEvent({ ...stateFor(20, 2), phase: "event", pendingEvent: conflict }, conflict.choices[0].id);
    expect(conflictResolved.npcRelationships?.[0].warmth).toBe(30);
    expect(conflictResolved.contacts.filter((person) => person.id === link.contactAId || person.id === link.contactBId).every((person) => person.memories?.[0].text === conflict.choices[0].result)).toBe(true);

    expect(getNpcRelationshipEvents(stateFor(35, 7))[0].npcPair?.kind).toBe("reconciliation");
    expect(getNpcRelationshipEvents(stateFor(82, 3))[0].npcPair?.kind).toBe("bond");
    expect(getNpcRelationshipEvents(stateFor(55, 3))).toHaveLength(0);

    const romanceState = started.npcRelationships!.map((candidate) => ({
      ...started, week: 8,
      npcRelationships: [{ ...candidate, kind: "friend" as const, warmth: 82, romanceStatus: undefined }],
    })).find((state) => getNpcRelationshipEvents(state)[0]?.npcPair?.kind === "romance");
    expect(romanceState).toBeDefined();
    const romance = getNpcRelationshipEvents(romanceState!)[0];
    expect(romance.title).toContain("마음");
    const dating = chooseEvent({ ...romanceState!, phase: "event", pendingEvent: romance }, romance.choices[0].id);
    expect(dating.npcRelationships?.[0].romanceStatus).toBe("dating");
    expect(getNpcRelationshipEvents(dating)).toHaveLength(0);
  });

  it("adapts authored scenes to the NPC involved and remembers the player's response", () => {
    const started = createGame(character, 55192);
    const scene = eventLibrary.student.find((event) => event.id === "student-team")!;
    const involved = personalizeAuthoredEvent(scene, started);
    const contact = started.contacts[0];
    expect(involved.npcDialogue?.speakerName).toBe(contact.name);
    expect(involved.body).toContain(contact.goal);
    expect(involved.choices[0].result).toContain(contact.name);

    const resolved = chooseEvent({ ...started, phase: "event", pendingEvent: involved }, involved.choices[0].id);
    expect(resolved.contacts[0].lastInteractionWeek).toBe(started.week);
    expect(resolved.contacts[0].memories?.[0].text).toBe(involved.choices[0].result);
    expect(getEventFamily(scene)).toBe("study");

    const differentVoice = personalizeAuthoredEvent(scene, {
      ...started, contacts: started.contacts.map((person, index) => index === 0 ? { ...person, personality: "낯은 가리지만 마음을 잘 쓰는" } : person),
    });
    expect(differentVoice.npcDialogue?.line).not.toBe(involved.npcDialogue?.line);
  });

  it("provides stable demographic and affiliation details for the protagonist and NPCs", () => {
    const first = createGame(character, 7192);
    const replay = createGame(character, 7192);
    expect(first.character).toMatchObject({ heightCm: replay.character.heightCm, weightKg: replay.character.weightKg });
    expect(first.character.heightCm).toBeGreaterThanOrEqual(153);
    expect(first.character.weightKg).toBeGreaterThan(30);
    expect(first.character.affiliation).toContain("대학생");
    expect(first.contacts.every((person) => person.heightCm && person.weightKg && person.affiliation)).toBe(true);
    expect(generateBodyMetrics("남성", 7192, 181).heightCm).toBe(181);
    expect(getPlayerAffiliation({ ...character, affiliation: "서울대학교 경영학과" })).toBe("서울대학교 경영학과");
    expect(getContactAffiliation("같은 팀 동료", "worker")).toContain("직장");
  });

  it("lets quiet relationships drift organically and keeps the roster uncapped", () => {
    const started = createGame(character, 4455);
    const quiet = started.contacts.map((person) => ({ ...person, warmth: 18, lastInteractionWeek: 1 }));
    const resolveWeek = (seed: number, contacts = quiet, nextContactNumber = 13) => advanceDay({
      ...started, week: 15, day: 7, seed, phase: "playing" as const, contacts, nextContactNumber,
      evaluatedDays: [1, 2, 3, 4, 5, 6, 7],
    });
    const noDeparture = resolveWeek(4455);
    expect(noDeparture.archivedContacts).toHaveLength(0);
    expect(resolveWeek(4455)).toEqual(noDeparture);
    const departureSeed = Array.from({ length: 2048 }, (_, index) => index + 1)
      .find((seed) => (resolveWeek(seed).archivedContacts?.length ?? 0) > 0);
    expect(departureSeed).toBeDefined();
    const departure = resolveWeek(departureSeed!);
    expect(departure.relationshipRecords?.some((record) => record.kind === "departure")).toBe(true);
    expect(departure.contacts.length + (departure.archivedContacts?.length ?? 0)).toBeGreaterThanOrEqual(12);

    const expandedRoster = [
      ...started.contacts.map((person) => ({ ...person, warmth: 100, lastInteractionWeek: 16 })),
      ...started.contacts.slice(0, 3).map((person, index) => ({ ...person, id: `person-extra-${index}`, warmth: 100, firstMetWeek: 15, lastInteractionWeek: 16 })),
    ];
    const resolveExpandedWeek = (seed: number) => advanceDay({
      ...started, week: 16, day: 7, seed, phase: "playing" as const, contacts: expandedRoster, nextContactNumber: 16,
      evaluatedDays: [1, 2, 3, 4, 5, 6, 7],
    });
    const arrival = resolveExpandedWeek(8192);
    expect(arrival.contacts.length).toBe(expandedRoster.length + 1);
    expect(arrival.relationshipRecords?.some((record) => record.kind === "arrival")).toBe(true);
  });

  it("keeps all retired face assets out of new games", () => {
    const first = createGame(character, 48291);
    const second = createGame(character, 48291);
    expect(first.character.portraitId).toBe(second.character.portraitId);
    expect(first.contacts.map((person) => person.portraitId)).toEqual(second.contacts.map((person) => person.portraitId));
    expect(first.character.portraitId).toBeUndefined();
    expect(first.contacts.every((person) => person.portraitId === undefined)).toBe(true);
    expect(portraitCatalog).toHaveLength(0);
    expect(getPortrait("npc-01")).toBeUndefined();
    expect(getPortrait("p-m24-new-07")).toBeUndefined();
  });

  it("offers age- and gender-matched manual faces while excluding identities already used in the save", () => {
    expect(getPortraitCandidates("여성", 25)).toEqual([]);
    expect(getPortraitIdentityId("p-f30-01")).toBeUndefined();
  });

  it("keeps a manually chosen player face and never assigns that visual identity to an NPC", () => {
    const game = createGame({ ...character, portraitId: "p-f30-01" }, 72391);
    expect(game.character.portraitId).toBeUndefined();
    expect(game.contacts.every((person) => person.portraitId === undefined)).toBe(true);
  });

  it("ages the player and NPCs once at each simulated year boundary", () => {
    const state = createGame(character, 72392);
    const next = startNextWeek({ ...state, week: 52, phase: "summary" });
    expect(next.week).toBe(53);
    expect(next.character.age).toBe(character.age + 1);
    expect(next.contacts.every((person, index) => person.age === state.contacts[index].age! + 1)).toBe(true);
    const ordinaryWeek = startNextWeek({ ...state, week: 1, phase: "summary" });
    expect(ordinaryWeek.character.age).toBe(character.age);
  });

  it("reassigns portraits for a new game seed but keeps each save reproducible", () => {
    const first = createGame(character, 48291);
    const replay = createGame(character, 48291);
    const fresh = createGame(character, 918273);
    const portraits = (game: ReturnType<typeof createGame>) => [game.character.portraitId, ...game.contacts.map((person) => person.portraitId)];
    expect(portraits(replay)).toEqual(portraits(first));
    expect(portraits(fresh)).toEqual(portraits(first));
    expect(portraits(first).every((id) => id === undefined)).toBe(true);
  });

  it("keeps all twelve contact portraits unique across a range of seeds", () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const portraits = generateContacts("worker", seed, 28).map((person) => person.portraitId);
      expect(portraits.every((id) => id === undefined)).toBe(true);
    }
  });

  it("provides a broad, unique pool of reviewed events per background", () => {
    const ids = [...commonEventLibrary, ...Object.values(eventLibrary).flat()].map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(60);
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
    expect(next.contacts).toEqual(state.contacts);
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

  it("makes one meaningful daily choice with bounded, persistent stat and relationship effects", () => {
    const base = { ...createGame(character, 777), evaluatedDays: [1] };
    const rested = takeDailyAction(base, "rest");
    expect(rested.stats.energy).toBe(82);
    expect(rested.stats.stress).toBe(19);
    expect(rested.day).toBe(2);
    expect(rested.actionDays).toContain("1-1");
    const alreadyActed = { ...base, actionDays: ["1-1"] };
    expect(takeDailyAction(alreadyActed, "focus")).toBe(alreadyActed);

    const social = takeDailyAction(base, "social");
    expect(social.contacts[1].warmth).toBe(base.contacts[1].warmth + 3);
    expect(social.stats.mood).toBe(base.stats.mood + 4);
    expect(social.log[1]).toContain(base.contacts[1].name);
  });

  it("applies a social action to the selected NPC and records the right memory", () => {
    const base = { ...createGame(character, 777), evaluatedDays: [1] };
    const target = base.contacts[4];
    const other = base.contacts[1];
    const next = takeDailyAction(base, "social", target.id);
    expect(next.contacts[4].warmth).toBe(target.warmth + 3);
    expect(next.contacts[4].memories?.[0].text).toContain(target.name);
    expect(next.contacts[4].goalSupport).toBe((target.goalSupport ?? 0) + 1);
    expect(next.contacts[1].warmth).toBe(other.warmth);
    expect(next.contacts[1].memories).toEqual(other.memories);
    expect(next.log[1]).toContain(target.name);
    expect(next.contacts[4].lastInteractionWeek).toBe(base.week);
    expect(next.weeklyActions?.social).toBe(1);
  });

  it("lets relationship type shape the pace of distance", () => {
    const family = getRelationshipProfile("가족");
    const friend = getRelationshipProfile("오래 알고 지낸 친구");
    const work = getRelationshipProfile("직장 동료");
    const acquaintance = getRelationshipProfile("온라인으로 알게 된 지인");
    expect(family.graceWeeks).toBeGreaterThan(friend.graceWeeks);
    expect(friend.graceWeeks).toBeGreaterThan(work.graceWeeks);
    expect(work.graceWeeks).toBeGreaterThan(acquaintance.graceWeeks);
    expect(family.warmthDrift).toBeLessThan(friend.warmthDrift);
    expect(family.departureMultiplier).toBeLessThan(acquaintance.departureMultiplier);
  });

  it("connects weekly activities to contextual new introductions", () => {
    const base = { ...createGame(character, 322), weeklyActions: { social: 7 }, weeklyMeetingContext: "동네 그림 모임" };
    const result = finishWeek(base);
    expect(result.contacts).toHaveLength(base.contacts.length + 1);
    const newcomer = result.contacts.at(-1)!;
    expect(newcomer.note).toContain("동네 그림 모임");
    expect(result.relationshipRecords?.at(-1)?.text).toContain("동네 그림 모임");
    expect(startNextWeek(result).weeklyActions).toEqual({});
  });

  it("brings a returning NPC back through a hazy-memory reunion conversation", () => {
    const base = createGame(character, 323);
    const person = { ...base.contacts[0], warmth: 22, returnCount: 1, memories: [{ id: "old-memory", text: "함께 동네 축제에 갔다", week: 1, vividness: 0.28 }] };
    const state = { ...base, contacts: [person, ...base.contacts.slice(1)], npcReunionIds: [person.id] };
    const reunion = getNpcReunionEvents(state)[0];
    expect(reunion?.body).toContain("세세한 장면보다 그때의 따뜻함");
    expect(reunion?.body).not.toContain("함께 동네 축제에 갔다");
    const eventState = { ...state, phase: "event" as const, pendingEvent: reunion };
    const next = chooseEvent(eventState, "reunion-memory");
    expect(next.npcReunionIds).toEqual([]);
    expect(next.contacts[0].warmth).toBe(person.warmth + 5);
    expect(next.contacts[0].memories?.[0].text).toContain("천천히 떠올렸다");
  });

  it("lets the player reach out to an archived NPC while preserving bond history", () => {
    const base = createGame(character, 1923);
    const person = { ...base.contacts[0], warmth: 25, historicalBond: 82, archivedWeek: base.week - 20, memories: [{ id: "old-memory", text: "함께 야시장에 갔다", week: 1, vividness: 0.9, emotionalTrace: 0.9, significance: "meaningful" as const }] };
    const state = { ...base, archivedContacts: [person], contacts: base.contacts.slice(1) };
    const next = contactArchivedNpc(state, person.id);
    expect(next.phase).toBe("event");
    expect(next.pendingEvent?.reunion?.contactId).toBe(person.id);
    expect(next.archivedContacts).toEqual([]);
    expect(next.contacts.find((item) => item.id === person.id)?.warmth).toBeGreaterThan(30);
    expect(next.relationshipRecords?.at(-1)?.text).toContain("먼저 안부");
  });

  it("does not let archived-NPC contact skip an event or weekly review", () => {
    const base = createGame(character, 1924);
    const person = { ...base.contacts[0], archivedWeek: base.week - 12 };
    for (const phase of ["event", "summary"] as const) {
      const state = { ...base, phase, archivedContacts: [person], contacts: base.contacts.slice(1) };
      expect(contactArchivedNpc(state, person.id)).toBe(state);
    }
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
      expect(next.actionDays).toEqual([]);
      expect(next.eventLastSeenWeek).toEqual(state.eventLastSeenWeek);
    }
  });

  it("does not bypass the eight-week cooldown when no eligible event remains", () => {
    const started = createGame(character, 662911);
    const eventIds = [...commonEventLibrary, ...Object.values(eventLibrary).flat()].map((event) => event.id);
    const state = {
      ...started,
      week: 2,
      day: 1,
      seenEvents: [],
      eventLastSeenWeek: Object.fromEntries(eventIds.map((id) => [id, 1])),
      eventFamilyLastSeenWeek: {},
      npcStoryStages: Object.fromEntries(started.contacts.map((contact) => [contact.id, 3])),
      npcStoryLastWeek: {},
      npcStoryChoices: {},
      npcReunionIds: [],
      npcRelationships: [],
    };
    const next = advanceDay(state);
    expect(next.phase).toBe("playing");
    expect(next.pendingEvent).toBeUndefined();
    expect(next.day).toBe(2);
  });

  it("avoids repeating authored events inside the eight-week cooldown and rotates story families", () => {
    let state = createGame(character, 662910);
    let choicesMade = 0;
    const familyLastSeen = new Map<string, number>();
    for (let guard = 0; guard < 140 && state.week <= 12; guard += 1) {
      if (state.phase === "event" && state.pendingEvent) {
        const previousWeek = state.eventLastSeenWeek?.[state.pendingEvent.id];
        if (previousWeek !== undefined) expect(state.week - previousWeek).toBeGreaterThanOrEqual(8);
        const family = getEventFamily(state.pendingEvent);
        const lastFamilyWeek = familyLastSeen.get(family);
        if (!(state.pendingEvent.thread && state.pendingEvent.thread.stage > 0) && lastFamilyWeek !== undefined) expect(state.week - lastFamilyWeek).toBeGreaterThanOrEqual(2);
        familyLastSeen.set(family, state.week);
        state = chooseEvent(state, state.pendingEvent.choices[0].id);
        choicesMade += 1;
      } else if (state.phase === "summary") {
        state = startNextWeek(state);
      } else {
        state = advanceDay(state);
      }
    }
    expect(choicesMade).toBeGreaterThan(10);
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
    expect(state.contacts[0].memories?.[0].text).toBe(first.choices.find((choice) => choice.id === "story-plan")?.result);
    expect(state.contacts[0].goalSupport).toBe(2);
  });

  it("gives each NPC independent goal state and reproducible weekly behavior", () => {
    const base = { ...createGame(character, 61024), phase: "summary" as const };
    const weekEnd = { ...base, phase: "playing" as const, day: 7, evaluatedDays: [7] };
    const first = finishWeek(weekEnd);
    const replay = finishWeek(weekEnd);
    expect(replay).toEqual(first);
    expect(first.contacts.length).toBeGreaterThanOrEqual(12);
    expect(first.contacts.every((person) => person.goal && person.goalStage && person.mood && person.lastAutonomousAction)).toBe(true);
    expect(first.contacts.every((person) => (person.goalProgress ?? -1) >= 0 && (person.goalProgress ?? 4) <= 3)).toBe(true);
    expect(first.phase).toBe("summary");
    expect(first.week).toBe(1);
    expect(first.contacts.some((person, index) => person.goalProgress !== weekEnd.contacts[index].goalProgress || person.lastAutonomousAction !== weekEnd.contacts[index].lastAutonomousAction)).toBe(true);
  });

  it("lets player support advance an NPC goal and unlock a goal-aware follow-up", () => {
    const base = createGame(character, 404);
    const contacts = base.contacts.map((person, index) => ({
      ...person,
      warmth: 10,
      goalProgress: index === 0 ? 0 : person.goalProgress,
      goalSupport: index === 0 ? 3 : 0,
    }));
    const next = finishWeek({ ...base, contacts });
    const supported = next.contacts[0];
    expect(supported.goalProgress).toBe(1);
    expect(supported.goalSupport).toBe(2);
    expect(supported.lastAutonomousAction).toContain("네가 건넨 응원");
    expect(getPersonalStoryEvents(next)[0]?.personalStory?.contactId).toBe(supported.id);
    expect(getPersonalStoryEvents(next)[0]?.body).toContain("네가 건넨 응원이");
  });

  it("settles each background's weekly cashflow once and records any shortfall", () => {
    const studentPlan = getWeeklyCashflowPlan({ ...character, housing: "자취" });
    expect(studentPlan).toMatchObject({ income: 220_000, livingExpenses: 155_000, housingExpenses: 130_000, expenses: 285_000, net: -65_000 });
    const seekerPlan = getWeeklyCashflowPlan({ ...character, background: "jobseeker", housing: "자취" });
    const workerPlan = getWeeklyCashflowPlan({ ...character, background: "worker", housing: "가족과 동거" });
    expect(seekerPlan.net).toBeLessThan(0);
    expect(workerPlan.net).toBeGreaterThan(0);

    const base = createGame(character, 501);
    const atWeekEnd = { ...base, day: 7, evaluatedDays: [7], stats: { ...base.stats, money: 300_000 } };
    const summary = advanceDay(atWeekEnd);
    expect(summary.phase).toBe("summary");
    expect(summary.stats.money).toBe(300_000 + studentPlan.net);
    expect(summary.weeklyCashflow).toMatchObject({ week: 1, income: 220_000, expenses: 285_000, endingBalance: 235_000 });
    const nextWeek = startNextWeek(summary);
    expect(nextWeek.stats.money).toBe(summary.stats.money);
    expect(nextWeek.weeklyCashflow).toEqual(summary.weeklyCashflow);

    const brokeSeeker = createGame({ ...character, background: "jobseeker", housing: "자취" }, 502);
    const shortfall = advanceDay({ ...brokeSeeker, day: 7, evaluatedDays: [7], stats: { ...brokeSeeker.stats, money: 0, stress: 20 } });
    expect(shortfall.stats.money).toBe(0);
    expect(shortfall.weeklyCashflow?.unpaidExpenses).toBe(seekerPlan.expenses - seekerPlan.income);
    expect(shortfall.stats.stress).toBe(25);
  });

  it("makes non-worker housing costs survivable through a visible paid daily action", () => {
    const studentFamily = getWeeklyCashflowPlan({ ...character, housing: "가족과 동거" });
    const studentSolo = getWeeklyCashflowPlan({ ...character, housing: "자취" });
    const seekerFamily = getWeeklyCashflowPlan({ ...character, background: "jobseeker", housing: "가족과 동거" });
    const seekerSolo = getWeeklyCashflowPlan({ ...character, background: "jobseeker", housing: "자취" });
    expect(studentFamily.net).toBe(65_000);
    expect(studentSolo.net).toBe(-65_000);
    expect(seekerFamily.net).toBe(0);
    expect(seekerSolo.net).toBe(-130_000);
    expect(Math.ceil(-studentSolo.net / 40_000)).toBe(2);
    expect(Math.ceil(-seekerSolo.net / 45_000)).toBe(3);

    const base = { ...createGame({ ...character, housing: "자취" }, 991), evaluatedDays: [1, 2, 3, 4, 5, 6, 7] };
    const earned = takeDailyAction(base, "earn");
    expect(earned.stats.money).toBe(base.stats.money + 40_000);
    expect(earned.stats.energy).toBe(base.stats.energy - 5);
    expect(earned.log).toContain("단기 아르바이트를 했다");
    const capped = takeDailyAction({ ...base, weeklyActions: { earn: 4 } }, "earn");
    expect(capped.weeklyActions?.earn).toBe(4);
    expect(capped.stats.money).toBe(base.stats.money);
  });

  it("keeps student and jobseeker cashflow solvent for a year with a reasonable work schedule", () => {
    const runYear = (background: "student" | "jobseeker", housing: string, shifts: number, seed: number) => {
      let state = createGame({ ...character, background, housing }, seed);
      for (let week = 0; week < 52; week += 1) {
        state = { ...state, evaluatedDays: [1, 2, 3, 4, 5, 6, 7] };
        while (state.phase === "playing") state = state.day <= shifts ? takeDailyAction(state, "earn") : advanceDay(state);
        expect(state.weeklyCashflow?.unpaidExpenses).toBe(0);
        state = startNextWeek(state);
      }
      return state;
    };
    expect(runYear("student", "가족과 동거", 0, 301).stats.money).toBeGreaterThan(0);
    expect(runYear("student", "자취", 2, 302).stats.money).toBeGreaterThan(0);
    expect(runYear("jobseeker", "가족과 동거", 0, 303).stats.money).toBeGreaterThan(0);
    expect(runYear("jobseeker", "자취", 3, 304).stats.money).toBeGreaterThan(0);
  });

  it("keeps a story open for as long as the player wants and closes only on request", () => {
    let state = createGame(character, 992);
    const root = commonEventLibrary.find((event) => event.id === "common-misunderstanding")!;
    state = chooseEvent({ ...state, phase: "event", pendingEvent: root }, "misunderstanding-ignore");
    expect(state.eventThreads?.["relationship-repair"]).toMatchObject({ route: "misunderstanding-ignore", stage: 1, nextWeek: 2 });

    let followUp = getEventThreadEvents({ ...state, week: 2 })[0];
    expect(followUp.title).toContain("먼저 연락");
    state = chooseEvent({ ...state, week: 2, phase: "event", pendingEvent: followUp }, "repair-listen");
    expect(state.eventThreads?.["relationship-repair"]).toMatchObject({ route: "misunderstanding-ignore", stage: 2, nextWeek: 3 });

    followUp = getEventThreadEvents({ ...state, week: 3 })[0];
    expect(followUp.thread).toEqual({ id: "relationship-repair", stage: 2 });
    state = chooseEvent({ ...state, week: 3, phase: "event", pendingEvent: followUp }, "repair-close");
    expect(state.eventThreads?.["relationship-repair"]).toMatchObject({ stage: 3, nextWeek: 4 });

    for (let stage = 3; stage <= 8; stage += 1) {
      followUp = getEventThreadEvents({ ...state, week: stage + 1 })[0];
      expect(followUp.thread).toEqual({ id: "relationship-repair", stage });
      expect(followUp.eyebrow).toContain("이어지는 이야기");
      state = chooseEvent({ ...state, week: stage + 1, phase: "event", pendingEvent: followUp }, "thread-step-relationship-repair-" + stage + "-act");
      expect(state.eventThreads?.["relationship-repair"]?.stage).toBe(stage + 1);
    }

    followUp = getEventThreadEvents({ ...state, week: 10 })[0];
    const ending = followUp.choices.find((choice) => choice.id === "thread-finish-relationship-repair")!;
    state = chooseEvent({ ...state, week: 10, phase: "event", pendingEvent: followUp }, ending.id);
    expect(state.eventThreads?.["relationship-repair"]).toBeUndefined();
    expect(state.contacts[1].warmth).toBeGreaterThan(createGame(character, 992).contacts[1].warmth);
  });

  it("offers more connected relationship, family, hobby and mentorship story starters", () => {
    const routeIds = commonEventLibrary.filter((event) => event.thread?.stage === 0).map((event) => event.thread!.id);
    expect(routeIds).toEqual(expect.arrayContaining(["shared-project", "old-friend", "family-plan", "hobby-project", "career-mentor", "romance-route"]));
    expect(new Set(routeIds).size).toBe(routeIds.length);
  });

  it("turns a date into an open-ended romance route with grammatical Korean names", () => {
    let state = createGame(character, 993);
    state = { ...state, contacts: state.contacts.map((person, index) => index === 1 ? { ...person, name: "이민서" } : person) };
    const root = commonEventLibrary.find((event) => event.id === "common-date-plan")!;
    state = chooseEvent({ ...state, phase: "event", pendingEvent: root }, "date-simple");
    expect(state.eventThreads?.["romance-route"]).toMatchObject({ route: "date-simple", stage: 1 });

    let scene = getEventThreadEvents({ ...state, week: 2 })[0];
    expect(scene.title).toContain("편안해서");
    state = chooseEvent({ ...state, week: 2, phase: "event", pendingEvent: scene }, "romance-second-date");
    scene = getEventThreadEvents({ ...state, week: 3 })[0];
    expect(scene.title).toContain("두 번째 만남");
    state = chooseEvent({ ...state, week: 3, phase: "event", pendingEvent: scene }, "romance-talk-rhythm");

    for (let stage = 3; stage <= 6; stage += 1) {
      scene = getEventThreadEvents({ ...state, week: stage + 1 })[0];
      expect(scene.thread).toEqual({ id: "romance-route", stage });
      expect(scene.eyebrow).toContain("이어지는 이야기");
      const copy = [scene.title, scene.body, scene.npcDialogue?.line, ...scene.choices.map((choice) => choice.result)].join(" ");
      expect(copy).not.toMatch(/이민서(?:은|과|이)(?![가-힣])/);
      state = chooseEvent({ ...state, week: stage + 1, phase: "event", pendingEvent: scene }, `thread-step-romance-route-${stage}-act`);
      expect(state.eventThreads?.["romance-route"]?.stage).toBe(stage + 1);
    }

    scene = getEventThreadEvents({ ...state, week: 8 })[0];
    const ending = scene.choices.find((choice) => choice.id === "thread-finish-romance-route")!;
    state = chooseEvent({ ...state, week: 8, phase: "event", pendingEvent: scene }, ending.id);
    expect(state.eventThreads?.["romance-route"]).toBeUndefined();
  });

  it("records social memories and fades them gradually at weekly boundaries", () => {
    const base = { ...createGame(character, 777), evaluatedDays: [1] };
    const social = takeDailyAction(base, "social");
    const contact = social.contacts[1];
    expect(contact.memories?.[0].text).toContain(contact.name);
    expect(contact.memories?.[0].vividness).toBe(1);
    const nextWeek = finishWeek(social);
    expect(nextWeek.contacts[1].memories?.[0].vividness).toBeCloseTo(0.94);
  });

  it("moves a completed NPC goal forward without repeating the completion log", () => {
    const base = {
      ...createGame(character, 1),
      phase: "summary" as const,
      contacts: createGame(character, 1).contacts.map((person) => ({ ...person, goalProgress: 2, goalStage: "마무리 준비" })),
    };
    let completed: { name: string; goal: string; result: ReturnType<typeof startNextWeek> } | undefined;
    for (let seed = 1; seed < 80 && !completed; seed += 1) {
      const result = finishWeek({ ...base, phase: "playing", day: 7, evaluatedDays: [7], seed });
      const person = result.contacts.find((contact, index) => contact.goal !== base.contacts[index].goal);
      if (person) completed = { name: person.name, goal: base.contacts.find((contact) => contact.id === person.id)!.goal!, result };
    }
    expect(completed).toBeDefined();
    const line = `${completed!.name}이(가) “${completed!.goal}”에서 한 단계를 마쳤어요.`;
    expect(completed!.result.log.filter((entry) => entry === line)).toHaveLength(1);
    const following = finishWeek({ ...completed!.result, phase: "playing", day: 7, evaluatedDays: [7], week: 2 });
    expect(following.log.filter((entry) => entry === line)).toHaveLength(1);
  });
});


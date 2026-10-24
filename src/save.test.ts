import { describe, expect, it } from "vitest";
import { advanceDay, chooseEvent, createGame, startNextWeek, type Character } from "./game";
import { lifeDate, withKoreanParticle } from "./korean";
import { parseSave } from "./save";

const character: Character = { name: "민서", age: 27, year: 2024, background: "jobseeker", gender: "여성", region: "서울", housing: "자취" };

describe("save compatibility and recovery", () => {
  it("migrates v1 without losing the pending event, route, identity or NPC memory", () => {
    const base = createGame(character, 63);
    const event = { id: "saved-event", eyebrow: "생활", title: "약속", body: "사건", choices: [{ id: "yes", title: "선택", detail: "", result: "결과", effect: { money: 10, relationship: 3 }, contactId: base.contacts[0].id }] };
    const legacy = { ...base, version: 1, phase: "event", pendingEvent: event, eventThreads: { route: { route: "yes", stage: 3, nextWeek: 4 } }, contacts: base.contacts.map((person, i) => i ? person : { ...person, portraitId: "saved-canonical-id", memories: [{ id: "m1", text: "약속", week: 1, vividness: 1 }] }) };
    const migrated = parseSave(JSON.parse(JSON.stringify(legacy)));
    expect(migrated.version).toBe(4);
    expect(migrated.economy?.employment.status).toBe("seeking");
    expect(migrated.pendingEvent).toEqual(event);
    expect(migrated.eventThreads?.route.stage).toBe(3);
    expect(migrated.contacts[0].portraitId).toBe("saved-canonical-id");
    expect(migrated.contacts[0].memories?.[0].text).toBe("약속");
    const chosen = chooseEvent(migrated, "yes");
    expect(chosen.stats.money).toBe(migrated.stats.money + 10);
    expect(chooseEvent(chosen, "yes")).toBe(chosen);
  });

  it("rejects broken pending events without silently clearing the save", () => {
    expect(() => parseSave({ ...createGame(character, 7), phase: "event", pendingEvent: undefined })).toThrow(/사건/);
    expect(() => parseSave({ ...createGame(character, 7), stats: { money: NaN } })).toThrow(/손상/);
  });

  it("carries unpaid obligations once without double counting earned action income", () => {
    const base = { ...createGame({ ...character, startingMoney: 0 }, 7), economy: undefined };
    const first = advanceDay({ ...base, day: 7, evaluatedDays: [7] });
    expect(first.weeklyCashflow?.unpaidExpenses).toBe(130_000);
    const same = advanceDay(first);
    expect(same).toBe(first);
    const second = advanceDay({ ...startNextWeek(first), day: 7, evaluatedDays: [7] });
    expect(second.weeklyCashflow?.openingUnpaidExpenses).toBe(130_000);
    expect(second.weeklyCashflow?.unpaidExpenses).toBe(260_000);
  });

  it("labels calendar boundaries and Korean particles consistently", () => {
    expect(lifeDate(2024, 53, 7).getFullYear()).toBe(2025);
    expect(withKoreanParticle("민서", "subject")).toBe("민서가");
    expect(withKoreanParticle("지훈", "and")).toBe("지훈과");
  });
});

import { describe, expect, it } from "vitest";
import { advanceDay, careerTransition, createGame, debtAction, startNextWeek, type Character } from "./game";
import { migrateEconomy } from "./economy";
import { parseSave } from "./save";

const worker: Character = { name: "호진", age: 30, year: 2024, background: "worker", gender: "남성", region: "서울", housing: "가족과 동거" };
const endWeek = (state: ReturnType<typeof createGame>) => advanceDay({ ...state, day: 7, evaluatedDays: [7], phase: "playing" });

describe("monthly economy and career", () => {
  it("pays a monthly salary once on its due week and writes an idempotent ledger entry", () => {
    const state = { ...createGame({ ...worker, startingMoney: 0 }, 9), week: 4 };
    const summary = endWeek(state);
    expect(summary.weeklyCashflow).toMatchObject({ week: 4, income: 2_400_000, expenses: 340_000, endingBalance: 2_060_000 });
    expect(summary.economy?.transactions.filter((entry) => entry.id === "salary:202401")).toHaveLength(1);
    expect(advanceDay(summary)).toBe(summary);
    const next = endWeek({ ...startNextWeek(summary), week: 5 });
    expect(next.economy?.transactions.filter((entry) => entry.id === "salary:202401")).toHaveLength(1);
  });

  it("moves from unemployment through employment, promotion and resignation by state", () => {
    const original = createGame({ ...worker, background: "jobseeker" }, 5);
    const hired = careerTransition(original, "apply");
    expect(hired.economy?.employment.status).toBe("employed");
    expect(careerTransition(hired, "apply")).toBe(hired);
    const experienced = { ...hired, week: 20, economy: { ...hired.economy!, employment: { ...hired.economy!.employment, tenureWeeks: 18 } } };
    const promoted = careerTransition(experienced, "promote");
    expect(promoted.economy?.employment.monthlySalary).toBeGreaterThan(hired.economy!.employment.monthlySalary);
    const resigned = careerTransition({ ...promoted, week: 25 }, "resign");
    expect(resigned.economy?.employment.monthlySalary).toBe(0);
  });

  it("records borrowed cash and principal once; migrates a legacy save at the next month", () => {
    const state = createGame(worker, 3);
    const borrowed = debtAction(state, "borrow");
    expect(borrowed.stats.money - state.stats.money).toBe(1_000_000);
    expect(borrowed.economy?.debt).toBe(1_000_000);
    expect(debtAction(borrowed, "borrow")).toBe(borrowed);
    const repaid = debtAction(borrowed, "repay");
    expect(repaid.economy?.debt).toBe(900_000);
    const legacy = parseSave({ ...state, version: 2, economy: undefined, week: 4 });
    expect(legacy.economy?.activationMonth).toBe(migrateEconomy(worker, 4).activationMonth);
    expect(legacy.economy?.activationMonth).toBe(202402);
  });
});

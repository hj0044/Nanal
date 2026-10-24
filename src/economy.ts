import type { Character, GameState } from "./game";
import { lifeDate } from "./korean";

export interface Employment {
  status: "student" | "seeking" | "employed" | "unemployed";
  employer?: string;
  role?: string;
  tenureWeeks: number;
  monthlySalary: number;
  lastTransitionWeek?: number;
}
export interface Transaction {
  id: string;
  week: number;
  category: "salary" | "support" | "living" | "housing" | "debt" | "extra" | "event" | "loan";
  amount: number;
  label: string;
}
export interface Economy {
  employment: Employment;
  debt: number;
  monthlyDebtPayment: number;
  transactions: Transaction[];
  /** Legacy weekly wages stay active until the next month begins. */
  activationMonth: number;
}

export const monthKey = (date: Date): number => date.getFullYear() * 100 + date.getMonth() + 1;

export function initialEconomy(character: Character, activationMonth = character.year * 100 + 1): Economy {
  const status: Employment["status"] = character.background === "worker" ? "employed" : character.background === "student" ? "student" : "seeking";
  return {
    employment: { status, employer: status === "employed" ? (character.affiliation || "현재 직장") : undefined, role: status === "employed" ? "실무 담당" : undefined, tenureWeeks: 0, monthlySalary: status === "employed" ? 2_400_000 : 0 },
    debt: 0, monthlyDebtPayment: 0, transactions: [], activationMonth,
  };
}

export function migrateEconomy(character: Character, week: number): Economy {
  const date = lifeDate(character.year, week, 7);
  return initialEconomy(character, monthKey(new Date(date.getFullYear(), date.getMonth() + 1, 1)));
}

export function calendarWeekIncludes(character: Character, week: number, dayOfMonth: number): Date | undefined {
  const first = lifeDate(character.year, week, 1);
  const last = lifeDate(character.year, week, 7);
  const candidate = new Date(first.getFullYear(), first.getMonth(), dayOfMonth);
  if (candidate >= first && candidate <= last) return candidate;
  const next = new Date(last.getFullYear(), last.getMonth(), dayOfMonth);
  return next >= first && next <= last ? next : undefined;
}

export function careerTransition(state: GameState, action: "apply" | "promote" | "resign" | "switch"): GameState {
  const economy = state.economy;
  if (!economy || state.phase !== "playing" || (economy.employment.lastTransitionWeek ?? -100) > state.week - 4) return state;
  const career = economy.employment;
  let next: Employment;
  let message: string;
  if (action === "apply" && career.status !== "employed") {
    // A stable focus threshold keeps the same save and choice fully reproducible.
    if (state.stats.focus < 40) return { ...state, economy: { ...economy, employment: { ...career, lastTransitionWeek: state.week } }, log: ["지원서를 냈지만 준비가 부족해 채용으로 이어지지 않았다.", ...state.log] };
    next = { status: "employed", employer: "새 직장", role: "신입 담당", tenureWeeks: 0, monthlySalary: Math.max(2_200_000, career.monthlySalary), lastTransitionWeek: state.week };
    message = "새 직장에 입사했다. 첫 급여일부터 월급을 받는다.";
  } else if (action === "promote" && career.status === "employed" && career.tenureWeeks >= 12) {
    next = { ...career, role: "선임 담당", monthlySalary: Math.round(career.monthlySalary * 1.1 / 10_000) * 10_000, lastTransitionWeek: state.week };
    message = `승진해 월급이 ${next.monthlySalary.toLocaleString("ko-KR")}원으로 올랐다.`;
  } else if (action === "switch" && career.status === "employed" && career.tenureWeeks >= 8) {
    next = { ...career, employer: "이직한 직장", role: "경력 담당", tenureWeeks: 0, monthlySalary: Math.round(career.monthlySalary * 1.15 / 10_000) * 10_000, lastTransitionWeek: state.week };
    message = `이직해 ${next.employer}에서 일하기 시작했다. 월급은 ${next.monthlySalary.toLocaleString("ko-KR")}원이다.`;
  } else if (action === "resign" && career.status === "employed") {
    next = { ...career, status: "unemployed", employer: undefined, role: undefined, monthlySalary: 0, tenureWeeks: 0, lastTransitionWeek: state.week };
    message = "퇴사했다. 다음 급여일부터 급여 지급이 중단된다.";
  } else return state;
  return { ...state, economy: { ...economy, employment: next }, stats: { ...state.stats, mood: Math.max(0, Math.min(100, state.stats.mood + (action === "resign" ? -4 : 4))) }, log: [message, ...state.log] };
}

export function debtAction(state: GameState, action: "borrow" | "repay"): GameState {
  const economy = state.economy;
  if (!economy || state.phase !== "playing") return state;
  const amount = action === "borrow" ? 1_000_000 : Math.min(100_000, economy.debt, state.stats.money);
  if (!amount || (action === "borrow" && economy.debt > 9_000_000)) return state;
  const id = `${action}:${state.week}:${state.day}`;
  if (economy.transactions.some((entry) => entry.id === id)) return state;
  const debt = economy.debt + (action === "borrow" ? amount : -amount);
  return {
    ...state,
    stats: { ...state.stats, money: state.stats.money + (action === "borrow" ? amount : -amount) },
    economy: { ...economy, debt, monthlyDebtPayment: debt ? Math.max(economy.monthlyDebtPayment, 100_000) : 0,
      transactions: [...economy.transactions, { id, week: state.week, category: action === "borrow" ? "loan" : "debt", amount: action === "borrow" ? amount : -amount, label: action === "borrow" ? "생활자금 대출" : "추가 상환" }] },
    log: [action === "borrow" ? "생활자금 100만원을 빌렸다. 매월 상환할 금액이 생겼다." : `${amount.toLocaleString("ko-KR")}원을 추가 상환했다.`, ...state.log],
  };
}

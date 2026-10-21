export type Background = "student" | "jobseeker" | "worker";
export type ActionId = "study" | "work" | "connect" | "rest" | "exercise" | "search";
export type TabId = "life" | "people" | "growth" | "assets" | "record";

export interface Memory {
  text: string;
  week: number;
  vividness: number;
}
export interface Goal {
  title: string;
  progress: number;
  stage: string;
}
export interface NPC {
  id: string;
  name: string;
  age: number;
  role: string;
  affinity: number;
  trust: number;
  mood: string;
  goal: Goal;
  memories: Memory[];
  lastAction: string;
}
export interface Choice {
  id: string;
  label: string;
  hint: string;
  effects: { cash?: number; energy?: number; stress?: number; skill?: number; target?: string; affinity?: number; trust?: number };
  result: string;
}
export interface StoryEvent {
  id: string;
  title: string;
  dateLabel: string;
  body: string;
  actorId?: string;
  choices: Choice[];
}
export interface LogEntry {
  id: string;
  week: number;
  category: string;
  text: string;
}
export interface GameState {
  version: 1;
  id: string;
  seed: number;
  rngState: number;
  name: string;
  age: number;
  year: number;
  background: Background;
  playerGoal: string;
  cash: number;
  energy: number;
  stress: number;
  skill: number;
  week: number;
  actionsLeft: number;
  pendingEvent: StoryEvent | null;
  npcs: NPC[];
  log: LogEntry[];
  lastWeekSummary: string[];
}

export const BACKGROUNDS: Record<Background, { label: string; intro: string; goal: string }> = {
  student: { label: "대학생", intro: "수업과 생활비, 사람들 사이에서 이번 학기의 리듬을 찾아가는 중입니다.", goal: "학업과 생활의 균형 잡기" },
  jobseeker: { label: "취업준비생", intro: "준비를 이어가면서 생활비와 다음 기회를 함께 고민하고 있습니다.", goal: "나에게 맞는 일 찾기" },
  worker: { label: "직장인", intro: "일의 책임과 퇴근 뒤의 삶을 어떻게 나눌지 생각하는 시기입니다.", goal: "일과 생활의 균형 만들기" },
};

export const ACTIONS: { id: ActionId; title: string; detail: string; icon: string }[] = [
  { id: "study", title: "배움에 집중하기", detail: "기술과 준비도를 쌓아요", icon: "✎" },
  { id: "work", title: "일과 수입 챙기기", detail: "현금 여유를 만들어요", icon: "₩" },
  { id: "connect", title: "누군가와 시간 보내기", detail: "관계를 돌보고 소식을 들어요", icon: "♡" },
  { id: "rest", title: "쉬어가기", detail: "에너지를 회복하고 긴장을 낮춰요", icon: "☁" },
  { id: "exercise", title: "몸과 마음 돌보기", detail: "에너지를 조금 쓰고 스트레스를 풀어요", icon: "⌁" },
  { id: "search", title: "기회 찾아보기", detail: "공고·모임·새로운 가능성을 살펴봐요", icon: "⌕" },
];

const EVENTS: Record<Background, StoryEvent[]> = {
  student: [{
    id: "student-teamwork", title: "팀 과제, 역할을 나눌 시간", dateLabel: "월요일 · 학교",
    body: "단체 채팅방에 과제 역할을 정하자는 메시지가 올라왔어요. 민지가 먼저 자료 조사를 맡겠다고 했고, 발표 파트가 비어 있습니다.",
    actorId: "minji",
    choices: [
      { id: "lead", label: "발표까지 맡아 흐름을 잡는다", hint: "성과 기회가 커지지만 이번 주가 바빠질 수 있어요.", effects: { energy: -12, stress: 8, skill: 5, target: "minji", trust: 4 }, result: "민지가 믿음직하다고 했어요. 발표 준비가 이번 주 일정에 추가됐습니다." },
      { id: "coordinate", label: "각자 가능한 일을 먼저 조율한다", hint: "부담을 나누고 협업의 기준을 만들어요.", effects: { energy: -5, stress: 2, target: "minji", affinity: 1, trust: 2 }, result: "역할이 정리됐어요. 민지는 서로 무리하지 않는 게 좋다고 했습니다." },
      { id: "limit", label: "가능한 범위를 솔직히 말한다", hint: "시간을 지키는 대신 상대의 반응은 상황에 따라 달라져요.", effects: { energy: 2, stress: -3, target: "minji", affinity: -1 }, result: "맡은 일은 줄었어요. 민지는 조금 아쉬워했지만 상황은 이해했습니다." },
    ],
  }],
  jobseeker: [{
    id: "jobseeker-posting", title: "친구가 채용 정보를 보내왔어요", dateLabel: "화요일 · 메신저",
    body: "도윤이가 관심 분야와 맞아 보이는 공고를 공유했어요. 마감까지 열흘 남았고, 요구하는 기술 중 하나는 아직 익숙하지 않습니다.",
    actorId: "doyun",
    choices: [
      { id: "apply", label: "공고를 자세히 보고 지원을 준비한다", hint: "기회를 놓치지 않지만 준비 시간이 필요해요.", effects: { stress: 5, skill: 2, target: "doyun", trust: 2 }, result: "공고를 저장하고 준비할 항목을 적었어요. 도윤이는 다음에도 정보를 보내겠다고 했습니다." },
      { id: "ask", label: "도윤이에게 회사 분위기를 물어본다", hint: "지원 판단에 필요한 정보를 얻어요.", effects: { energy: -3, target: "doyun", affinity: 1, trust: 4 }, result: "도윤이는 아는 선에서 정보를 알려줬어요. 공고에 적히지 않은 점도 확인할 수 있었습니다." },
      { id: "prepare", label: "부족한 기술부터 보완한다", hint: "당장 지원은 미루지만 준비도가 올라가요.", effects: { skill: 5, energy: -8, stress: 2 }, result: "기초 학습을 시작했어요. 마감 전까지 준비를 더 이어갈 수 있습니다." },
    ],
  }],
  worker: [{
    id: "worker-priority", title: "퇴근 직전, 새 업무가 들어왔어요", dateLabel: "수요일 · 회사",
    body: "동료 준호가 급한 자료 정리를 부탁했어요. 오늘 맡으면 팀은 편해지지만, 이번 주에 이미 진행 중인 일이 있습니다.",
    actorId: "junho",
    choices: [
      { id: "take", label: "내가 맡아 오늘 마무리한다", hint: "팀을 돕지만 에너지와 퇴근 시간이 줄어요.", effects: { energy: -14, stress: 8, skill: 2, target: "junho", trust: 5 }, result: "준호는 고맙다고 했어요. 퇴근은 늦어졌지만 팀의 급한 일을 넘겼습니다." },
      { id: "prioritize", label: "기존 업무와 마감 순서를 조율한다", hint: "업무 기대와 일정을 함께 맞춰요.", effects: { energy: -4, stress: 1, target: "junho", trust: 2 }, result: "우선순위가 정리됐어요. 준호는 일정을 공유해줘서 도움이 됐다고 했습니다." },
      { id: "boundary", label: "오늘은 어렵다고 말하고 대안을 찾는다", hint: "내 시간을 지키고 협력 가능한 범위를 제안해요.", effects: { energy: 2, stress: -3, target: "junho", affinity: -1 }, result: "준호는 다른 방법을 찾아보기로 했어요. 약간 미안했지만 오늘 일정을 지켰습니다." },
    ],
  }],
};

const NPC_SEEDS: Record<Background, Omit<NPC, "memories" | "lastAction">[]> = {
  student: [
    { id: "minji", name: "민지", age: 24, role: "같은 수업을 듣는 동기", affinity: 1, trust: 52, mood: "바쁜 편", goal: { title: "이번 학기 과제 잘 마치기", progress: 1, stage: "일정 정리" } },
    { id: "seojun", name: "서준", age: 25, role: "동아리 선배", affinity: 0, trust: 48, mood: "여유로움", goal: { title: "동아리 행사 준비하기", progress: 0, stage: "사람 모으기" } },
    { id: "family", name: "가족", age: 54, role: "가까운 가족", affinity: 2, trust: 70, mood: "평소와 같음", goal: { title: "주말에 안부 나누기", progress: 1, stage: "연락하기" } },
  ],
  jobseeker: [
    { id: "doyun", name: "도윤", age: 27, role: "함께 준비하는 친구", affinity: 1, trust: 55, mood: "기회를 찾는 중", goal: { title: "관심 분야 공고 찾기", progress: 1, stage: "정보 모으기" } },
    { id: "yuna", name: "유나", age: 26, role: "스터디에서 만난 친구", affinity: 0, trust: 50, mood: "집중하는 중", goal: { title: "자격 시험 준비하기", progress: 1, stage: "학습 계획" } },
    { id: "family", name: "가족", age: 55, role: "가까운 가족", affinity: 2, trust: 68, mood: "걱정과 응원", goal: { title: "서로의 생활을 챙기기", progress: 0, stage: "안부 묻기" } },
  ],
  worker: [
    { id: "junho", name: "준호", age: 30, role: "같은 팀 동료", affinity: 0, trust: 54, mood: "업무가 몰림", goal: { title: "이번 분기 업무 안정시키기", progress: 1, stage: "우선순위 정리" } },
    { id: "sora", name: "소라", age: 29, role: "오래된 친구", affinity: 1, trust: 58, mood: "약속을 기다리는 중", goal: { title: "오랜만에 친구들 만나기", progress: 0, stage: "날짜 잡기" } },
    { id: "family", name: "가족", age: 58, role: "가까운 가족", affinity: 2, trust: 72, mood: "평소와 같음", goal: { title: "주말에 식사 함께하기", progress: 1, stage: "일정 확인" } },
  ],
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
function seedFrom(text: string) {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0 || 1;
}
function draw(state: GameState) {
  state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}
function nextEvent(state: GameState): StoryEvent | null {
  const candidates = EVENTS[state.background];
  if (draw(state) < 0.18) return null;
  return structuredClone(candidates[(state.week + Math.floor(draw(state) * candidates.length)) % candidates.length]);
}
function addLog(state: GameState, category: string, text: string) {
  state.log.unshift({ id: `${state.week}-${state.log.length}-${state.rngState}`, week: state.week, category, text });
  state.log = state.log.slice(0, 80);
}

export function createGame(input: { name: string; age: number; year: number; background: Background; seedText?: string }): GameState {
  const cleanName = input.name.trim() || "나";
  const seed = seedFrom(input.seedText || `${cleanName}|${input.age}|${input.year}|${input.background}`);
  const npcs = structuredClone(NPC_SEEDS[input.background]).map((npc) => ({
    ...npc, memories: [], lastAction: "이번 주를 시작했어요.",
  }));
  const state: GameState = {
    version: 1,
    id: `nanal-${seed.toString(16)}`,
    seed,
    rngState: seed,
    name: cleanName,
    age: clamp(input.age, 19, 30),
    year: clamp(input.year, 2020, 2026),
    background: input.background,
    playerGoal: BACKGROUNDS[input.background].goal,
    cash: input.background === "worker" ? 1_200_000 : input.background === "student" ? 450_000 : 620_000,
    energy: 72,
    stress: 28,
    skill: 35,
    week: 1,
    actionsLeft: 2,
    pendingEvent: null,
    npcs,
    log: [],
    lastWeekSummary: [],
  };
  addLog(state, "시작", `${state.year}년, ${cleanName}의 첫 주가 시작됐어요. ${BACKGROUNDS[state.background].intro}`);
  state.pendingEvent = structuredClone(EVENTS[input.background][0]);
  return state;
}

export function chooseEvent(state: GameState, choiceId: string): GameState {
  if (!state.pendingEvent) throw new Error("선택할 사건이 없습니다.");
  const next = structuredClone(state);
  const event = next.pendingEvent!;
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) throw new Error("유효하지 않은 선택입니다.");
  const e = choice.effects;
  next.cash = Math.max(0, next.cash + (e.cash ?? 0));
  next.energy = clamp(next.energy + (e.energy ?? 0), 0, 100);
  next.stress = clamp(next.stress + (e.stress ?? 0), 0, 100);
  next.skill = clamp(next.skill + (e.skill ?? 0), 0, 100);
  const npc = e.target ? next.npcs.find((item) => item.id === e.target) : undefined;
  if (npc) {
    npc.affinity = clamp(npc.affinity + (e.affinity ?? 0), -5, 5);
    npc.trust = clamp(npc.trust + (e.trust ?? 0), 0, 100);
    npc.memories.unshift({ text: `${event.title}에서 ${choice.label}을(를) 선택했어요.`, week: next.week, vividness: 1 });
  }
  addLog(next, "선택", `${choice.result} (${event.title})`);
  next.pendingEvent = null;
  return next;
}

export function takeAction(state: GameState, actionId: ActionId, targetId?: string): GameState {
  if (state.pendingEvent) throw new Error("사건 선택을 먼저 마쳐주세요.");
  if (state.actionsLeft <= 0) throw new Error("이번 주 행동을 모두 사용했어요.");
  const next = structuredClone(state);
  const target = targetId ? next.npcs.find((npc) => npc.id === targetId) : undefined;
  switch (actionId) {
    case "study":
      next.skill = clamp(next.skill + 7, 0, 100);
      next.energy = clamp(next.energy - 10, 0, 100);
      next.stress = clamp(next.stress + 2, 0, 100);
      addLog(next, "성장", "집중해서 배웠어요. 준비도가 조금 쌓였습니다.");
      break;
    case "work":
      next.cash += next.background === "worker" ? 120_000 : 55_000;
      next.energy = clamp(next.energy - 12, 0, 100);
      next.stress = clamp(next.stress + 3, 0, 100);
      addLog(next, "일", "일을 챙겨 현금 여유를 만들었어요.");
      break;
    case "connect":
      if (!target) throw new Error("함께 시간을 보낼 사람을 선택해주세요.");
      target.affinity = clamp(target.affinity + 1, -5, 5);
      target.trust = clamp(target.trust + 2, 0, 100);
      target.memories.unshift({ text: `${target.name}와 시간을 보냈어요.`, week: next.week, vividness: 0.85 });
      next.energy = clamp(next.energy - 3, 0, 100);
      addLog(next, "관계", `${target.name}와 시간을 보냈어요. 다음 만남의 기억으로 남았습니다.`);
      break;
    case "rest":
      next.energy = clamp(next.energy + 22, 0, 100);
      next.stress = clamp(next.stress - 12, 0, 100);
      addLog(next, "생활", "일정을 비우고 쉬었어요. 에너지가 돌아왔습니다.");
      break;
    case "exercise":
      next.energy = clamp(next.energy - 4, 0, 100);
      next.stress = clamp(next.stress - 9, 0, 100);
      next.skill = clamp(next.skill + 1, 0, 100);
      addLog(next, "건강", "가볍게 몸을 움직였어요. 긴장이 조금 풀렸습니다.");
      break;
    case "search":
      next.skill = clamp(next.skill + 2, 0, 100);
      next.stress = clamp(next.stress - 1, 0, 100);
      addLog(next, "기회", "공고와 모임을 살펴 다음 선택지를 넓혔어요.");
      break;
  }
  next.actionsLeft -= 1;
  return next;
}

export function finishWeek(state: GameState): GameState {
  if (state.pendingEvent) throw new Error("먼저 사건 선택을 마쳐주세요.");
  if (state.actionsLeft > 0) throw new Error("이번 주 행동을 모두 선택한 뒤 마무리할 수 있어요.");
  const next = structuredClone(state);
  const income = next.background === "worker" ? 650_000 : next.background === "student" ? 125_000 : 0;
  const expense = next.background === "worker" ? 230_000 : next.background === "student" ? 105_000 : 165_000;
  const cashBefore = next.cash;
  next.cash = Math.max(0, next.cash + income - expense);
  const summary = [
    `수입 ${income.toLocaleString("ko-KR")}원 · 생활비 ${expense.toLocaleString("ko-KR")}원`,
    `현금 ${cashBefore.toLocaleString("ko-KR")}원 → ${next.cash.toLocaleString("ko-KR")}원`,
    `에너지 ${next.energy}/100 · 스트레스 ${next.stress}/100 · 준비도 ${next.skill}/100`,
  ];
  next.npcs = next.npcs.map((npc) => {
    const updated = structuredClone(npc);
    updated.memories = updated.memories
      .map((memory) => ({ ...memory, vividness: memory.vividness * Math.pow(0.94, Math.max(1, next.week - memory.week)) }))
      .filter((memory) => memory.vividness > 0.18)
      .slice(0, 6);
    const roll = draw(next);
    if (roll < 0.62) {
      updated.goal.progress = clamp(updated.goal.progress + 1, 0, 3);
      updated.goal.stage = ["시작하기", "진행 중", "마무리 준비", "완료"][updated.goal.progress];
      updated.lastAction = `${updated.goal.title}을(를) 이어갔어요.`;
      if (updated.goal.progress === 3) {
        updated.mood = "작은 성취를 얻음";
        updated.memories.unshift({ text: `${updated.goal.title}에서 한 단계를 마쳤어요.`, week: next.week, vividness: 0.9 });
        addLog(next, "인물", `${updated.name}이(가) 자기 목표에서 한 단계를 마쳤어요.`);
      } else {
        updated.mood = roll < 0.22 ? "조금 지침" : "평소와 같음";
      }
    } else {
      updated.lastAction = "예상하지 못한 일로 계획을 미뤘어요.";
      updated.mood = "일정이 꼬임";
    }
    if (updated.goal.progress >= 3 && draw(next) < 0.28) {
      const oldGoal = updated.goal.title;
      updated.goal = { title: updated.role.includes("친구") ? "함께할 약속 만들기" : "다음 기회 준비하기", progress: 0, stage: "생각 중" };
      updated.mood = "새 목표를 고민하는 중";
      addLog(next, "인물", `${updated.name}의 관심이 “${oldGoal}”에서 “${updated.goal.title}”로 옮겨가기 시작했어요.`);
    }
    return updated;
  });
  next.week += 1;
  next.actionsLeft = 2;
  next.lastWeekSummary = summary;
  addLog(next, "주간 정리", `제 ${next.week - 1}주가 끝났어요. 현금 흐름과 인물들의 한 주를 정리했습니다.`);
  if ((next.week - 1) % 4 === 0) addLog(next, "월말 정산", `한 달이 지났어요. 이번 달의 선택과 관계 변화를 돌아볼 수 있습니다.`);
  next.pendingEvent = nextEvent(next);
  return next;
}

export function formatMoney(value: number) {
  if (value >= 10_000) return `${(value / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만원`;
  return `${value.toLocaleString("ko-KR")}원`;
}

export function cloneGame(state: GameState) {
  return structuredClone(state);
}

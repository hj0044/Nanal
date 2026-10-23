import type { GameState, LifeEvent, EventChoice } from "./game";

const choice = (id: string, title: string, detail: string, result: string, effect: EventChoice["effect"], contactId?: string): EventChoice => ({
  id, title, detail, result, effect, ...(contactId ? { contactId } : {}),
});

/** Returns due authored follow-ups from saved route state; no random rolls or external calls. */
export function getEventThreadEvents(state: GameState): LifeEvent[] {
  return Object.entries(state.eventThreads ?? {}).flatMap(([id, thread]) => {
    if (thread.nextWeek > state.week) return [];
    const person = thread.contactId ? state.contacts.find((contact) => contact.id === thread.contactId) : undefined;
    const name = person?.name ?? "가까운 사람";
    if (thread.stage === 1) return [stageOne(id, thread.route, name, thread.contactId)];
    if (thread.stage === 2) return [stageTwo(id, thread.route, name, thread.contactId)];
    if (thread.stage === 3) return [stageThree(id, thread.route, name, thread.contactId)];
    return [];
  });
}

export function updateEventThreads(state: GameState, selected: EventChoice): GameState["eventThreads"] {
  const event = state.pendingEvent;
  const threads = { ...(state.eventThreads ?? {}) };
  if (!event?.thread) return state.eventThreads;
  const { id, stage } = event.thread;
  if (stage === 0) {
    if (Object.keys(threads).length >= 4) return threads;
    const contactId = selected.contactId ?? (selected.contactIndex === undefined ? undefined : state.contacts[selected.contactIndex]?.id);
    threads[id] = { route: selected.id, stage: 1, nextWeek: state.week + 1, ...(contactId ? { contactId } : {}) };
  } else if ((stage === 1 || stage === 2) && threads[id]) {
    threads[id] = { ...threads[id], route: `${threads[id].route}|${selected.id}`, stage: stage + 1, nextWeek: state.week + 1 };
  } else if (stage >= 3) {
    delete threads[id];
  }
  return threads;
}

function stageOne(id: string, route: string, name: string, contactId?: string): LifeEvent {
  if (id === "unexpected-expense") {
    const start = route === "expense-pay" ? "비용을 바로 처리한 뒤 이번 주 예산이 빠듯해졌다."
      : route === "expense-compare" ? "비교해서 지출을 줄였지만, 수리한 물건을 며칠 더 살펴봐야 한다."
      : "지출을 미룬 뒤에도 문제가 남아 있어 언제 처리할지 정해야 한다.";
    return { id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: "갑작스러운 지출 뒤의 한 주", eyebrow: "생활 · 후속 이야기", body: `${start} 다음 지출을 감당하면서 필요한 생활을 이어갈 방법을 고를 수 있다.`, choices: [
      choice("expense-follow-plan", "이번 주 지출을 다시 나눠 계획한다", "필수 비용을 먼저 두고 여유 항목을 조정한다", "필수 지출과 미룰 수 있는 지출을 구분해 계획을 다시 세웠다. 당장 부담은 남았지만 다음 주를 예상하기 쉬워졌다.", { focus: 3, stress: -2 }),
      choice("expense-follow-income", "가능한 단기 일을 찾아 생활비를 보탠다", "시간과 체력을 쓰고 현금 여유를 만든다", "짧은 일을 맡아 필요한 비용 일부를 마련했다. 체력은 들었지만 미뤄둔 지출을 감당할 여지가 생겼다.", { money: 35_000, energy: -5, stress: 1 }),
      choice("expense-follow-talk", "납부 일정이나 도움을 받을 방법을 문의한다", "혼자 감당하지 않고 현실적인 일정을 확인한다", `${name}에게 상황을 설명하고 가능한 도움과 납부 일정을 함께 확인했다. 부담을 나눌 방법이 생겼다.`, { stress: -3, relationship: 2 }, contactId),
    ] };
  }
  if (id === "relationship-repair") {
    const start = route === "misunderstanding-ask" ? `${name}과 그날의 말을 다시 확인한 뒤 서로의 의도를 조금 알게 됐다.`
      : route === "misunderstanding-wait" ? `생각을 정리한 뒤 ${name}에게 먼저 대화를 제안했다.`
      : `${name}과 잠시 거리를 둔 사이, 어색함이 쉽게 풀리지 않았다.`;
    return { id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: `${name}과 다시 마주한 대화`, eyebrow: "관계 · 이어진 이야기", body: `${start} 이번에는 관계를 어떻게 이어갈지 작은 행동으로 정할 수 있다.`, choices: [
      choice("repair-listen", "상대가 느낀 점을 끝까지 듣는다", "먼저 이해하고 대화를 이어간다", `${name}의 이야기를 충분히 들었다. 서로 다르게 받아들인 부분을 인정하며 다시 편하게 연락하기로 했다.`, { relationship: 4, stress: -2 }, contactId),
      choice("repair-boundary", "다음부터 지킬 대화 방식을 제안한다", "서로 편안한 기준을 정한다", `${name}과 불편했던 상황을 줄일 방법을 정했다. 모든 생각이 같지는 않아도 서로의 경계를 존중하기로 했다.`, { relationship: 2, focus: 2 }, contactId),
      choice("repair-space", "조금 더 시간을 두고 안부만 나눈다", "무리한 화해를 서두르지 않는다", `${name}과 당장 결론을 내리지 않고 가볍게 안부를 주고받았다. 관계를 이어갈 여지는 남겼다.`, { relationship: 1, stress: -1 }, contactId),
    ] };
  }
  const start = route === "apply" ? "지원서를 제출한 뒤 결과를 기다리고 있다."
    : route === "prepare" ? "지원 자료를 다듬었지만 공고 마감이 가까워졌다."
    : "현직자에게 들은 정보를 바탕으로 지원 방향을 정리했다.";
  return { id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: "지원 이후, 다음 선택", eyebrow: "구직 · 이어진 기회", body: `${start} 기다리는 동안 다음 행동을 고를 수 있다. 결과가 아직 정해지지 않아도 준비는 이어진다.`, choices: [
    choice("job-follow-up", "답변을 기다리며 다음 공고도 살핀다", "한 곳의 결과에만 매달리지 않는다", "지원 결과를 기다리면서 조건이 맞는 다른 공고도 찾아봤다. 선택지가 넓어져 마음이 조금 안정됐다.", { focus: 3, stress: -1 }),
    choice("job-feedback", "지원 자료를 다시 점검하고 보완한다", "다음 지원에 쓸 수 있는 경험을 쌓는다", "지원 과정에서 부족했던 점을 정리했다. 다음 지원서에는 경험과 직무 연결을 더 분명히 담기로 했다.", { focus: 4, energy: -2 }),
    choice("job-recover", "하루 쉬고 정해둔 날에 다시 시작한다", "회복 시간을 계획에 포함한다", "잠시 쉬어갈 날짜와 다시 준비할 날을 정했다. 쉬는 동안에도 다음 계획은 놓치지 않게 됐다.", { energy: 5, stress: -3 }),
  ] };
}

function stageTwo(id: string, route: string, name: string, contactId?: string): LifeEvent {
  const rootRoute = route.split("|")[0];
  if (id === "unexpected-expense") return { id: `thread-${id}-stage-2-${route}`, thread: { id, stage: 2 }, title: "지출 문제를 정리하고 남은 것", eyebrow: "생활 · 마무리", body: rootRoute === "expense-delay" ? "미뤄둔 비용을 처리할 시점이 왔다. 이번 경험을 다음 생활 계획에 반영할 수 있다." : "갑작스러운 비용은 정리됐고, 다음에 대비할 여유를 조금씩 만들 수 있다.", choices: [
    choice("expense-close-buffer", "작은 비상 여유금을 먼저 만든다", "다음 돌발 지출에 대비한다", "이번 일을 계기로 매주 감당 가능한 금액부터 따로 남기기로 했다. 생활비 계획에 작은 안전 여유가 생겼다.", { focus: 3, goalProgress: 1 }),
    choice("expense-close-flex", "상황에 따라 조정할 항목을 정해둔다", "고정비와 선택 지출을 구분한다", "필수 비용과 조정 가능한 지출을 나눠 적었다. 다음에는 급한 상황에서도 선택지를 비교할 수 있다.", { stress: -2, focus: 2 }),
  ] };
  if (id === "relationship-repair") return { id: `thread-${id}-stage-2-${route}`, thread: { id, stage: 2 }, title: `${name}과 이어갈 관계의 방식`, eyebrow: "관계 · 마무리", body: `${name}과의 어색함은 조금씩 옅어졌다. 앞으로 관계를 이어갈 속도는 두 사람의 선택에 달려 있다.`, choices: [
    choice("repair-close", "다음에 함께할 시간을 정한다", "작은 약속으로 신뢰를 이어간다", `${name}과 다음에 만날 시간을 정했다. 완벽한 화해보다 지킬 수 있는 약속을 이어가기로 했다.`, { relationship: 3, mood: 2 }, contactId),
    choice("repair-open", "부담 없이 안부를 나누며 지켜본다", "관계의 속도를 서로에게 맞춘다", `${name}과 무리하지 않고 안부를 주고받기로 했다. 필요한 이야기는 편한 때 다시 꺼낼 수 있다.`, { relationship: 2, stress: -1 }, contactId),
  ] };
  return { id: `thread-${id}-stage-2-${route}`, thread: { id, stage: 2 }, title: "다음 지원을 위한 정리", eyebrow: "구직 · 한 단계 마무리", body: "지원 과정에서 얻은 경험을 다음 계획으로 옮길 차례다. 구직을 계속하되 준비와 회복의 균형을 정할 수 있다.", choices: [
    choice("job-close-plan", "다음 주 지원 목표를 구체적으로 정한다", "실행할 수 있는 수와 시간을 정한다", "다음 주 지원할 곳과 준비 시간을 정했다. 막연한 걱정이 작은 일정으로 바뀌었다.", { focus: 3, stress: -1, goalProgress: 1 }),
    choice("job-close-support", "도움을 받을 사람에게 진행 상황을 나눈다", "혼자 준비하지 않도록 연결을 유지한다", "믿을 만한 사람에게 준비 상황을 나눴다. 조언을 받을 통로를 이어가기로 했다.", { mood: 2, stress: -2, relationship: 1 }),
  ] };
}


function stageThree(id: string, route: string, name: string, contactId?: string): LifeEvent {
  const firstChoice = route.split("|")[0];
  if (id === "relationship-repair") return {
    id: `thread-${id}-stage-3-${route}`, thread: { id, stage: 3 },
    title: `${name}과 달라진 일상의 거리`, eyebrow: "관계 · 이후의 이야기",
    body: firstChoice === "misunderstanding-ask"
      ? `${name}과 오해를 풀고 몇 주가 지났다. 예전처럼 돌아가기보다, 서로 배운 것을 일상에서 이어갈 때다.`
      : `${name}과의 관계를 서두르지 않기로 한 뒤 몇 주가 지났다. 먼저 연락하는 방식과 함께 보내는 시간을 정할 수 있다.`,
    choices: [
      choice("repair-routine", "다음 주에 함께할 작은 일정을 잡는다", "지킬 수 있는 약속으로 관계를 이어간다", `${name}과 다음 주에 함께할 시간을 정했다. 지난 대화가 하루의 화해로 끝나지 않고 둘만의 약속으로 이어졌다.`, { relationship: 4, mood: 2 }, contactId),
      choice("repair-check-in", "서로 편한 연락 주기를 정한다", "바쁜 시기에도 부담 없이 안부를 나눈다", `${name}과 연락이 뜸해질 때 서로 어떻게 안부를 나눌지 정했다. 관계를 유지하는 방식이 두 사람에게 맞게 바뀌었다.`, { relationship: 3, stress: -1 }, contactId),
      choice("repair-open-door", "정답을 정하지 않고 다음 대화를 열어둔다", "관계의 속도와 경계를 계속 존중한다", `${name}과 아직 남은 생각을 천천히 이야기하기로 했다. 모든 문제가 끝난 것은 아니지만 서로 피하지 않을 수 있게 됐다.`, { relationship: 2, focus: 1 }, contactId),
    ],
  };
  if (id === "job-application") return {
    id: `thread-${id}-stage-3-${route}`, thread: { id, stage: 3 },
    title: "지원 경험을 다음 기회로", eyebrow: "구직 · 이어지는 선택",
    body: "결과와 관계없이 이번 지원은 끝났다. 준비 과정에서 알게 된 점을 다음 선택에 옮길 수 있다.",
    choices: [
      choice("job-network", `${name}에게 준비 과정을 나누고 조언을 구한다`, "혼자 쌓은 경험을 관계를 통해 다음 기회로 연결한다", `${name}에게 지원 과정에서 배운 점을 나눴다. 다음 공고가 열리면 서로 정보를 주고받기로 해 기회가 관계를 통해 이어졌다.`, { relationship: 2, focus: 2, goalProgress: 1 }, contactId),
      choice("job-next-step", "다음 지원 일정을 함께 점검해달라고 부탁한다", "막연한 계획을 실행 약속으로 바꾼다", `${name}과 다음 지원 일정을 점검하기로 했다. 준비 상황을 나누며 다시 움직일 기준이 생겼다.`, { relationship: 2, stress: -2, goalProgress: 1 }, contactId),
      choice("job-rest-close", "이번 지원을 기록하고 잠시 회복한다", "경험을 남기되 속도를 조절한다", "이번 지원에서 배운 점과 다음에 보완할 점을 기록했다. 며칠 쉬고 다시 시작할 날도 정했다.", { energy: 4, stress: -2, goalProgress: 1 }),
    ],
  };
  return {
    id: `thread-${id}-stage-3-${route}`, thread: { id, stage: 3 },
    title: "이번 일에서 남은 배움", eyebrow: "생활 · 다음 선택",
    body: "몇 주에 걸쳐 이어진 일이 일단락됐다. 이번 경험을 다음 생활의 기준으로 남길 수 있다.",
    choices: [
      choice("thread-remember", `${name}과 다음 계획을 나눈다`, "경험을 인연과 생활의 변화로 이어간다", `${name}과 이번 일을 돌아보고 다음에 비슷한 상황이 오면 서로 어떻게 도울지 정했다. 경험이 둘 사이의 기억과 약속으로 남았다.`, { relationship: 2, focus: 2, goalProgress: 1 }, contactId),
      choice("thread-apply", "배운 점을 다음 주 계획에 반영한다", "생활의 작은 습관으로 바꾼다", "이번 일을 통해 배운 점을 다음 주 일정에 반영했다. 한 번의 사건이 생활 방식을 바꾸는 계기가 됐다.", { focus: 3, stress: -1, goalProgress: 1 }),
    ],
  };
}

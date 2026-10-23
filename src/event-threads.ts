import type { GameState, LifeEvent, EventChoice, Contact } from "./game";

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
    if (thread.stage >= 3) return [ongoingChapter(state, id, thread, name, person)];
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
    threads[id] = {
      route: selected.id,
      stage: 1,
      nextWeek: state.week + 1,
      history: [selected.id],
      lastChoiceTitle: selected.title,
      lastOutcome: selected.result.slice(0, 180),
      ...(contactId ? { contactId } : {}),
    };
  } else if (threads[id] && selected.id.startsWith("thread-finish-")) {
    delete threads[id];
  } else if (threads[id]) {
    const current = threads[id];
    threads[id] = {
      ...current,
      stage: stage + 1,
      nextWeek: state.week + 1,
      history: [...(current.history ?? []), selected.id].slice(-8),
      lastChoiceTitle: selected.title,
      lastOutcome: selected.result.slice(0, 180),
    };
  }
  return threads;
}

function stageOne(id: string, route: string, name: string, contactId?: string): LifeEvent {
  if (id === "unexpected-expense") {
    const start = route === "expense-pay" ? "비용을 바로 처리한 뒤 이번 주 예산이 빠듯해졌다."
      : route === "expense-compare" ? "비교해서 지출을 줄였지만, 수리한 물건을 며칠 더 살펴봐야 한다."
      : "지출을 미룬 뒤에도 문제가 남아 있어 언제 처리할지 정해야 한다.";
    return { id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: "이번 달, 지갑이 조금 얇아졌다", eyebrow: "생활 · 후속 이야기", body: `${start} 다음 지출을 감당하면서 필요한 생활을 이어갈 방법을 고를 수 있다.`, choices: [
      choice("expense-follow-plan", "이번 주 지출을 다시 나눠 계획한다", "필수 비용을 먼저 두고 여유 항목을 조정한다", "필수 지출과 미룰 수 있는 지출을 구분해 계획을 다시 세웠다. 당장 부담은 남았지만 다음 주를 예상하기 쉬워졌다.", { focus: 3, stress: -2 }),
      choice("expense-follow-income", "가능한 단기 일을 찾아 생활비를 보탠다", "시간과 체력을 쓰고 현금 여유를 만든다", "짧은 일을 맡아 필요한 비용 일부를 마련했다. 체력은 들었지만 미뤄둔 지출을 감당할 여지가 생겼다.", { money: 35_000, energy: -5, stress: 1 }),
      choice("expense-follow-talk", "납부 일정이나 도움을 받을 방법을 문의한다", "혼자 감당하지 않고 현실적인 일정을 확인한다", `${name}에게 상황을 설명하고 가능한 도움과 납부 일정을 함께 확인했다. 부담을 나눌 방법이 생겼다.`, { stress: -3, relationship: 2 }, contactId),
    ] };
  }
  if (id === "relationship-repair") {
    const start = route === "misunderstanding-ask" ? `${name}과 그날의 말을 다시 확인한 뒤 서로의 의도를 조금 알게 됐다.`
      : route === "misunderstanding-wait" ? `생각을 정리한 뒤 ${name}에게 먼저 대화를 제안했다.`
      : `${name}과 잠시 거리를 둔 사이, 어색함이 쉽게 풀리지 않았다.`;
    return { id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: `${name}에게서 먼저 연락이 왔다`, eyebrow: "관계 · 이어진 이야기", body: `${start} 이번에는 관계를 어떻게 이어갈지 작은 행동으로 정할 수 있다.`, choices: [
      choice("repair-listen", "상대가 느낀 점을 끝까지 듣는다", "먼저 이해하고 대화를 이어간다", `${name}의 이야기를 충분히 들었다. 서로 다르게 받아들인 부분을 인정하며 다시 편하게 연락하기로 했다.`, { relationship: 4, stress: -2 }, contactId),
      choice("repair-boundary", "다음부터 지킬 대화 방식을 제안한다", "서로 편안한 기준을 정한다", `${name}과 불편했던 상황을 줄일 방법을 정했다. 모든 생각이 같지는 않아도 서로의 경계를 존중하기로 했다.`, { relationship: 2, focus: 2 }, contactId),
      choice("repair-space", "조금 더 시간을 두고 안부만 나눈다", "무리한 화해를 서두르지 않는다", `${name}과 당장 결론을 내리지 않고 가볍게 안부를 주고받았다. 관계를 이어갈 여지는 남겼다.`, { relationship: 1, stress: -1 }, contactId),
    ] };
  }
  if (id === "shared-project") return {
    id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: `${name}이 먼저 보낸 “우리 그거 해볼까?”`,
    eyebrow: "친구 · 같이 시작한 일", body: `${name}과 가볍게 꺼냈던 계획이 다시 대화에 올랐다. 이번에는 말로만 끝내지 않고 작게 시작해볼 수 있다.`,
    choices: [
      choice("project-pick-date", "이번 주에 만날 날짜부터 잡는다", "작은 약속을 실제 일정으로 옮긴다", `${name}과 만날 날짜를 정했다. 장소와 준비물은 천천히 정하기로 했다.`, { relationship: 3, focus: 2 }, contactId),
      choice("project-define-small", "첫 단계만 정하고 부담을 줄인다", "완성보다 시작을 먼저 챙긴다", `${name}과 이번 주에 할 수 있는 첫 단계만 정했다. 부담이 줄어들자 계획이 조금 현실적으로 느껴졌다.`, { relationship: 2, stress: -1, focus: 2 }, contactId),
      choice("project-check-interest", "서로 아직 하고 싶은지 솔직히 확인한다", "예전 계획에 억지로 매이지 않는다", `${name}과 계획을 다시 꺼낸 이유와 지금의 마음을 나눴다. 계속할지 함께 결정하기로 했다.`, { relationship: 2, mood: 1 }, contactId),
    ],
  };
  if (id === "old-friend") return {
    id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: `${name}에게서 “요즘 잘 지내?”가 왔다`,
    eyebrow: "오래된 인연 · 다시 연락", body: `한동안 뜸했던 ${name}이 먼저 안부를 물었다. 반가움과 어색함이 같이 들지만, 대답은 지금의 마음에 맞춰도 된다.`,
    choices: [
      choice("friend-reply-honest", "요즘 내 얘기도 조금 솔직하게 전한다", "잘 지낸다는 말로 덮지 않는다", `${name}에게 요즘 있었던 일을 솔직하게 전했다. ${name}도 자신의 근황을 들려주며 대화가 이어졌다.`, { relationship: 3, mood: 2 }, contactId),
      choice("friend-call", "짧게 통화하자고 먼저 제안한다", "메시지보다 목소리로 안부를 나눈다", `${name}과 통화로 근황을 나눴다. 어색함은 조금 남았지만 다시 연락할 이유가 생겼다.`, { relationship: 3, stress: -1 }, contactId),
      choice("friend-slow", "반갑다고 답하고 천천히 이야기를 잇는다", "급하게 예전처럼 돌아가려 하지 않는다", `${name}에게 반갑다고 답했다. 무리해서 긴 대화를 만들지 않고 서로 편한 속도로 연락하기로 했다.`, { relationship: 2, stress: -1 }, contactId),
    ],
  };
  if (id === "family-plan") return {
    id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: `${name}과 통화하다가 남은 이야기`,
    eyebrow: "가족 · 안부와 거리", body: `${name}과 안부를 나누다 보니 평소엔 미뤄둔 이야기도 나왔다. 가족이라는 이유만으로 넘기지 말고, 필요한 만큼 서로의 생각을 들을 수 있다.`,
    choices: [
      choice("family-plan-visit", "이번 달에 함께할 날짜를 정한다", "막연한 안부를 실제 만남으로 잇는다", `${name}과 이번 달에 만날 날을 정했다. 그때 하고 싶었던 이야기도 천천히 나누기로 했다.`, { relationship: 3, mood: 2 }, contactId),
      choice("family-plan-boundary", "내가 가능한 범위부터 솔직히 말한다", "도움과 부담의 선을 함께 정한다", `${name}에게 지금 가능한 일과 어려운 일을 차분히 설명했다. 서로의 기대를 다시 맞췄다.`, { relationship: 2, stress: -2 }, contactId),
      choice("family-plan-call", "주말마다 짧게 통화하기로 한다", "큰 약속보다 꾸준한 안부를 택한다", `${name}과 주말에 짧게 통화하기로 했다. 부담은 적고 서로의 생활을 놓치지 않을 방법이 생겼다.`, { relationship: 2, focus: 1 }, contactId),
    ],
  };
  if (id === "hobby-project") return {
    id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: `${name}이 같이 해보자던 취미를 다시 꺼냈다`,
    eyebrow: "취미 · 새로운 일상", body: `${name}이 예전에 이야기했던 취미를 다시 제안했다. 비용과 시간을 따져보면서도, 함께 웃을 일을 만들 수 있다.`,
    choices: [
      choice("hobby-try", "이번 주에 체험부터 해본다", "큰 결제 없이 서로 맞는지 살핀다", `${name}과 체험 수업을 알아봤다. 잘 맞으면 계속하고 아니면 좋은 하루로 남기기로 했다.`, { relationship: 3, mood: 3, money: -8_000 }, contactId),
      choice("hobby-home", "돈 적게 드는 방식으로 먼저 해본다", "장비나 수강권보다 같이 해보는 데 집중한다", `${name}과 집 근처에서 가볍게 시작해보기로 했다. 필요한 건 해본 다음에 사기로 했다.`, { relationship: 2, focus: 1 }, contactId),
      choice("hobby-calendar", "바쁜 일정이 지나면 다시 날짜를 잡는다", "관심은 남기되 이번 주 부담을 줄인다", `${name}에게 이번 주 일정은 어렵다고 말하고 가능한 시기를 함께 찾았다. 계획을 접지는 않았다.`, { relationship: 1, stress: -1 }, contactId),
    ],
  };
  if (id === "career-mentor") return {
    id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: `${name}이 건넨 뜻밖의 연락처`,
    eyebrow: "기회 · 사람을 통한 연결", body: `${name}이 네가 고민하던 분야를 아는 사람을 소개해줄 수 있다고 했다. 당장 결과를 기대하기보다 어떤 이야기를 나누고 싶은지 정할 수 있다.`,
    choices: [
      choice("mentor-intro-accept", "소개를 부탁하고 궁금한 점을 정리한다", "먼저 대화할 주제를 준비한다", `${name}에게 소개를 부탁했다. 궁금한 점을 정리해 첫 연락에서 편하게 물어보기로 했다.`, { relationship: 2, focus: 3 }, contactId),
      choice("mentor-intro-ask", "그 사람이 어떤 일을 하는지 먼저 듣는다", "소개 전에 나와 맞는 자리인지 살핀다", `${name}에게 상대의 경험과 현재 하는 일을 먼저 들었다. 필요한 도움인지 생각한 뒤 연락하기로 했다.`, { relationship: 2, focus: 2 }, contactId),
      choice("mentor-intro-later", "지금은 준비를 조금 더 한 뒤 부탁한다", "연결을 소중하게 쓰도록 시간을 둔다", `${name}에게 고맙다고 전하고, 준비를 마친 뒤 소개를 부탁하기로 했다.`, { relationship: 1, stress: -1, focus: 1 }, contactId),
    ],
  };
  const start = route === "apply" ? "지원서를 제출한 뒤 결과를 기다리고 있다."
    : route === "prepare" ? "지원 자료를 다듬었지만 공고 마감이 가까워졌다."
    : "현직자에게 들은 정보를 바탕으로 지원 방향을 정리했다.";
  return { id: `thread-${id}-stage-1-${route}`, thread: { id, stage: 1 }, title: "답을 기다리는 사이에", eyebrow: "구직 · 이어진 기회", body: `${start} 기다리는 동안 다음 행동을 고를 수 있다. 결과가 아직 정해지지 않아도 준비는 이어진다.`, choices: [
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
  if (id === "relationship-repair") return { id: `thread-${id}-stage-2-${route}`, thread: { id, stage: 2 }, title: `${name}과 다음에 나눌 이야기`, eyebrow: "관계 · 이어지는 이야기", body: `${name}과의 어색함은 조금씩 옅어졌다. 앞으로 관계를 이어갈 속도는 두 사람의 선택에 달려 있다.`, choices: [
    choice("repair-close", "다음에 함께할 시간을 정한다", "작은 약속으로 신뢰를 이어간다", `${name}과 다음에 만날 시간을 정했다. 완벽한 화해보다 지킬 수 있는 약속을 이어가기로 했다.`, { relationship: 3, mood: 2 }, contactId),
    choice("repair-open", "부담 없이 안부를 나누며 지켜본다", "관계의 속도를 서로에게 맞춘다", `${name}과 무리하지 않고 안부를 주고받기로 했다. 필요한 이야기는 편한 때 다시 꺼낼 수 있다.`, { relationship: 2, stress: -1 }, contactId),
  ] };
  const continuing = (title: string, body: string, choices: EventChoice[]): LifeEvent => ({
    id: `thread-${id}-stage-2-${route}`, thread: { id, stage: 2 }, title, eyebrow: "이어지는 이야기 · 두 번째 장", body, choices,
  });
  if (id === "shared-project") return continuing(`${name}과 처음 같이 해본 날`, `생각보다 손이 많이 갔지만 ${name}과 역할을 나누니 조금씩 모양이 잡혔다. 계속 키워갈지, 작게 남길지 정할 수 있다.`, [
    choice("project-share", "중간 결과를 다른 사람에게 보여준다", "반응을 듣고 다음 방향을 찾는다", `${name}과 중간 결과를 공유했다. 예상 못 한 의견이 다음 아이디어로 이어졌다.`, { relationship: 2, focus: 2 }, contactId),
    choice("project-scope", "처음 생각보다 범위를 줄인다", "완성할 수 있는 크기로 다시 맞춘다", `${name}과 욕심냈던 부분을 덜어냈다. 이번 주에 끝낼 수 있는 만큼으로 바꾸자 다시 움직일 수 있었다.`, { relationship: 2, stress: -1, focus: 2 }, contactId),
    choice("project-roles", "각자 맡을 일을 다시 나눈다", "한 사람에게 부담이 쏠리지 않게 한다", `${name}과 시간이 얼마나 드는지 확인하고 역할을 나눴다. 서로 기대하는 바도 분명해졌다.`, { relationship: 3, focus: 1 }, contactId),
  ]);
  if (id === "old-friend") return continuing(`${name}과 밀린 이야기를 나눈 저녁`, `처음엔 근황만 묻다가 예전엔 몰랐던 서로의 시간을 알게 됐다. 다시 가까워지는 방식은 둘이 새로 정하면 된다.`, [
    choice("friend-memory", "예전에 같이 가던 곳을 다시 찾아간다", "익숙한 장소에서 새로운 근황을 나눈다", `${name}과 예전에 자주 가던 곳에 들렀다. 달라진 점도 그대로인 점도 편하게 이야기했다.`, { relationship: 3, mood: 2 }, contactId),
    choice("friend-new-memory", "이번엔 새로운 장소에서 만나자고 한다", "과거에만 기대지 않고 지금을 알아간다", `${name}과 처음 가보는 곳에서 만났다. 예전 추억에 지금의 이야기가 더해졌다.`, { relationship: 3, focus: 1 }, contactId),
    choice("friend-rhythm", "다음 연락은 누가 먼저든 편하게 하자고 한다", "연락 빈도를 약속으로 묶지 않는다", `${name}과 연락 횟수를 정해두지 않기로 했다. 생각나면 먼저 안부를 묻기로 했다.`, { relationship: 2, stress: -1 }, contactId),
  ]);
  if (id === "family-plan") return continuing(`${name}과 정한 약속을 앞두고`, `만날 날짜가 가까워지자 서로 궁금했던 일과 조심스러운 이야기가 떠올랐다. 어디까지 나눌지 미리 정할 수 있다.`, [
    choice("family-talk-open", "미뤄둔 이야기를 만나서 나눈다", "서로의 입장을 차분히 듣는다", `${name}과 미뤄둔 이야기를 나눴다. 바로 해결되지는 않았지만 서로 무엇을 걱정하는지는 알게 됐다.`, { relationship: 3, stress: -2 }, contactId),
    choice("family-time-light", "이번 만남은 가볍게 근황만 나눈다", "한 번에 모든 문제를 다루지 않는다", `${name}과 식사하며 편한 이야기부터 나눴다. 어려운 주제는 둘 다 준비가 됐을 때 꺼내기로 했다.`, { relationship: 2, mood: 2 }, contactId),
    choice("family-ask", "내가 필요한 도움이나 바라는 점을 구체적으로 말한다", "기대만 쌓이지 않게 요청을 분명히 한다", `${name}에게 필요한 것을 구체적으로 부탁했다. 어렵다면 어렵다고 말해달라고도 전했다.`, { relationship: 2, focus: 1 }, contactId),
  ]);
  if (id === "hobby-project") return continuing(`${name}과 두 번째로 취미를 해본 날`, `처음보다 어색함은 줄었지만 시간과 비용을 계속 쓸 수 있을지는 고민된다. 생활에 무리 없는 방법을 고를 수 있다.`, [
    choice("hobby-regular", "한 달에 한 번만 같이 하기로 한다", "꾸준히 할 수 있는 빈도를 찾는다", `${name}과 한 달에 한 번 만나는 날을 정했다. 다른 일정과 예산을 해치지 않게 이어가기로 했다.`, { relationship: 3, mood: 2 }, contactId),
    choice("hobby-solo", "각자 연습하고 다음에 결과를 나눈다", "함께하지 않는 시간에도 관심을 이어간다", `${name}과 각자 해볼 것을 정했다. 다음에 만날 때 서로의 변화를 보여주기로 했다.`, { relationship: 2, focus: 2 }, contactId),
    choice("hobby-pause", "당분간 쉬되 다시 시작할 때를 정한다", "흥미가 사라지기 전에 부담부터 조절한다", `${name}과 잠시 쉬는 데 동의했다. 다시 해보고 싶은 시기를 정해 아예 흐지부지되지 않게 했다.`, { relationship: 2, stress: -1 }, contactId),
  ]);
  if (id === "career-mentor") return continuing(`${name}의 소개로 첫 대화를 앞두고`, `상대가 시간을 내주기로 했다. 잘 보이려 애쓰기보다 궁금한 점과 내 상황을 솔직하게 나눌 준비를 할 수 있다.`, [
    choice("mentor-meet", "내가 해온 일을 짧게 정리해 만난다", "도움을 구체적으로 요청한다", `${name}의 소개로 만난 사람에게 지금까지 해온 일과 고민을 설명했다. 당장 답을 얻기보다 다음에 준비할 방향을 들었다.`, { focus: 3, relationship: 2 }, contactId),
    choice("mentor-question", "현업의 하루와 어려운 점부터 묻는다", "나와 맞는 일인지 현실을 확인한다", `${name}이 연결해준 사람에게 실제 업무 이야기를 들었다. 막연한 동경과 현실을 함께 살펴볼 수 있었다.`, { focus: 4, stress: -1 }, contactId),
    choice("mentor-thank", "소개해준 사람에게 고마움을 전한다", "관계의 도움을 당연하게 여기지 않는다", `${name}에게 고맙다고 전했다. 소개를 받은 뒤에도 진행 상황을 알려주기로 했다.`, { relationship: 3, mood: 1 }, contactId),
  ]);
  return { id: `thread-${id}-stage-2-${route}`, thread: { id, stage: 2 }, title: "이번 주엔 어디까지 가볼까?", eyebrow: "구직 · 이어지는 이야기", body: "지원 과정에서 얻은 경험을 다음 계획으로 옮길 차례다. 구직을 계속하되 준비와 회복의 균형을 정할 수 있다.", choices: [
    choice("job-close-plan", "다음 주 지원 목표를 구체적으로 정한다", "실행할 수 있는 수와 시간을 정한다", "다음 주 지원할 곳과 준비 시간을 정했다. 막연한 걱정이 작은 일정으로 바뀌었다.", { focus: 3, stress: -1, goalProgress: 1 }),
    choice("job-close-support", "도움을 받을 사람에게 진행 상황을 나눈다", "혼자 준비하지 않도록 연결을 유지한다", "믿을 만한 사람에게 준비 상황을 나눴다. 조언을 받을 통로를 이어가기로 했다.", { mood: 2, stress: -2, relationship: 1 }),
  ] };
}



function hashText(value: string): number {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

type StoryBeat = { title: string; scene: string; dialogue: string };
const relationshipBeats: StoryBeat[] = [
  { title: "늦은 밤에 온 “잠깐 통화돼?”", scene: "별일 아닌 얘기부터 꺼냈지만, 통화는 생각보다 오래 이어졌다.", dialogue: "별일은 아닌데… 네 목소리 들으면 좀 정리될 것 같아서." },
  { title: "끝내 보내지 못한 메시지", scene: "대화창에 쓰다 지운 문장이 몇 번이나 있었다는 걸 알게 됐다.", dialogue: "괜히 무겁게 만들까 봐 지웠는데, 사실은 물어보고 싶었어." },
  { title: "같이 걷다가 나온 오래된 얘기", scene: "집에 가는 길이 길어졌고, 한동안 꺼내지 못한 이야기도 따라 나왔다.", dialogue: "그때는 말 못 했는데, 지금은 얘기해도 될 것 같아." },
  { title: "“요즘 너는 어때?”", scene: "안부를 묻는 짧은 메시지 뒤에 서로의 요즘이 천천히 펼쳐졌다.", dialogue: "내 얘기만 했네. 너는 진짜 요즘 어때?" },
  { title: "약속이 미뤄진 이유", scene: "약속 날짜를 다시 잡다가, 바빴다는 말 뒤에 있던 마음도 들었다.", dialogue: "바빴던 것도 맞지만, 그냥 내가 좀 여유가 없었어." },
  { title: "둘만 아는 농담", scene: "예전처럼 웃을 수 있는 순간이 생겼다. 어색함이 조금은 풀린 듯했다.", dialogue: "이 얘기에 웃는 거 보니까 우리 아직 괜찮네." },
  { title: "서로 모르는 친구의 이름", scene: "각자의 생활에 새로 들어온 사람들 이야기를 나누며 관계의 바깥도 알게 됐다.", dialogue: "다음엔 그 사람도 같이 보자. 네가 편하면." },
  { title: "말하지 않았던 바람", scene: "대화는 자연스럽게 각자가 앞으로 해보고 싶은 일로 옮겨갔다.", dialogue: "나 사실 요즘 꼭 해보고 싶은 게 하나 있어." },
  { title: "먼저 손 내민 날", scene: "누가 먼저랄 것도 없이 연락했고, 만나자는 말도 어렵지 않게 나왔다.", dialogue: "이번엔 내가 먼저 물어볼게. 시간 괜찮아?" },
  { title: "한쪽만 애쓰는 것 같을 때", scene: "다시 가까워지는 중에도 서운함은 남아 있었다. 이번엔 그걸 숨기지 않기로 했다.", dialogue: "나만 노력하는 것처럼 느껴질 때가 있었어." },
  { title: "함께할 이유가 하나 더 생겼다", scene: "작은 계획 하나가 둘의 다음 달 일정에 자리 잡았다.", dialogue: "이건 우리 둘이 같이 해보면 재밌겠다." },
  { title: "대답 대신 건넨 사진 한 장", scene: "긴 설명 대신 오늘의 풍경을 나눴다. 답장을 기다리는 시간도 한결 편해졌다.", dialogue: "오늘 이거 보자마자 네 생각났어." },
];
const careerBeats: StoryBeat[] = [
  { title: "선배에게서 다시 온 답장", scene: "잠잠하던 연락이 이어지며 막막했던 준비에 작은 실마리가 생겼다.", dialogue: "네가 물어본 거 생각해봤는데, 내가 아는 사람한테도 한번 물어볼게." },
  { title: "공고 하나를 두고 나눈 대화", scene: "조건은 괜찮지만 망설여지는 공고를 두고 서로 현실적인 이야기를 했다.", dialogue: "너한테 중요한 게 뭔지부터 보자. 연봉인지, 배우는 건지." },
  { title: "생각보다 길어진 모의 면접", scene: "연습으로 시작한 대화가 서로의 경험과 고민을 나누는 시간으로 바뀌었다.", dialogue: "답변은 괜찮았어. 근데 네가 진짜 하고 싶은 게 더 궁금해." },
  { title: "예상 밖의 작은 제안", scene: "큰 기회는 아니어도 경험을 이어갈 수 있는 일이 들어왔다.", dialogue: "바로 결정 안 해도 돼. 네 일정부터 같이 보자." },
  { title: "합격 소식 뒤에 남은 마음", scene: "기쁜 소식 또는 아쉬운 결과를 나눈 뒤, 다음에 무엇을 할지도 이야기했다.", dialogue: "결과가 어떻든 여기까지 온 것도 네가 해낸 거야." },
  { title: "서로 다른 길을 고민하는 밤", scene: "한 사람은 안정적인 선택을, 다른 사람은 새로운 도전을 생각하고 있었다.", dialogue: "우리 둘 다 정답은 모르지만, 네가 원하는 건 같이 찾아볼 수 있지." },
  { title: "이력서에 적지 못한 경험", scene: "숫자나 경력 칸에 담기지 않는 경험이 다음 선택의 기준이 됐다.", dialogue: "그때 네가 버틴 거, 이력서 한 줄보다 훨씬 큰 경험이야." },
  { title: "기회를 건넨 사람", scene: "소개가 바로 결과로 이어지진 않았지만, 다음 대화의 문이 열렸다.", dialogue: "연락처 보내줄게. 부담 갖지 말고 네 얘기부터 해봐." },
];
const moneyBeats: StoryBeat[] = [
  { title: "이번 달 카드 내역을 펼쳐놓고", scene: "작은 결제들이 모여 예상보다 큰 금액이 된 걸 확인했다.", dialogue: "이건 아낄 수 있겠고, 이건 우리한테 필요한 지출 같아." },
  { title: "고장 난 물건이 또 말썽", scene: "수리한 곳이 다시 문제를 일으켰다. 이번에는 급하게 결제하지 않고 대안을 살폈다.", dialogue: "저번에 급하게 처리했잖아. 이번엔 같이 견적부터 보자." },
  { title: "갑자기 잡힌 경조사", scene: "예상에 없던 일정과 지출이 겹쳤다. 마음과 예산을 함께 조정해야 했다.", dialogue: "마음은 전하고 싶은데, 이번 달 사정도 솔직히 말해보자." },
  { title: "월급날 전 일주일", scene: "남은 돈과 남은 날짜를 적어보니, 조금만 계획을 바꾸면 버틸 수 있을 것 같았다.", dialogue: "이번 주만 넘기는 계획 말고, 다음 달도 덜 불안하게 해보자." },
  { title: "도움받는 일도 연습이 필요했다", scene: "혼자 해결하려다 늦어지기 전에 가능한 지원과 분납 방법을 알아봤다.", dialogue: "말해줘서 고마워. 내가 해줄 수 있는 걸 같이 찾아보자." },
  { title: "이번에는 미리 모아둔 돈이 있었다", scene: "작게 나눠 둔 여유 자금이 급한 지출을 막아줬다.", dialogue: "큰돈은 아니어도 이렇게 해두길 잘했다." },
  { title: "싸다고 샀는데 결국 쓰지 않았다", scene: "가격보다 실제로 필요한지 먼저 생각해보기로 했다.", dialogue: "다음엔 하루만 생각해보고 사자. 우리 둘 다." },
  { title: "같이 정한 작은 기준", scene: "매달 얼마를 남기고 어디까지 쓸지 각자 부담 없는 선을 정했다.", dialogue: "완벽한 계획 말고, 지킬 수 있는 약속으로 하자." },
];
const sharedBeats: StoryBeat[] = [
  { title: "처음엔 그냥 해보자는 말이었다", scene: "가볍게 꺼낸 계획이 실제 날짜와 장소를 가진 약속이 됐다.", dialogue: "우리 이거 진짜 해보는 거야? 갑자기 재밌어지는데." },
  { title: "생각보다 일이 커졌다", scene: "둘만의 계획에 다른 사람도 관심을 보였다. 역할을 다시 나눌 때다.", dialogue: "이제 우리 둘이 다 할 순 없겠다. 누가 뭘 맡을지 정하자." },
  { title: "각자 바빠져서 멈춘 계획", scene: "메시지는 뜸해졌지만 완전히 접고 싶지는 않았다.", dialogue: "우리 이거 아직 하고 싶은 거 맞지? 작게라도 다시 시작해보자." },
  { title: "첫 결과물을 누군가 봤다", scene: "완벽하진 않았지만 누군가의 반응이 다음 걸음을 만들었다.", dialogue: "별거 아니라고 생각했는데, 좋아해주는 사람이 있더라." },
  { title: "의견이 처음으로 부딪혔다", scene: "같은 목표를 바라봐도 방법은 달랐다. 무엇을 지키고 싶은지 다시 확인했다.", dialogue: "네 방식이 틀렸다는 게 아니야. 내가 중요하게 보는 게 달라서 그래." },
  { title: "잠깐 쉬어도 없어지지 않은 마음", scene: "속도를 늦춘 뒤에도 계획은 남아 있었다. 다시 할 때를 정할 수 있다.", dialogue: "이번 달은 쉬고 다음 달에 다시 해도 괜찮지 않을까?" },
  { title: "다른 사람의 도움이 더해졌다", scene: "관계를 통해 새 아이디어와 역할이 들어왔다.", dialogue: "네가 전에 말한 그 친구, 우리 얘기 한번 들어볼래?" },
  { title: "계획보다 기억에 남은 하루", scene: "결과물보다 함께 준비하며 나눈 이야기가 오래 남을 것 같았다.", dialogue: "오늘은 많이 못 했는데, 그래도 만나길 잘했다." },
];

function ongoingChapter(state: GameState, id: string, thread: NonNullable<GameState["eventThreads"]>[string], name: string, person?: Contact): LifeEvent {
  const lane = id === "relationship-repair" ? "relationship"
    : id === "job-application" || id === "career-mentor" ? "career"
      : id === "unexpected-expense" ? "money"
        : /project|hobby|creative/.test(id) ? "shared" : "relationship";
  const beats = lane === "relationship" ? relationshipBeats : lane === "career" ? careerBeats : lane === "money" ? moneyBeats : sharedBeats;
  const routeKey = thread.route + (thread.history ?? []).slice(-3).join("|") + (thread.lastChoiceTitle ?? "") + (person?.mood ?? "");
  const beat = beats[(hashText(routeKey + ":" + thread.stage + ":" + state.week) % beats.length)];
  const linkedName = person?.name;
  const continuity = thread.lastChoiceTitle ? "지난번에 \"" + thread.lastChoiceTitle + "\"를 고른 뒤의 이야기다. " : "";
  const goalLine = person?.goal ? linkedName + "은 요즘 \"" + person.goal + "\"도 마음에 두고 있다. " : "";
  const actionLine = person?.lastAutonomousAction ? "한편 " + linkedName + "은 최근 \"" + person.lastAutonomousAction + "\"이라고 했다. " : "";
  const relationshipLine = person ? (person.warmth >= 65 ? linkedName + "은 너와 있으면 편하다고 했다. " : person.warmth <= 30 ? linkedName + "은 아직 조심스럽게 거리를 두고 있다. " : "") : "";
  const body = continuity + beat.scene + (person ? " " + relationshipLine + actionLine + goalLine : "");
  const chapter = thread.stage - 2;
  const chapterLabel = chapter + "번째 장";
  const episodeId = "thread-" + id + "-chapter-" + thread.stage + "-" + hashText(routeKey);
  const continueChoices = [
    choice("thread-step-" + id + "-" + thread.stage + "-talk",
      lane === "money" ? "이번엔 지출 얘기를 피하지 않는다" : lane === "career" ? "내가 원하는 조건부터 솔직히 말한다" : "이번엔 내 마음도 솔직히 꺼낸다",
      "상대의 생각도 듣고, 내 입장도 숨기지 않는다",
      person ? linkedName + "에게 솔직하게 이야기했다. " + beat.dialogue + " 대화를 나눈 뒤에도 다음에 이어갈 이야기가 남았다."
        : beat.scene + " 걱정만 되풀이하지 않고 내가 바꿀 수 있는 것부터 적었다.",
      { relationship: person ? 2 : 0, stress: -1, focus: 1 }, thread.contactId),
    choice("thread-step-" + id + "-" + thread.stage + "-act",
      lane === "career" ? "작은 기회부터 같이 움직여본다" : lane === "money" ? "다음 주에 지킬 수 있는 기준을 정한다" : "말을 행동으로 옮길 작은 약속을 잡는다",
      "크게 약속하지 않고 이번 주 안에 할 수 있는 걸 정한다",
      person ? linkedName + "과 이번 주에 할 일을 하나 정했다. " + beat.dialogue + " 약속을 지키면 다음 이야기도 달라질 수 있다."
        : "이번 주에 실천할 한 가지를 정했다. 작게 시작해 다음 주에 다시 돌아보기로 했다.",
      { relationship: person ? 3 : 0, focus: 2, stress: 1 }, thread.contactId),
    choice("thread-step-" + id + "-" + thread.stage + "-pause",
      "이번 주는 숨을 고르고 다음에 다시 잇는다",
      "관계를 끊지 않으면서도 부담을 낮춘다",
      person ? linkedName + "에게 지금 속도를 늦추고 싶다고 말했다. 서두르지 않기로 했고 이야기는 계속 열어두었다."
        : "당장 결론을 내리지 않고 시간을 두기로 했다. 다음에 이어갈 수 있도록 해야 할 일을 기록했다.",
      { relationship: person ? 1 : 0, energy: 3, stress: -2 }, thread.contactId),
    choice("thread-finish-" + id,
      "이 이야기는 여기서 마무리한다",
      "지금까지의 선택을 정리하고 다음 생활로 넘어간다",
      person ? linkedName + "과 지금까지의 일을 차분히 돌아봤다. 완벽한 결론은 아니어도 서로의 마음을 확인하고 이 이야기를 잘 마무리했다."
        : "이번 일을 돌아보고 앞으로 지킬 기준을 정했다. 이 이야기는 여기까지 두고 다음 생활로 넘어가기로 했다.",
      { relationship: person ? 2 : 0, mood: 1, focus: 1 }, thread.contactId),
  ];
  const dialogue = person ? {
    speakerName: linkedName!,
    line: beat.dialogue + (thread.lastChoiceTitle ? " 지난번 네가 고른 \"" + thread.lastChoiceTitle + "\"도 계속 생각해봤어." : ""),
  } : undefined;
  return {
    id: episodeId,
    thread: { id, stage: thread.stage },
    title: beat.title,
    eyebrow: "이어지는 이야기 · " + chapterLabel,
    body,
    ...(dialogue ? { npcDialogue: dialogue } : {}),
    choices: continueChoices,
  };
}

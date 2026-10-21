import type { Background, Effect, LifeEvent } from "./game";

type AuthoredChoice = [title: string, detail: string, result: string, effect: Effect, contactIndex?: number];
function authoredEvent(id: string, title: string, eyebrow: string, body: string, choices: AuthoredChoice[]): LifeEvent {
  return { id, title, eyebrow, body, choices: choices.map(([choiceTitle, detail, result, effect, contactIndex], index) => ({
    id: `${id}-${"abc"[index]}`, title: choiceTitle, detail, result, effect, contactIndex,
  })) };
}

// AI-assisted event drafts are stored as ordinary game data after review.
// Common events are mixed into each background's pool without runtime AI calls.
export const commonEventLibrary: LifeEvent[] = [
  {
    id: "common-introduction",
    title: "친구가 아는 사람을 소개해주겠다고 했다",
    eyebrow: "인맥 · 새로운 만남",
    body: "친구가 관심사가 잘 맞을 것 같은 사람을 소개해주겠다고 한다. 가볍게 이야기를 나누거나, 아직은 부담스럽다고 말할 수 있다.",
    choices: [
      { id: "intro-accept", title: "연락처를 받고 편하게 대화를 시작한다", detail: "새 인연을 만들고 연락을 이어간다", result: "서로의 관심사를 나누며 대화를 시작했다. 잘 맞는지는 천천히 알아가기로 했다.", effect: { mood: 4, stress: 1, relationship: 2, newContactOpportunity: 1 }, contactIndex: 1, meetingContext: "친구의 소개로 나간 작은 모임" },
      { id: "intro-group", title: "여럿이 만나는 자리부터 제안한다", detail: "부담을 낮추고 자연스럽게 알아간다", result: "친구들과 함께 만날 자리를 잡았다. 편한 분위기에서 서로를 알아갈 수 있게 됐다.", effect: { mood: 3, energy: -2, relationship: 3, newContactOpportunity: 0.8 }, contactIndex: 1, meetingContext: "친구들과 함께한 모임" },
      { id: "intro-decline", title: "고맙지만 이번에는 정중히 사양한다", detail: "지금의 생활 리듬을 우선한다", result: "소개는 다음 기회로 미뤘다. 친구도 네 상황을 이해해줬다.", effect: { stress: -2, relationship: 1 }, contactIndex: 1 },
    ],
  },
  {
    id: "common-date-plan",
    title: "서로 호감 있는 사람과 약속을 잡았다",
    eyebrow: "연애 · 관계",
    body: "최근 연락을 주고받던 사람이 주말에 만나자고 한다. 무엇을 할지와 어느 정도 마음을 표현할지 생각해볼 수 있다.",
    choices: [
      { id: "date-active", title: "관심 있던 장소를 골라 약속을 정한다", detail: "마음을 표현하고 만남을 기대한다", result: "함께 가고 싶었던 곳으로 약속을 잡았다. 서로에 대해 더 알아갈 시간이 생겼다.", effect: { money: -25000, mood: 8, energy: -3, relationship: 5 }, contactIndex: 1 },
      { id: "date-simple", title: "부담 없는 식사나 산책을 제안한다", detail: "편안한 분위기에서 대화한다", result: "가볍게 식사하며 이야기하기로 했다. 부담 없이 서로의 생각을 나눌 수 있을 것 같다.", effect: { money: -12000, mood: 5, stress: -2, relationship: 4 }, contactIndex: 1 },
      { id: "date-check", title: "일정을 확인한 뒤 가능한 시간을 답한다", detail: "기대와 현실적인 일정을 함께 맞춘다", result: "서로 가능한 시간을 확인해 약속을 조율했다. 급하게 정하지 않아 마음이 편해졌다.", effect: { mood: 2, stress: -1, relationship: 2 }, contactIndex: 1 },
    ],
  },
  {
    id: "common-misunderstanding",
    title: "가까운 사람의 말이 마음에 걸렸다",
    eyebrow: "관계 · 대화",
    body: "평소와 다른 말투가 계속 신경 쓰인다. 바로 물어볼 수도 있고, 생각을 정리한 뒤 대화할 수도 있다.",
    choices: [
      { id: "misunderstanding-ask", title: "무슨 뜻이었는지 차분히 물어본다", detail: "오해를 풀고 상대의 입장도 듣는다", result: "서로 다르게 받아들인 부분을 확인했다. 대화 덕분에 마음에 걸리던 일이 풀렸다.", effect: { stress: -4, mood: 3, relationship: 4 }, contactIndex: 1 },
      { id: "misunderstanding-wait", title: "감정을 가라앉힌 뒤 나중에 이야기한다", detail: "말을 고르고 대화할 때를 기다린다", result: "잠시 생각을 정리한 뒤 이야기를 나눴다. 감정적인 말은 줄이고 핵심을 전할 수 있었다.", effect: { stress: -2, focus: 2, relationship: 2 }, contactIndex: 1 },
      { id: "misunderstanding-ignore", title: "이번에는 넘기고 거리를 둔다", detail: "갈등을 피하지만 답답함이 남을 수 있다", result: "당장은 대화를 미뤘다. 다툼은 피했지만 마음속 질문은 조금 남았다.", effect: { stress: 2, mood: -2, relationship: -2 }, contactIndex: 1 },
    ],
  },
  {
    id: "common-family-call",
    title: "가족에게서 오랜만에 연락이 왔다",
    eyebrow: "가족 · 안부",
    body: "가족이 근황을 묻고 주말에 들를 수 있는지 물었다. 일정과 마음의 여유를 생각해 답할 수 있다.",
    choices: [
      { id: "family-visit", title: "시간을 내어 얼굴을 보러 간다", detail: "이동과 지출이 있지만 함께 시간을 보낸다", result: "가족과 식사를 하며 근황을 나눴다. 서로 걱정했던 부분을 확인할 수 있었다.", effect: { money: -18000, energy: -4, mood: 5, relationship: 4 }, contactIndex: 2 },
      { id: "family-call", title: "오늘 통화하고 다음 일정을 잡는다", detail: "현재 일정과 가족을 함께 챙긴다", result: "통화로 안부를 나누고 다음에 만날 날짜를 정했다. 가족도 일정이 정해져 안심했다.", effect: { energy: -1, mood: 3, relationship: 3 }, contactIndex: 2 },
      { id: "family-reschedule", title: "이번 주는 어렵다고 솔직히 말한다", detail: "무리하지 않고 가능한 날을 제안한다", result: "이번 주 사정을 설명하고 다른 날을 제안했다. 아쉬움은 있었지만 서로 일정을 맞췄다.", effect: { stress: -2, relationship: 1 }, contactIndex: 2 },
    ],
  },
  {
    id: "common-unexpected-expense",
    title: "예상하지 못한 지출이 생겼다",
    eyebrow: "생활 · 돈 관리",
    body: "휴대전화 수리나 갑작스러운 경조사처럼 미루기 어려운 비용이 생겼다. 당장 지출하거나 다른 항목을 조정할 수 있다.",
    choices: [
      { id: "expense-pay", title: "필요한 비용을 처리하고 이번 달 계획을 조정한다", detail: "문제를 해결하고 다른 지출을 줄인다", result: "필요한 비용을 처리했다. 이번 달 여가 지출을 줄여 균형을 맞추기로 했다.", effect: { money: -65000, stress: -2, focus: 2 } },
      { id: "expense-compare", title: "가격과 대안을 비교한 뒤 결정한다", detail: "시간을 들여 부담을 낮춘다", result: "대안을 비교해 비용을 낮췄다. 시간을 썼지만 지출 부담은 줄었다.", effect: { money: -35000, energy: -2, focus: 3 } },
      { id: "expense-delay", title: "미뤄도 되는 지출인지 먼저 확인한다", detail: "현금 여유를 지키고 필요성을 따진다", result: "급하지 않은 항목은 다음 달로 미뤘다. 지금 쓸 돈과 나중에 쓸 돈을 구분했다.", effect: { focus: 2, stress: 1 } },
    ],
  },
  {
    id: "common-health-routine",
    title: "며칠째 생활 리듬이 흐트러졌다",
    eyebrow: "건강 · 일상",
    body: "잠드는 시간이 늦어지고 식사도 불규칙해졌다. 한 번에 바꾸기보다 오늘 할 수 있는 작은 조정을 고를 수 있다.",
    choices: [
      { id: "health-sleep", title: "오늘은 약속을 줄이고 일찍 잠든다", detail: "회복을 우선한다", result: "저녁 일정을 줄이고 충분히 쉬었다. 다음 날 컨디션이 조금 나아졌다.", effect: { energy: 9, stress: -5, mood: 2 } },
      { id: "health-walk", title: "가볍게 걷고 식사 시간을 챙긴다", detail: "무리하지 않고 리듬을 되찾는다", result: "잠깐 걸은 뒤 제때 식사했다. 생활 리듬을 되돌릴 작은 계기가 됐다.", effect: { energy: 4, mood: 4, stress: -3 } },
      { id: "health-plan", title: "이번 주에 지킬 수면 시간을 정한다", detail: "실행 가능한 기준을 세운다", result: "무리하지 않을 취침 시간을 정했다. 하루씩 지켜보며 조정하기로 했다.", effect: { focus: 3, stress: -2 } },
    ],
  },
  {
    id: "common-hobby-invite",
    title: "관심 있던 취미 모임에 초대받았다",
    eyebrow: "여가 · 새로운 경험",
    body: "친구가 운동이나 전시 모임에 같이 가자고 한다. 비용과 시간을 확인하고 참여 방식을 정할 수 있다.",
    choices: [
      { id: "hobby-join", title: "이번 모임에 함께 간다", detail: "새 경험을 하고 관계도 이어간다", result: "새로운 활동을 경험하고 함께 간 사람과 이야기를 나눴다. 기분 전환이 됐다.", effect: { money: -20000, energy: -4, mood: 7, relationship: 3, newContactOpportunity: 0.8 }, contactIndex: 1, meetingContext: "관심사가 비슷한 취미 모임" },
      { id: "hobby-trial", title: "체험만 해보고 계속할지 결정한다", detail: "큰 지출 전에 나와 맞는지 살핀다", result: "체험으로 분위기와 난이도를 확인했다. 계속할지는 생활비와 일정에 맞춰 정하기로 했다.", effect: { money: -8000, focus: 2, mood: 4, newContactOpportunity: 0.45 }, meetingContext: "관심사가 비슷한 취미 체험" },
      { id: "hobby-pass", title: "이번에는 쉬고 다음 기회를 기약한다", detail: "예산이나 체력을 고려한다", result: "이번에는 쉬기로 했다. 관심은 남겨두고 여유가 생기면 다시 참여하기로 했다.", effect: { energy: 4, stress: -2 } },
    ],
  },
  {
    id: "common-message-late",
    title: "답장이 늦어 괜히 신경이 쓰인다",
    eyebrow: "메신저 · 관계",
    body: "보낸 메시지를 상대가 읽었지만 답이 없다. 바쁜 사정일 수 있지만, 기다리는 동안 여러 생각이 든다.",
    choices: [
      { id: "message-wait", title: "상대의 시간을 두고 기다린다", detail: "섣부른 판단을 보류한다", result: "바로 결론을 내리지 않고 기다렸다. 상대에게 답할 시간이 필요할 수도 있다.", effect: { stress: -2, focus: 1 } },
      { id: "message-followup", title: "필요한 내용만 짧게 다시 보낸다", detail: "확인이 필요한 부분을 명확히 한다", result: "확인이 필요한 내용을 짧게 덧붙였다. 답이 오면 바로 일정을 정할 수 있게 됐다.", effect: { stress: 1, focus: 2, relationship: 1 }, contactIndex: 1 },
      { id: "message-shift", title: "휴대전화를 내려놓고 다른 일을 한다", detail: "신경 쓰이는 시간을 줄인다", result: "메신저를 잠시 닫고 하던 일로 돌아갔다. 답을 기다리는 동안의 불편함이 줄었다.", effect: { mood: 2, focus: 3, stress: -3 } },
    ],
  },
];

export const eventLibrary: Record<Background, LifeEvent[]> = {
  student: [
    {
      id: "student-team",
      title: "팀 과제 역할을 나누는 날",
      eyebrow: "학교 · 관계",
      body: "수업이 끝난 뒤 팀원들이 과제 역할을 정하자고 한다. 맡을 일을 먼저 정하면 일정은 편해지지만, 이번 주 여유 시간은 줄어들 수 있다.",
      choices: [
        { id: "lead", title: "초안을 맡아 방향을 잡는다", detail: "주도권을 잡고 완성도를 높인다", result: "초안이 빠르게 잡혔다. 팀원들이 다음 논의도 함께하자고 한다.", effect: { energy: -9, focus: 8, stress: 4, mood: 3, relationship: 5 }, contactIndex: 0 },
        { id: "coordinate", title: "역할과 기한을 먼저 조율한다", detail: "부담을 나누고 일정부터 맞춘다", result: "각자 맡을 일이 분명해졌다. 진행 속도는 차분하지만 서로의 부담을 알게 됐다.", effect: { energy: -4, focus: 4, stress: -2, relationship: 4 }, contactIndex: 0 },
        { id: "limit", title: "이번 주 가능한 범위를 말한다", detail: "무리하지 않도록 참여 범위를 정한다", result: "할 수 있는 범위를 솔직히 전했다. 팀은 조금 조정했지만 일정은 유지됐다.", effect: { energy: 3, stress: -5, mood: 1, relationship: -1 }, contactIndex: 0 },
      ],
    },
    {
      id: "student-weekend",
      title: "주말 일정이 겹쳤다",
      eyebrow: "생활 · 선택",
      body: "생활비를 보탤 단기 근무 제안과 친구의 약속이 같은 시간에 들어왔다. 둘 다 중요한 이유가 있지만 이번에는 하나를 우선해야 한다.",
      choices: [
        { id: "shift", title: "단기 근무를 맡는다", detail: "수입을 얻고 주말 여유를 줄인다", result: "근무를 마치고 생활비를 보탰다. 약속은 다음으로 미뤘다.", effect: { money: 90000, energy: -12, stress: 3, mood: -2 }, contactIndex: 1 },
        { id: "meet", title: "친구와 만나기로 한다", detail: "관계를 챙기고 생활비 계획을 다시 세운다", result: "친구와 오랜만에 시간을 보냈다. 다음 주 지출을 조금 더 살펴보기로 했다.", effect: { energy: -3, mood: 9, stress: -5, relationship: 5 }, contactIndex: 1 },
        { id: "reschedule", title: "둘 다 가능한 시간으로 다시 조정한다", detail: "일정을 맞춰 보고 안 되면 하나를 선택한다", result: "근무 시간을 조정하고 약속도 늦은 시간으로 옮겼다. 하루는 바빴지만 두 일정을 모두 지켰다.", effect: { money: 50000, energy: -8, stress: 2, relationship: 2 }, contactIndex: 1 },
      ],
    },
    {
      id: "student-club",
      title: "동아리에서 새 사람을 만났다",
      eyebrow: "학교 · 인맥",
      body: "새 학기 모임에서 관심사가 비슷한 사람과 대화를 나눴다. 연락처를 주고받을지, 다음 모임에서 더 알아볼지 선택할 수 있다.",
      choices: [
        { id: "club-chat", title: "먼저 연락해 다음 모임을 잡는다", detail: "관계를 빠르게 이어가고 시간을 쓴다", result: "다음 모임 약속을 정했다. 새 인연과 대화할 기회가 생겼다.", effect: { energy: -3, mood: 5, relationship: 5 }, contactIndex: 3 },
        { id: "club-slow", title: "모임에서 자연스럽게 다시 만나기로 한다", detail: "부담 없이 천천히 알아간다", result: "서두르지 않고 모임에서 다시 보기로 했다. 편안한 속도로 관계를 이어갈 수 있다.", effect: { stress: -2, relationship: 2 }, contactIndex: 3 },
        { id: "club-leave", title: "오늘은 인사만 하고 돌아간다", detail: "개인 시간을 확보한다", result: "짧게 인사를 나누고 귀가했다. 혼자 쉴 시간이 생겼다.", effect: { energy: 4, mood: 1 } },
      ],
    },
    {
      id: "student-grade",
      title: "중간고사 계획을 세울 때다",
      eyebrow: "학업 · 컨디션",
      body: "시험 일정이 공지됐다. 준비를 일찍 시작하면 여유가 생기지만, 지금의 생활 리듬도 고려해야 한다.",
      choices: [
        { id: "grade-plan", title: "과목별로 현실적인 계획을 만든다", detail: "꾸준히 준비하며 부담을 나눈다", result: "과목별 공부 시간을 정했다. 막연했던 시험 준비가 조금 선명해졌다.", effect: { focus: 7, stress: -2, energy: -3 } },
        { id: "grade-study", title: "오늘부터 집중해서 공부한다", detail: "진도를 앞당기고 휴식을 줄인다", result: "예상보다 많은 진도를 나갔다. 성취감이 들지만 피로가 쌓였다.", effect: { focus: 10, energy: -9, stress: 5 } },
        { id: "grade-rest", title: "컨디션을 먼저 회복한다", detail: "하루 쉬고 내일 시작한다", result: "잠시 쉬며 기운을 회복했다. 계획은 내일 다시 세우기로 했다.", effect: { energy: 8, stress: -5, focus: -1 } },
      ],
    },
    {
      id: "student-rent",
      title: "이번 달 생활비를 점검했다",
      eyebrow: "생활 · 돈 관리",
      body: "교통비와 식비가 예상보다 늘었다. 작은 지출을 조정하거나 필요한 지출을 유지할 수 있다.",
      choices: [
        { id: "rent-track", title: "이번 주 지출 한도를 정한다", detail: "계획적으로 쓰고 여유를 남긴다", result: "이번 주 지출 기준을 세웠다. 필요한 것과 미룰 것을 구분하기 쉬워졌다.", effect: { focus: 3, stress: -2 } },
        { id: "rent-work", title: "짧은 아르바이트를 알아본다", detail: "수입 기회를 찾고 시간을 쓴다", result: "가능한 근무 일정을 알아봤다. 수입 선택지가 생겼지만 일정 조율이 필요하다.", effect: { energy: -4, focus: 2, mood: 1 } },
        { id: "rent-family", title: "가족과 지출 계획을 상의한다", detail: "도움을 구하고 현실적인 계획을 세운다", result: "상황을 나누고 다음 달 지출 계획을 함께 살펴봤다.", effect: { stress: -4, mood: 2, relationship: 2 }, contactIndex: 2 },
      ],
    },
    {
      id: "student-presentation",
      title: "발표 순서가 예상보다 빨리 돌아왔다",
      eyebrow: "학교 · 발표",
      body: "팀 발표 자료가 아직 완성되지 않았다. 완성도를 높일지, 핵심을 추려 제시간에 마무리할지 결정해야 한다.",
      choices: [
        { id: "presentation-polish", title: "늦게까지 자료를 다듬는다", detail: "완성도를 높이고 피로를 감수한다", result: "자료를 정리해 발표 흐름을 매끄럽게 만들었다. 잠은 줄었지만 준비가 됐다.", effect: { focus: 8, energy: -8, stress: 4 }, contactIndex: 0 },
        { id: "presentation-core", title: "핵심 메시지 위주로 완성한다", detail: "시간 안에 마무리하고 역할을 나눈다", result: "핵심 내용을 중심으로 발표를 마쳤다. 팀원들과 역할을 나눠 부담을 줄였다.", effect: { focus: 5, stress: -2, relationship: 2 }, contactIndex: 0 },
        { id: "presentation-help", title: "팀원에게 부족한 부분을 나눠 맡긴다", detail: "협업을 요청하고 일을 분담한다", result: "각자 맡을 부분을 다시 나눴다. 발표 준비가 한 사람에게 몰리지 않았다.", effect: { energy: 2, stress: -3, relationship: 3 }, contactIndex: 0 },
      ],
    },
    {
      id: "student-roommate",
      title: "함께 사는 사람과 생활 규칙이 달라졌다",
      eyebrow: "주거 · 관계",
      body: "청소와 소음 문제로 불편함이 쌓였다. 규칙을 다시 정하거나, 당장 필요한 부분부터 이야기할 수 있다.",
      choices: [
        { id: "roommate-talk", title: "서로 불편한 점을 구체적으로 나눈다", detail: "생활 기준을 맞춰본다", result: "청소와 조용한 시간대를 함께 정했다. 서로의 생활 방식 차이를 이해하게 됐다.", effect: { stress: -4, relationship: 4 }, contactIndex: 2 },
        { id: "roommate-small", title: "이번 주에 바꿀 한 가지만 정한다", detail: "작은 약속부터 실천한다", result: "당장 지킬 수 있는 약속 하나를 정했다. 큰 갈등 없이 변화를 시작했다.", effect: { stress: -2, focus: 1, relationship: 2 }, contactIndex: 2 },
        { id: "roommate-avoid", title: "일단 내 생활 공간을 정리한다", detail: "충돌을 피하고 개인 공간을 챙긴다", result: "내 공간을 먼저 정돈했다. 불편함은 남았지만 잠시 마음을 가라앉혔다.", effect: { mood: 2, energy: 2, relationship: -1 }, contactIndex: 2 },
      ],
    },
    {
      id: "student-shift-change",
      title: "아르바이트 근무를 더 맡아달라는 연락이 왔다",
      eyebrow: "아르바이트 · 일정",
      body: "추가 근무를 하면 생활비에 여유가 생긴다. 다만 시험과 약속 일정도 겹쳐 무리하지 않을 범위를 정해야 한다.",
      choices: [
        { id: "shift-take", title: "가능한 근무를 모두 맡는다", detail: "수입을 늘리고 여가를 줄인다", result: "추가 근무를 맡아 생활비를 보탰다. 일정은 빡빡해져 휴식 시간을 따로 챙겨야 한다.", effect: { money: 110000, energy: -10, stress: 4 } },
        { id: "shift-limit", title: "하루만 맡고 나머지는 어렵다고 말한다", detail: "수입과 학업 균형을 맞춘다", result: "하루만 추가 근무하기로 했다. 필요한 수입을 보태면서 공부 시간도 지킬 수 있다.", effect: { money: 55000, energy: -4, focus: 2 } },
        { id: "shift-decline", title: "이번 주는 어렵다고 정중히 거절한다", detail: "시험 준비와 회복을 우선한다", result: "이번 주는 어렵다고 미리 알렸다. 아쉬움은 있지만 예정된 일정을 지킬 수 있게 됐다.", effect: { energy: 3, stress: -3, relationship: 1 }, contactIndex: 5 },
      ],
    },
    {
      id: "student-scholarship",
      title: "장학금 신청 공지를 발견했다",
      eyebrow: "학업 · 기회",
      body: "성적과 활동 내역을 제출하면 장학금에 지원할 수 있다. 서류 준비 시간과 기대 효과를 고려해 선택할 수 있다.",
      choices: [
        { id: "scholarship-apply", title: "필요 서류를 확인해 지원한다", detail: "시간을 들여 재정 기회를 살핀다", result: "서류를 확인하고 신청을 마쳤다. 결과와 별개로 다음 기회에 쓸 자료도 정리했다.", effect: { focus: 6, energy: -3, stress: 2 } },
        { id: "scholarship-ask", title: "선배에게 준비 경험을 물어본다", detail: "정보를 얻고 준비 방향을 잡는다", result: "선배에게 제출 기준과 준비 팁을 들었다. 필요한 서류를 빠뜨리지 않도록 목록을 만들었다.", effect: { focus: 4, stress: -2, relationship: 2 }, contactIndex: 3 },
        { id: "scholarship-skip", title: "이번 학기는 일정이 빠듯해 넘긴다", detail: "당장 감당할 수 있는 일을 우선한다", result: "이번 신청은 넘기기로 했다. 다음 학기 일정을 미리 확인해두었다.", effect: { stress: -2, energy: 2 } },
      ],
    },
  ],
  jobseeker: [
    {
      id: "job-posting",
      title: "관심 있던 채용 공고를 발견했다",
      eyebrow: "구직 · 기회",
      body: "관심 분야의 공고가 올라왔다. 지원 기한은 아직 남아 있어 준비 정도와 생활 리듬을 고려해 대응할 수 있다.",
      choices: [
        { id: "apply", title: "현재 자료로 먼저 지원한다", detail: "기회를 놓치지 않고 경험을 쌓는다", result: "지원서를 제출했다. 결과를 기다리는 동안 다음 공고도 살펴볼 수 있다.", effect: { focus: 5, energy: -6, stress: 3, mood: 2 }, contactIndex: 0 },
        { id: "prepare", title: "하루 더 준비해 지원한다", detail: "자료를 다듬는 대신 시간이 든다", result: "경험과 지원 동기를 다시 정리했다. 제출은 늦어졌지만 설명이 조금 더 구체적이 됐다.", effect: { focus: 9, energy: -9, stress: 4 }, contactIndex: 0 },
        { id: "ask", title: "아는 사람에게 직무 정보를 물어본다", detail: "지원 전 정보를 얻고 연락을 부탁한다", result: "현직자의 조언을 들었다. 공고만으로 알기 어려웠던 업무 분위기를 파악했다.", effect: { energy: -3, mood: 4, stress: -2, relationship: 3 }, contactIndex: 1 },
      ],
    },
    {
      id: "job-friend",
      title: "친구가 이력서를 봐주겠다고 했다",
      eyebrow: "인맥 · 준비",
      body: "오랜만에 연락한 친구가 최근 지원 상황을 물으며 이력서를 함께 보자고 한다. 고마운 제안이지만 어디까지 공유할지 정할 수 있다.",
      choices: [
        { id: "share", title: "이력서를 보내고 구체적으로 피드백받는다", detail: "도움을 받아 개선점을 찾는다", result: "친구가 경험을 바탕으로 몇 군데를 짚어줬다. 다음 지원 전에 보완할 부분이 생겼다.", effect: { focus: 7, mood: 6, energy: -4, relationship: 5 }, contactIndex: 1 },
        { id: "talk", title: "이력서 대신 고민을 먼저 나눈다", detail: "부담을 낮추고 상황을 공유한다", result: "서로의 근황과 고민을 나눴다. 당장 자료를 고치진 않았지만 마음이 조금 가벼워졌다.", effect: { mood: 7, stress: -6, relationship: 4 }, contactIndex: 1 },
        { id: "decline", title: "고맙다고 하고 이번에는 혼자 준비한다", detail: "현재 방식대로 마무리한다", result: "친구에게 고마움을 전했다. 지원 자료를 스스로 정리하기로 했다.", effect: { focus: 3, energy: 2, relationship: -1 }, contactIndex: 1 },
      ],
    },
    {
      id: "job-interview",
      title: "면접 일정이 잡혔다",
      eyebrow: "구직 · 선택",
      body: "지원한 곳에서 면접을 제안했다. 준비에 집중할지, 주변에 조언을 구할지 정해야 한다.",
      choices: [
        { id: "interview-practice", title: "예상 질문을 정리하고 연습한다", detail: "집중력을 쓰고 준비도를 높인다", result: "답변을 소리 내어 연습했다. 부족한 부분을 확인해 보완할 수 있게 됐다.", effect: { focus: 9, energy: -5, stress: 3 } },
        { id: "interview-mentor", title: "경험 있는 선배에게 조언을 구한다", detail: "실전 정보를 얻고 관계를 이어간다", result: "선배가 면접 분위기와 준비 팁을 알려줬다. 걱정이 조금 줄었다.", effect: { focus: 4, mood: 4, stress: -4, relationship: 3 }, contactIndex: 0 },
        { id: "interview-rest", title: "일정을 확인하고 충분히 쉰다", detail: "컨디션을 지키며 준비 시간을 나눈다", result: "면접 시간을 확인하고 컨디션을 챙겼다. 준비는 다음 날 이어가기로 했다.", effect: { energy: 7, stress: -3 } },
      ],
    },
    {
      id: "job-budget",
      title: "고정 지출이 부담스럽게 느껴진다",
      eyebrow: "생활 · 돈 관리",
      body: "통신비와 구독료를 확인하다 보니 매달 나가는 돈이 눈에 들어왔다. 줄일 항목을 찾거나 현재 계획을 유지할 수 있다.",
      choices: [
        { id: "budget-review", title: "고정 지출을 하나씩 비교한다", detail: "시간을 들여 줄일 곳을 찾는다", result: "사용하지 않는 서비스를 찾아 정리했다. 다음 달부터 부담이 조금 줄 것 같다.", effect: { focus: 4, stress: -3 } },
        { id: "budget-plan", title: "구직 비용을 따로 나눠 둔다", detail: "교통·준비 비용을 계획한다", result: "구직에 필요한 비용을 따로 정리했다. 지출을 예측하기 쉬워졌다.", effect: { focus: 3, mood: 2 } },
        { id: "budget-talk", title: "가까운 사람에게 고민을 털어놓는다", detail: "조언을 듣고 마음을 가볍게 한다", result: "생활비 고민을 나눴다. 구체적인 답은 아직이지만 혼자 감당하는 기분은 덜했다.", effect: { stress: -5, mood: 4, relationship: 2 }, contactIndex: 1 },
      ],
    },
    {
      id: "job-rejection",
      title: "기대했던 지원 결과가 좋지 않았다",
      eyebrow: "구직 · 회복",
      body: "오래 준비한 곳에서 불합격 안내를 받았다. 잠시 쉬어갈 수도 있고, 다음 지원에 도움이 될 부분을 살필 수도 있다.",
      choices: [
        { id: "rejection-review", title: "공고와 준비 과정을 돌아본다", detail: "다음 지원에 쓸 개선점을 찾는다", result: "지원 과정을 정리해 부족했던 부분을 적었다. 결과는 아쉽지만 다음 준비 방향은 선명해졌다.", effect: { focus: 5, stress: 2, mood: -2 } },
        { id: "rejection-rest", title: "오늘은 구직 생각을 내려놓고 쉰다", detail: "감정을 회복할 시간을 둔다", result: "하루 동안 구직 알림을 잠시 껐다. 마음을 추스르고 다시 시작할 여유를 만들었다.", effect: { energy: 6, mood: 3, stress: -5 } },
        { id: "rejection-talk", title: "친구와 결과를 나누고 격려를 듣는다", detail: "혼자 감당하지 않고 이야기를 나눈다", result: "친구에게 아쉬운 마음을 털어놓았다. 서로의 경험을 나누며 조금 가벼워졌다.", effect: { mood: 5, stress: -4, relationship: 3 }, contactIndex: 1 },
      ],
    },
    {
      id: "job-course",
      title: "관심 분야 교육 과정 모집을 봤다",
      eyebrow: "구직 · 역량",
      body: "교육을 들으면 역량을 보완할 수 있지만, 일정과 비용이 부담이 될 수도 있다. 조건을 확인하고 현실적으로 판단할 수 있다.",
      choices: [
        { id: "course-enroll", title: "일정과 지원 조건을 확인해 신청한다", detail: "학습 시간을 투자한다", result: "과정 일정과 지원 여부를 확인했다. 참여할 수 있는 조건이라 다음 단계로 준비하기로 했다.", effect: { focus: 7, energy: -4, stress: 2 } },
        { id: "course-compare", title: "무료 자료와 다른 과정을 비교한다", detail: "비용 대비 효과를 따져본다", result: "대체 자료와 과정을 비교했다. 지금 필요한 내용을 먼저 익히기로 했다.", effect: { focus: 4, stress: -1 } },
        { id: "course-defer", title: "현재 지원 일정부터 마무리한다", detail: "우선순위를 정하고 기회를 보관한다", result: "모집 정보를 저장해두고 당장 필요한 지원을 먼저 하기로 했다.", effect: { focus: 2, stress: -2 } },
      ],
    },
    {
      id: "job-family-pressure",
      title: "가족이 취업 계획을 걱정하며 물어봤다",
      eyebrow: "가족 · 진로",
      body: "가족이 언제쯤 취업할 것 같은지 묻는다. 걱정에서 나온 질문일 수 있지만 부담도 된다. 현재 상황을 어느 정도 나눌지 정할 수 있다.",
      choices: [
        { id: "pressure-explain", title: "현재 준비 상황과 계획을 설명한다", detail: "기대치를 맞추고 응원을 부탁한다", result: "준비 중인 내용과 계획을 차분히 설명했다. 가족도 기다리는 동안 어떻게 도울지 물었다.", effect: { stress: -3, relationship: 4 }, contactIndex: 2 },
        { id: "pressure-boundary", title: "결과가 정해지면 먼저 알리겠다고 말한다", detail: "필요한 경계를 세운다", result: "반복해서 묻는 일이 부담된다고 전했다. 가족은 걱정을 표현하는 방식을 조정해보기로 했다.", effect: { stress: -2, relationship: 1 }, contactIndex: 2 },
        { id: "pressure-avoid", title: "대화를 짧게 마치고 다른 이야기로 넘긴다", detail: "당장 갈등을 피한다", result: "대화는 넘어갔지만 마음속 부담은 남았다. 다음에는 편한 때에 이야기해보기로 했다.", effect: { stress: 2, mood: -1 } },
      ],
    },
    {
      id: "job-freelance",
      title: "짧은 외주 일을 제안받았다",
      eyebrow: "일거리 · 수입",
      body: "아는 사람이 작은 프로젝트를 맡아달라고 한다. 포트폴리오와 수입에 도움이 될 수 있지만 범위와 보수를 확인해야 한다.",
      choices: [
        { id: "freelance-accept", title: "업무 범위와 보수를 확인하고 맡는다", detail: "수입과 경험을 얻고 시간을 투자한다", result: "업무 범위와 보수를 합의한 뒤 일을 맡았다. 경험을 쌓으면서 생활비도 보탤 수 있다.", effect: { money: 120000, focus: 5, energy: -7, stress: 2 }, contactIndex: 7 },
        { id: "freelance-negotiate", title: "기한이나 보수를 조정해 제안한다", detail: "감당 가능한 조건을 만든다", result: "기한과 보수를 조정해 제안했다. 서로 조건을 맞출 수 있는지 확인하기로 했다.", effect: { focus: 3, stress: -1, relationship: 2 }, contactIndex: 7 },
        { id: "freelance-decline", title: "현재 일정상 맡기 어렵다고 말한다", detail: "구직 준비 시간을 확보한다", result: "현재 일정을 설명하고 이번에는 거절했다. 준비하던 지원에 집중할 수 있게 됐다.", effect: { energy: 3, focus: 2, relationship: 1 }, contactIndex: 7 },
      ],
    },
  ],
  worker: [
    {
      id: "work-request",
      title: "동료가 급한 업무를 부탁했다",
      eyebrow: "직장 · 협업",
      body: "마감이 임박한 업무를 도와 달라는 요청을 받았다. 맡으면 협업에 도움이 되지만, 내 업무 일정도 확인해야 한다.",
      choices: [
        { id: "help", title: "우선 도와주고 내 일정을 조정한다", detail: "협업을 택하고 회복 시간을 줄인다", result: "급한 부분을 함께 마무리했다. 동료가 고마움을 전했고 내 업무는 조금 늦게 끝났다.", effect: { energy: -10, stress: 5, mood: 2, relationship: 5 }, contactIndex: 0 },
        { id: "prioritize", title: "기한과 우선순위를 함께 맞춘다", detail: "도울 범위와 내 업무 마감을 조율한다", result: "도울 부분과 내 마감 일정을 함께 정리했다. 무리 없이 협업할 범위가 잡혔다.", effect: { energy: -4, stress: -2, focus: 5, relationship: 3 }, contactIndex: 0 },
        { id: "decline", title: "현재 맡은 일을 설명하고 거절한다", detail: "업무 경계를 지키고 대안을 제안한다", result: "현재 일정을 설명하고 다른 지원 방법을 안내했다. 요청은 조정됐고 내 마감은 지켰다.", effect: { energy: 3, stress: -5, focus: 2, relationship: -1 }, contactIndex: 0 },
      ],
    },
    {
      id: "work-evening",
      title: "퇴근 뒤 약속을 정해야 한다",
      eyebrow: "생활 · 관계",
      body: "동료가 저녁을 먹자고 제안했다. 이번 주는 피로가 쌓였지만 함께 시간을 보내면 서로를 더 알 수 있다.",
      choices: [
        { id: "join", title: "저녁 약속에 참석한다", detail: "관계를 쌓고 휴식 시간을 줄인다", result: "식사하며 업무 밖 이야기를 나눴다. 귀가는 늦었지만 동료와 한결 편해졌다.", effect: { energy: -7, money: -18000, mood: 5, relationship: 4 }, contactIndex: 1 },
        { id: "rest", title: "오늘은 쉬고 다음에 만나자고 한다", detail: "컨디션을 회복하고 관계는 이어간다", result: "오늘은 집에서 쉬기로 했다. 다음에 보자고 전했고 동료도 일정을 다시 잡자고 했다.", effect: { energy: 9, stress: -5, relationship: 1 }, contactIndex: 1 },
        { id: "short", title: "잠깐만 들르고 일찍 귀가한다", detail: "만남과 회복 시간을 함께 챙긴다", result: "짧게 식사하고 일찍 귀가했다. 피로는 남았지만 대화할 시간은 가졌다.", effect: { energy: -3, money: -10000, mood: 3, relationship: 3 }, contactIndex: 1 },
      ],
    },
    {
      id: "work-feedback",
      title: "업무 피드백을 받았다",
      eyebrow: "직장 · 성장",
      body: "최근 맡은 일에 대해 상사가 피드백을 줬다. 바로 개선점을 확인하거나, 먼저 맥락을 더 물어볼 수 있다.",
      choices: [
        { id: "feedback-apply", title: "개선점을 메모하고 다음 일에 적용한다", detail: "성장을 위해 집중력을 쓴다", result: "피드백을 정리해 다음 업무에 반영하기로 했다. 개선할 방향이 구체적으로 보인다.", effect: { focus: 7, stress: 2, energy: -3 } },
        { id: "feedback-ask", title: "구체적인 사례와 기대치를 물어본다", detail: "업무 기준을 명확히 한다", result: "기대하는 기준과 사례를 확인했다. 막연했던 부분이 조금 선명해졌다.", effect: { focus: 5, stress: -2, relationship: 2 }, contactIndex: 0 },
        { id: "feedback-rest", title: "오늘은 받아들이고 내일 다시 살펴본다", detail: "감정을 가라앉히고 회복한다", result: "잠시 거리를 두고 생각하기로 했다. 퇴근 후에는 일에서 벗어나 쉬었다.", effect: { energy: 5, stress: -4 } },
      ],
    },
    {
      id: "work-commute",
      title: "출퇴근 시간이 유난히 길게 느껴진다",
      eyebrow: "생활 · 컨디션",
      body: "이번 주 이동 시간이 늘면서 피로가 쌓였다. 이동 중 할 일을 정하거나, 일정과 휴식을 조정해 볼 수 있다.",
      choices: [
        { id: "commute-audio", title: "이동 중 가벼운 공부나 오디오를 듣는다", detail: "시간을 활용하되 무리하지 않는다", result: "이동 시간을 조금 더 편하게 보냈다. 하루를 시작하는 기분도 나아졌다.", effect: { mood: 3, focus: 2, energy: -2 } },
        { id: "commute-rest", title: "이동 시간에는 눈을 붙이고 쉰다", detail: "회복을 우선한다", result: "이동 중 잠시 쉬었다. 도착했을 때 피로가 조금 덜했다.", effect: { energy: 6, focus: 1 } },
        { id: "commute-plan", title: "재택·유연 일정이 가능한지 확인한다", detail: "업무 방식과 생활 리듬을 조정한다", result: "일정을 살펴보고 조정 가능성을 문의했다. 당장 바뀌진 않아도 대안을 확인했다.", effect: { focus: 3, stress: -2 } },
      ],
    },
    {
      id: "work-overtime",
      title: "갑작스러운 추가 업무가 쌓였다",
      eyebrow: "직장 · 업무량",
      body: "마감이 겹쳐 예정된 업무량을 넘었다. 우선순위를 다시 맞추거나, 당장 가능한 만큼만 맡을 수 있다.",
      choices: [
        { id: "overtime-all", title: "오늘 남아 최대한 처리한다", detail: "마감을 지키고 회복 시간을 줄인다", result: "남은 업무를 상당 부분 처리했다. 마감은 가까워졌지만 피로가 쌓였다.", effect: { focus: 6, energy: -10, stress: 6 } },
        { id: "overtime-prioritize", title: "기한과 우선순위를 상사와 다시 맞춘다", detail: "현실적인 업무 범위를 정한다", result: "마감과 우선순위를 조정했다. 급한 일부터 진행하고 나머지는 일정을 다시 잡았다.", effect: { focus: 4, stress: -3, relationship: 2 }, contactIndex: 0 },
        { id: "overtime-boundary", title: "오늘 가능한 범위를 정하고 퇴근한다", detail: "지속 가능한 일정을 지킨다", result: "오늘 마칠 범위를 공유하고 퇴근했다. 남은 업무는 내일 처리하기로 했다.", effect: { energy: 4, stress: -2, focus: 1 } },
      ],
    },
    {
      id: "work-payday",
      title: "급여가 들어와 이번 달 계획을 세운다",
      eyebrow: "직장 · 돈 관리",
      body: "급여가 입금됐다. 고정 지출과 저축, 여가 비용을 살피고 이번 달 사용할 기준을 정할 수 있다.",
      choices: [
        { id: "payday-save", title: "고정 지출과 저축을 먼저 나눈다", detail: "남은 돈 안에서 생활한다", result: "고정 지출과 저축 몫을 먼저 분리했다. 이번 달 쓸 수 있는 범위가 분명해졌다.", effect: { focus: 5, stress: -3 } },
        { id: "payday-enjoy", title: "미뤄둔 작은 여가 계획을 잡는다", detail: "생활의 즐거움도 예산에 반영한다", result: "감당 가능한 범위에서 여가 계획을 세웠다. 돈을 쓰면서도 부담을 줄일 기준을 정했다.", effect: { money: -40000, mood: 6, stress: -2 } },
        { id: "payday-support", title: "가족과 필요한 지원을 상의한다", detail: "상황에 맞게 함께 계획한다", result: "가족과 필요한 지출을 상의했다. 지원 여부와 범위를 현실적으로 정리했다.", effect: { stress: -2, relationship: 3 }, contactIndex: 2 },
      ],
    },
    {
      id: "work-leave",
      title: "쌓인 피로를 보니 휴가가 필요해 보인다",
      eyebrow: "직장 · 휴식",
      body: "최근 쉬는 날에도 업무 생각이 이어졌다. 휴가를 계획하거나, 이번 주에 작은 휴식부터 확보할 수 있다.",
      choices: [
        { id: "leave-book", title: "가능한 날짜를 확인해 하루 쉰다", detail: "미리 일정을 조정하고 회복한다", result: "업무 일정을 확인해 휴가를 신청했다. 쉬는 날을 기다리며 당장 급한 일을 정리했다.", effect: { stress: -4, mood: 4, focus: 2 } },
        { id: "leave-evening", title: "오늘 저녁은 일정을 비우고 쉰다", detail: "짧게라도 회복 시간을 만든다", result: "저녁 약속과 업무 확인을 미뤘다. 짧은 휴식이지만 머리를 식힐 수 있었다.", effect: { energy: 7, stress: -4 } },
        { id: "leave-talk", title: "업무 분담을 동료와 상의한다", detail: "혼자 버티지 않고 업무를 조정한다", result: "동료와 업무량을 나눌 수 있는지 이야기했다. 조정할 일이 구체적으로 정리됐다.", effect: { stress: -2, relationship: 3 }, contactIndex: 0 },
      ],
    },
    {
      id: "work-review",
      title: "다음 분기 목표를 정해야 한다",
      eyebrow: "직장 · 성장",
      body: "팀에서 다음 분기 목표를 작성해달라고 했다. 실적뿐 아니라 업무량과 배우고 싶은 역량도 고려할 수 있다.",
      choices: [
        { id: "review-stretch", title: "도전적인 목표와 필요한 지원을 함께 적는다", detail: "성장 기회를 얻고 부담을 관리한다", result: "도전 목표와 필요한 지원을 같이 제안했다. 기대와 현실을 맞춰볼 대화가 열렸다.", effect: { focus: 7, stress: 3, relationship: 2 }, contactIndex: 3 },
        { id: "review-realistic", title: "현재 업무 기준으로 달성 가능한 목표를 세운다", detail: "꾸준히 이행할 계획을 만든다", result: "기존 업무와 이어지는 목표를 세웠다. 무리 없이 점검할 수 있는 기준도 정했다.", effect: { focus: 5, stress: -2 } },
        { id: "review-learn", title: "배우고 싶은 기술을 목표로 넣는다", detail: "장기적인 역량 개발을 챙긴다", result: "업무와 연결되는 학습 목표를 추가했다. 작은 프로젝트부터 경험해보기로 했다.", effect: { focus: 6, mood: 2, energy: -2 } },
      ],
    },
  ],
};

// Balanced expansion pack: nine additional authored events per background.
eventLibrary.student.push(
  authoredEvent("student-internship", "관심 기업의 인턴 공고가 올라왔다", "진로 · 기회", "학기 중 인턴 공고를 발견했다. 수업과 일정이 겹치지만 경험을 쌓을 기회가 될 수 있다.", [
    ["지원 자격과 일정을 꼼꼼히 확인한다", "수업과 병행 가능한지 먼저 따진다", "일정과 요건을 확인했다. 감당 가능한 기간이라 지원 준비를 시작했다.", { focus: 5, stress: 1 }],
    ["선배에게 실제 업무 경험을 물어본다", "정보를 얻고 기대를 현실적으로 맞춘다", "선배에게 근무 분위기와 준비 과정을 들었다. 공고만으로 몰랐던 점을 알게 됐다.", { focus: 3, stress: -2, relationship: 2 }, 3],
    ["이번 학기는 학업에 집중하기로 한다", "기회는 저장하고 현재 우선순위를 지킨다", "공고를 저장해두고 이번 학기는 수업을 우선하기로 했다.", { energy: 3, stress: -2 }],
  ]),
  authoredEvent("student-project-showcase", "팀 프로젝트 결과물을 공개할 기회가 생겼다", "학교 · 성장", "수업에서 만든 결과물을 교내 발표회에 낼 수 있다. 다듬을 시간과 참여 범위를 결정해야 한다.", [
    ["팀을 모아 제출까지 진행한다", "완성도를 높이고 협업한다", "팀원들과 역할을 다시 나눠 결과물을 제출했다. 함께 만든 경험이 남았다.", { focus: 6, energy: -5, relationship: 3 }, 0],
    ["현재 결과물로 부담 없이 참여한다", "완벽함보다 경험을 얻는다", "현재 수준의 결과물로 참여하기로 했다. 발표를 준비하며 개선점을 확인했다.", { focus: 3, mood: 3, stress: -1 }, 0],
    ["이번에는 관람하며 다음 기회를 살핀다", "시간을 확보하고 다른 작품에서 배운다", "이번에는 참여하지 않고 발표회를 둘러봤다. 다음 학기에 적용할 아이디어를 얻었다.", { mood: 2, focus: 2 }],
  ]),
  authoredEvent("student-tuition", "등록금 납부 안내가 도착했다", "학교 · 돈 관리", "납부 기한과 분할 납부 안내를 확인했다. 가족과 상의하거나 학교의 지원 제도를 알아볼 수 있다.", [
    ["장학·분납 제도를 학교에 문의한다", "가능한 지원을 확인한다", "학교에 지원 제도를 문의했다. 선택 가능한 납부 방법과 신청 기한을 확인했다.", { focus: 4, stress: -2 }],
    ["가족과 납부 계획을 함께 세운다", "필요한 도움과 범위를 솔직히 논의한다", "가족과 납부 시기를 상의했다. 각자 가능한 범위를 정리해 부담을 나눴다.", { stress: -3, relationship: 3 }, 2],
    ["다음 달 지출을 줄여 직접 마련한다", "지출 계획을 조정해 대응한다", "이번 달 여가 지출을 조정해 납부 계획을 세웠다. 당분간 소비를 살필 필요가 있다.", { focus: 3, stress: 2 }],
  ]),
  authoredEvent("student-friend-group", "친구들 사이에서 약속 장소 의견이 갈렸다", "친구 · 약속", "모임 장소를 정하는데 각자 원하는 곳이 다르다. 모두의 사정과 예산을 고려해 정할 수 있다.", [
    ["이동 거리와 예산을 기준으로 제안한다", "현실적인 기준으로 합의점을 찾는다", "모두가 이동하기 편한 곳을 제안했다. 몇 가지 후보를 비교해 합의했다.", { stress: -2, relationship: 3 }, 1],
    ["이번에는 다른 친구의 선택을 따른다", "갈등을 줄이고 모임을 이어간다", "친구가 제안한 장소로 정했다. 다음 모임에서는 다른 의견도 반영하기로 했다.", { mood: 2, relationship: 2 }, 1],
    ["예산이 부담돼 모임은 다음으로 미룬다", "무리한 지출을 피한다", "이번에는 참석이 어렵다고 말했다. 친구들과 다음에 부담 없는 약속을 잡기로 했다.", { money: 0, stress: -1, relationship: -1 }, 1],
  ]),
  authoredEvent("student-health-check", "계속 미뤄온 건강검진 안내를 확인했다", "건강 · 생활", "검진 예약 문자를 받았다. 수업과 아르바이트 일정 사이에서 시간을 정해야 한다.", [
    ["가까운 날짜로 예약한다", "일정을 조정해 건강을 챙긴다", "검진 일정을 예약했다. 미뤄왔던 일을 처리해 마음이 한결 가벼워졌다.", { stress: -3, focus: 1 }],
    ["무료·학생 지원 항목을 먼저 확인한다", "비용과 검진 범위를 살핀다", "지원 대상과 검진 항목을 확인했다. 비용 부담을 줄일 방법을 찾았다.", { focus: 3, stress: -1 }],
    ["이번 주 일정을 정리한 뒤 예약한다", "기한을 기록하고 놓치지 않게 준비한다", "이번 주 일정표에 예약할 시간을 적었다. 정해둔 날짜에 다시 확인하기로 했다.", { focus: 2 }],
  ]),
  authoredEvent("student-romance-confession", "친해진 사람이 마음을 고백했다", "연애 · 관계", "가깝게 지내던 사람이 연애 감정을 전했다. 고마운 마음과 자신의 감정을 솔직하게 살펴 답할 수 있다.", [
    ["나도 호감이 있어 천천히 만나보기로 한다", "서로의 기대와 속도를 이야기한다", "서로 호감을 확인하고 천천히 만나보기로 했다. 관계의 속도와 서로 원하는 점을 나눴다.", { mood: 8, stress: 2, relationship: 6 }, 1],
    ["마음은 고맙지만 연애 감정은 아니라고 말한다", "기대하게 하지 않도록 정직하게 답한다", "고백은 고맙지만 같은 마음은 아니라고 전했다. 상대의 감정을 존중하며 거리를 조율했다.", { stress: -1, relationship: -2 }, 1],
    ["생각할 시간이 필요하다고 솔직히 말한다", "바로 답하기보다 감정을 정리한다", "조금 생각할 시간이 필요하다고 말했다. 서로 답을 서두르지 않기로 했다.", { stress: 1, focus: 1, relationship: 1 }, 1],
  ]),
  authoredEvent("student-device-repair", "노트북이 갑자기 고장 났다", "생활 · 예상 지출", "과제에 필요한 노트북이 켜지지 않는다. 수리와 대여 비용을 비교하고 과제 마감도 챙겨야 한다.", [
    ["수리 견적을 받아 가능한 범위에서 고친다", "기기 상태와 비용을 확인한다", "수리 견적과 기간을 확인했다. 과제 전에 받을 수 있어 수리를 맡겼다.", { money: -70000, stress: -2 }],
    ["학교 대여 기기를 먼저 알아본다", "당장 필요한 작업을 이어간다", "학교 대여 기기를 빌려 과제를 이어갔다. 수리는 여유를 두고 비교하기로 했다.", { focus: 3, stress: -1 }],
    ["자료를 백업하고 새 기기 구매를 비교한다", "장기 비용과 필요 사양을 따진다", "자료를 확인하고 필요한 사양을 정리했다. 급하게 구매하지 않기로 했다.", { focus: 2, stress: 2 }],
  ]),
  authoredEvent("student-club-budget", "동아리 회비가 예상보다 올랐다", "학교 · 모임", "동아리 운영진이 다음 학기 회비 인상을 안내했다. 참여 빈도와 예산을 따져볼 수 있다.", [
    ["회비 내역을 확인하고 계속 참여한다", "활동 가치와 비용을 함께 판단한다", "회비 사용 계획을 확인했다. 참여할 활동이 충분해 계속하기로 했다.", { money: -30000, mood: 3, relationship: 2 }, 3],
    ["필요한 활동만 참여할 수 있는지 묻는다", "비용 부담을 줄이는 방법을 찾는다", "운영진과 참여 범위를 상의했다. 가능한 대안을 검토해보기로 했다.", { focus: 2, stress: -1, relationship: 1 }, 3],
    ["이번 학기는 쉬고 예산을 아낀다", "참여 빈도에 맞춰 지출을 조절한다", "이번 학기는 쉬기로 했다. 친한 사람들과는 개인적으로 연락을 이어가기로 했다.", { money: 0, energy: 2, relationship: -1 }, 3],
  ]),
  authoredEvent("student-volunteer", "주말 봉사활동에 같이 가자는 제안을 받았다", "지역 · 경험", "친구가 지역 봉사활동에 함께 참여하자고 한다. 의미 있는 경험이 될 수 있지만 주말 일정도 고려해야 한다.", [
    ["함께 신청하고 역할을 맡는다", "시간을 들여 새로운 경험을 한다", "친구와 봉사활동에 참여했다. 함께 움직이며 평소와 다른 이야기를 나눴다.", { energy: -4, mood: 5, relationship: 3 }, 1],
    ["짧은 시간만 참여할 수 있는지 확인한다", "가능한 범위에서 참여한다", "참여 시간을 조정해 일부 활동을 맡았다. 부담을 줄이면서 경험을 나눴다.", { energy: -2, mood: 3, relationship: 2 }, 1],
    ["이번 주는 어렵다고 다음 기회를 약속한다", "휴식과 일정을 우선한다", "이번 주 일정은 어렵다고 전하고 다음 기회에 같이 하기로 했다.", { energy: 3, stress: -2, relationship: 1 }, 1],
  ]),
);

eventLibrary.jobseeker.push(
  authoredEvent("job-second-interview", "최종 면접에 참석해달라는 연락이 왔다", "구직 · 면접", "최종 면접 일정을 안내받았다. 준비를 보완하고 컨디션을 관리할 방법을 고를 수 있다.", [
    ["예상 질문을 정리해 모의 면접을 한다", "집중적으로 연습하고 피드백을 받는다", "답변을 연습하고 부족한 부분을 보완했다. 면접에서 전할 경험도 정리됐다.", { focus: 7, energy: -5, stress: 3 }],
    ["현직 선배에게 회사 분위기를 물어본다", "실제 업무와 팀 문화를 파악한다", "선배에게 업무와 조직 분위기를 들었다. 면접에서 확인할 질문도 준비했다.", { focus: 4, stress: -2, relationship: 2 }, 0],
    ["준비는 적당히 하고 잠과 식사를 챙긴다", "컨디션을 우선해 안정적으로 임한다", "준비 자료를 정리하고 일찍 쉬었다. 다음 날 집중할 수 있도록 컨디션을 챙겼다.", { energy: 6, stress: -3 }],
  ]),
  authoredEvent("job-temp-offer", "단기 계약직 제안을 받았다", "일자리 · 선택", "당장 수입을 얻을 수 있는 단기 일이 생겼다. 근무 조건과 구직 준비에 미칠 영향을 따져야 한다.", [
    ["계약 기간과 급여를 확인하고 수락한다", "소득과 경력을 확보한다", "조건과 기간을 확인한 뒤 수락했다. 일하면서 다음 진로도 계속 살피기로 했다.", { money: 90000, energy: -6, focus: 2 }],
    ["근무 시간을 조정할 수 있는지 협의한다", "구직 일정과 병행 가능한 조건을 찾는다", "구직 준비 시간을 확보할 수 있도록 근무 조건을 문의했다. 답을 듣고 결정하기로 했다.", { focus: 3, stress: -1 }],
    ["장기 목표와 거리가 있어 이번에는 거절한다", "시간을 확보해 원하는 분야를 준비한다", "이번 제안은 정중히 거절했다. 지원 준비에 집중할 시간을 확보했다.", { focus: 3, stress: 1 }],
  ]),
  authoredEvent("job-license-exam", "자격시험 접수 마감이 다가온다", "구직 · 자격", "관심 직무에 도움이 될 자격시험 접수 기간이 얼마 남지 않았다. 준비 상태와 응시 비용을 검토할 수 있다.", [
    ["이번 회차에 접수하고 남은 기간을 계획한다", "응시 목표를 세우고 준비를 시작한다", "시험에 접수하고 남은 기간을 나눠 계획했다. 매일 할 일을 작게 정했다.", { money: -45000, focus: 6, stress: 2 }],
    ["기출과 준비 기간을 확인해 다음 회차를 노린다", "준비 부족으로 인한 비용 낭비를 줄인다", "기출 난이도와 다음 일정을 살펴봤다. 충분히 준비한 뒤 응시하기로 했다.", { focus: 4, stress: -2 }],
    ["무료 학습 자료부터 일주일 살펴본다", "적성이 맞는지 확인한 뒤 결정한다", "무료 자료로 공부를 시작했다. 일주일 뒤 계속 준비할지 판단하기로 했다.", { focus: 3, energy: -1 }],
  ]),
  authoredEvent("job-benefit-check", "구직 지원 제도를 안내받았다", "구직 · 생활 안정", "상담 중 신청 가능한 지원 제도를 소개받았다. 자격 요건과 제출 자료를 확인할 수 있다.", [
    ["공식 자격 요건과 신청 기한을 확인한다", "조건을 확인해 필요한 지원을 신청한다", "공식 안내를 확인해 신청 요건을 정리했다. 준비할 서류와 기한을 달력에 적었다.", { focus: 4, stress: -2 }],
    ["상담 기관에 질문을 모아 다시 문의한다", "상황에 맞는 절차를 확인한다", "궁금한 점을 정리해 상담 기관에 문의했다. 본인 상황에 맞는 절차를 안내받았다.", { focus: 3, stress: -3 }],
    ["당장 필요한 지원인지 생활비를 먼저 계산한다", "지원의 실효성과 준비 부담을 함께 본다", "월별 지출과 지원 조건을 비교했다. 필요한 제도부터 우선 검토하기로 했다.", { focus: 3, stress: -1 }],
  ]),
  authoredEvent("job-portfolio-feedback", "포트폴리오에 대한 의견이 엇갈렸다", "구직 · 피드백", "서로 다른 조언을 받아 어떤 방향으로 고칠지 고민된다. 지원 직무와 본인의 의도를 기준으로 판단할 수 있다.", [
    ["공고의 요구 역량에 맞춰 핵심 사례를 보강한다", "지원처에 필요한 내용을 앞세운다", "공고의 요구 역량과 사례를 연결해 보완했다. 전달하고 싶은 강점이 더 분명해졌다.", { focus: 6, energy: -3 }],
    ["두 사람에게 근거를 물어 공통점을 찾는다", "피드백을 비교해 실질적 개선점을 고른다", "조언의 근거를 확인해 공통 개선점을 찾았다. 전부 반영하지 않고 필요한 부분만 수정했다.", { focus: 4, stress: -1, relationship: 2 }, 1],
    ["현재 버전을 저장하고 다른 지원부터 진행한다", "과도한 수정을 멈추고 행동으로 옮긴다", "수정 범위를 정하고 지원을 이어갔다. 제출 후 실제 반응을 보고 다시 개선하기로 했다.", { focus: 3, mood: 2 }],
  ]),
  authoredEvent("job-wedding-invite", "친구 결혼식과 지원 일정이 겹쳤다", "친구 · 일정", "오랜 친구의 결혼식이 중요한 지원 일정 전날로 잡혔다. 참석 시간과 준비 일정을 조정해야 한다.", [
    ["축하하러 가되 머무는 시간을 정한다", "관계를 챙기고 준비 시간을 확보한다", "식에 참석해 축하를 전하고 정한 시간에 돌아왔다. 친구도 일정을 이해해줬다.", { money: -50000, energy: -4, mood: 4, relationship: 3 }, 1],
    ["마음을 전하고 이번에는 참석이 어렵다고 알린다", "지원 일정과 컨디션을 우선한다", "축하 메시지와 마음을 전했다. 친구에게는 다음에 따로 만나기로 했다.", { focus: 2, stress: -2, relationship: 1 }, 1],
    ["지원 준비를 앞당기고 참석 가능성을 만든다", "하루 계획을 촘촘히 조정한다", "준비할 일을 미리 끝내고 식에 잠시 참석했다. 바쁜 하루였지만 두 일정을 모두 챙겼다.", { energy: -6, focus: 3, mood: 3, relationship: 2 }, 1],
  ]),
  authoredEvent("job-rent-renewal", "월세 계약 갱신 시기가 다가왔다", "주거 · 경제", "집주인이 갱신 의사를 물었다. 이사 비용과 주변 시세, 현재 생활의 안정성을 비교할 수 있다.", [
    ["계약 조건을 확인하고 갱신을 협의한다", "이사 비용을 줄이고 거주 안정을 택한다", "계약 조건을 확인해 갱신을 논의했다. 당장 이사할 때 드는 비용과 시간을 아낄 수 있다.", { focus: 4, stress: -2 }],
    ["주변 시세와 다른 집을 함께 알아본다", "선택지를 비교한 뒤 결정한다", "주변 조건을 비교해 협상 기준을 세웠다. 급히 결정하지 않고 선택지를 확보했다.", { energy: -3, focus: 4, stress: 1 }],
    ["가족과 주거 계획 및 보증금을 상의한다", "필요한 도움과 현실적인 방안을 논의한다", "가족과 주거 계획을 나눴다. 필요한 자금과 가능한 선택을 구체적으로 확인했다.", { stress: -3, relationship: 3 }, 2],
  ]),
  authoredEvent("job-networking-event", "직무 관련 무료 네트워킹 행사가 열린다", "구직 · 인맥", "관심 분야 사람들을 만날 수 있는 행사가 열린다. 참여 비용은 없지만 이동과 준비 시간이 필요하다.", [
    ["참석해 궁금한 점을 직접 묻는다", "현장 정보를 얻고 인맥을 넓힌다", "현업자와 이야기를 나누며 채용 준비에 필요한 정보를 얻었다. 후속으로 연락할 사람도 알게 됐다.", { focus: 4, energy: -3, mood: 3, relationship: 2 }, 0],
    ["관심 있는 세션만 듣고 일찍 돌아온다", "필요한 정보에 집중한다", "관심 세션을 듣고 필요한 내용을 정리했다. 시간을 과하게 쓰지 않고 정보를 얻었다.", { focus: 3, energy: -1 }],
    ["온라인 자료를 확인하고 이번엔 참석하지 않는다", "이동 시간을 아껴 준비에 활용한다", "행사 자료를 확인해 필요한 내용을 찾아봤다. 오늘은 지원 준비에 집중했다.", { focus: 3, stress: -1 }],
  ]),
  authoredEvent("job-friend-boundary", "친구의 취업 소식에 마음이 복잡해졌다", "친구 · 마음", "친구의 합격 소식을 축하하면서도 내 상황이 떠올라 마음이 가라앉는다. 감정을 억누르지 않고 다룰 수 있다.", [
    ["축하를 전하고 내 감정도 인정한다", "비교 대신 자기 준비 과정에 집중한다", "친구에게 진심으로 축하를 전하고 복잡한 마음도 인정했다. 내 속도로 준비를 이어가기로 했다.", { mood: 3, stress: -2, relationship: 3 }, 1],
    ["친구에게 구체적인 준비 경험을 물어본다", "비교가 아니라 정보를 얻는다", "친구에게 어떤 준비가 도움이 됐는지 물었다. 적용할 수 있는 방법을 몇 가지 얻었다.", { focus: 4, relationship: 2 }, 1],
    ["오늘은 SNS를 멀리하고 쉬어간다", "자극을 줄이고 마음을 추스른다", "SNS를 잠시 닫고 산책하며 쉬었다. 남과 비교하는 생각이 잦아들었다.", { energy: 3, stress: -4, mood: 2 }],
  ]),
);

eventLibrary.worker.push(
  authoredEvent("work-salary-review", "연봉 조정 면담을 앞두고 있다", "직장 · 보상", "성과와 맡은 업무를 근거로 연봉 조정 면담을 준비한다. 원하는 조건과 대안을 정리할 수 있다.", [
    ["성과와 시장 자료를 정리해 희망 조건을 말한다", "근거와 함께 협의한다", "성과와 업무 범위를 정리해 면담에서 제시했다. 논의할 기준이 명확해졌다.", { focus: 5, stress: 2 }],
    ["업무 범위와 성장 기회를 함께 논의한다", "급여 외 조건도 검토한다", "보상뿐 아니라 역할과 성장 기회를 함께 이야기했다. 다음 평가 때 확인할 기준도 정했다.", { focus: 4, stress: -1, relationship: 2 }, 3],
    ["올해 조건을 듣고 다음 협의 시점을 정한다", "관계를 유지하며 후속 기준을 만든다", "올해 조건을 확인하고 다음 협의 시점과 필요한 성과 기준을 정리했다.", { stress: -1, focus: 2, relationship: 1 }, 3],
  ]),
  authoredEvent("work-team-reorg", "팀 개편으로 담당 업무가 달라질 수 있다", "직장 · 변화", "조직 개편 소식이 들려온다. 역할과 일정이 어떻게 바뀔지 불확실하지만, 미리 확인할 수 있는 내용도 있다.", [
    ["관리자에게 변경 범위와 시점을 확인한다", "불확실성을 줄이고 계획을 세운다", "변경 일정과 담당 범위를 확인했다. 준비가 필요한 업무를 미리 정리할 수 있었다.", { focus: 4, stress: -2 }, 3],
    ["새 역할에 필요한 역량을 점검한다", "변화에 대비해 학습 계획을 만든다", "새 업무에서 요구될 역량을 확인해 학습 계획을 세웠다. 변화에 대비할 방향이 생겼다.", { focus: 5, energy: -2 }],
    ["동료들과 정보를 나누고 당분간 업무를 이어간다", "추측을 줄이고 협업한다", "동료들과 확인된 내용만 공유했다. 소문보다 공식 안내를 기다리기로 했다.", { stress: -2, relationship: 2 }, 0],
  ]),
  authoredEvent("work-parent-care", "가족의 병원 일정에 동행해달라는 부탁을 받았다", "가족 · 돌봄", "가족이 병원 진료에 함께 가줄 수 있는지 물었다. 업무 일정과 필요한 돌봄을 조정해야 한다.", [
    ["휴가나 일정 변경을 요청해 동행한다", "가족을 돕고 업무를 미리 조정한다", "업무 일정을 조정해 진료에 동행했다. 가족과 필요한 내용을 함께 확인했다.", { energy: -4, stress: -2, relationship: 4 }, 2],
    ["다른 가족과 역할을 나눌 수 있는지 상의한다", "부담을 나누고 가능한 일정을 찾는다", "가족들과 일정을 나눠 맡기로 했다. 한 사람이 모든 부담을 지지 않게 조정했다.", { stress: -3, relationship: 3 }, 2],
    ["이번에는 어렵다고 말하고 가능한 다른 도움을 제안한다", "경계를 설명하며 대안을 찾는다", "당일 동행은 어렵다고 설명하고 예약과 이동을 돕기로 했다.", { stress: -1, relationship: 1 }, 2],
  ]),
  authoredEvent("work-insurance-bill", "갱신된 보험료와 공과금이 한꺼번에 나왔다", "경제 · 고정 지출", "이번 달 고정 지출이 평소보다 늘었다. 필요 항목을 확인하고 납부 계획을 조정할 수 있다.", [
    ["청구 내역을 확인하고 자동 납부를 점검한다", "누락이나 중복을 확인한다", "청구 내용을 확인해 중복 항목을 정리했다. 다음 달 지출을 예상하기 쉬워졌다.", { focus: 4, stress: -2 }],
    ["이번 달 여가 예산을 줄여 납부한다", "필수 지출을 먼저 처리한다", "필수 비용을 납부하고 여가 예산을 조정했다. 이번 달 소비 기준을 다시 세웠다.", { focus: 2, stress: 1 }],
    ["보험 보장과 갱신 조건을 다시 살핀다", "장기 비용과 필요한 보장을 비교한다", "보장 내역과 갱신 조건을 확인했다. 불필요한 항목은 다음 상담 때 검토하기로 했다.", { focus: 4, energy: -1 }],
  ]),
  authoredEvent("work-colleague-conflict", "동료와 업무 책임을 두고 의견이 달라졌다", "직장 · 갈등 조정", "업무가 지연되자 서로 맡은 범위를 다르게 이해한 것이 드러났다. 감정과 사실을 나눠 해결할 수 있다.", [
    ["업무 기록을 바탕으로 역할과 기한을 다시 맞춘다", "사실을 확인하고 해결책을 정한다", "업무 내역과 기한을 함께 확인했다. 남은 일을 다시 나눠 갈등을 줄였다.", { focus: 4, stress: -3, relationship: 2 }, 0],
    ["관리자와 함께 책임 범위를 정리한다", "중립적인 조정으로 기준을 만든다", "관리자와 논의해 역할 기준을 정리했다. 비슷한 혼선이 없도록 진행 방식을 바꾸기로 했다.", { stress: -2, relationship: 1 }, 0],
    ["당장 필요한 일을 먼저 끝내고 나중에 대화한다", "마감과 관계 회복을 순서대로 챙긴다", "우선 마감을 함께 처리했다. 이후 차분한 시간에 역할을 다시 이야기하기로 했다.", { energy: -3, focus: 3, relationship: 1 }, 0],
  ]),
  authoredEvent("work-sick-day", "몸이 좋지 않아 출근 여부를 고민한다", "건강 · 직장", "몸살 기운이 있고 집중도 어렵다. 업무 공백을 줄이면서 회복을 우선할 방법을 찾아야 한다.", [
    ["상태를 알리고 병가나 휴가를 사용한다", "회복을 우선하고 인수인계를 남긴다", "몸 상태를 알리고 쉬기로 했다. 급한 업무와 인수인계 내용을 동료에게 전달했다.", { energy: 9, stress: -4 }],
    ["재택이나 업무 조정을 요청한다", "가능한 범위에서 부담을 낮춘다", "업무 일부를 조정해 무리하지 않는 범위에서 처리했다. 쉬는 시간도 확보했다.", { energy: 5, stress: -3, focus: 1 }, 0],
    ["진료를 받고 증상에 맞게 일정을 결정한다", "필요한 진료와 업무 판단을 함께 한다", "진료를 받고 상태를 확인했다. 무리하지 않도록 다음 일정을 조정했다.", { energy: 6, focus: 1, stress: -2 }],
  ]),
  authoredEvent("work-move-house", "출퇴근을 줄일 수 있는 이사 제안을 받았다", "주거 · 생활", "친구나 지인이 근처 집을 함께 알아보자고 제안했다. 통근 시간과 보증금, 생활비를 비교해야 한다.", [
    ["통근 시간과 월 지출을 계산해 비교한다", "총비용과 생활 편의를 함께 살핀다", "이사 비용과 통근 절감 효과를 비교했다. 숫자를 확인한 뒤 서두르지 않고 판단하기로 했다.", { focus: 4, stress: -1 }],
    ["집을 직접 보고 계약 조건을 확인한다", "현장과 계약 내용을 꼼꼼히 살핀다", "집 상태와 관리비, 계약 조건을 확인했다. 추가로 살펴볼 항목을 정리했다.", { energy: -3, focus: 3 }],
    ["현재 집에 머물며 저축 목표를 우선한다", "이사 비용을 아껴 다른 목표에 쓴다", "당분간 현재 집에 머물기로 했다. 이사 자금은 다른 목표를 위해 모으기로 했다.", { stress: -2, focus: 2 }],
  ]),
  authoredEvent("work-mentor-retire", "도움을 주던 선배가 퇴사를 앞두고 있다", "직장 · 인맥", "업무를 가르쳐준 선배가 곧 회사를 떠난다고 했다. 감사 인사를 전하고 필요한 지식도 정리할 수 있다.", [
    ["감사를 전하고 인수인계 조언을 구한다", "관계를 이어가며 업무 지식을 정리한다", "선배에게 고마움을 전하고 업무 노하우를 정리했다. 이후에도 연락을 이어가기로 했다.", { focus: 3, mood: 3, relationship: 4 }, 3],
    ["팀과 함께 작은 송별 자리를 준비한다", "동료들과 함께 기억을 나눈다", "팀원들과 간단한 자리를 마련했다. 함께 일한 시간을 돌아볼 수 있었다.", { money: -12000, mood: 4, relationship: 3 }, 3],
    ["업무 인수인계 자료를 먼저 정리한다", "공백에 대비하고 필요한 질문을 남긴다", "담당 업무와 연락처를 정리했다. 선배가 떠난 뒤 확인할 절차도 파악했다.", { focus: 5, stress: -1 }],
  ]),
  authoredEvent("work-partner-time", "연인이 함께 보내는 시간이 줄었다고 말했다", "연애 · 관계", "바쁜 일정이 이어지며 약속이 자주 미뤄졌다. 서로의 서운함을 듣고 현실적인 시간을 정할 수 있다.", [
    ["이번 주에 방해받지 않는 시간을 정한다", "짧더라도 집중해서 함께 보낸다", "함께할 시간을 달력에 정했다. 업무 연락을 줄이고 서로의 근황을 나누기로 했다.", { mood: 6, stress: -2, relationship: 5 }, 1],
    ["서로 바쁜 시기를 설명하고 다음 주 계획을 맞춘다", "기대와 일정의 차이를 조율한다", "현재 일정과 각자의 부담을 나눴다. 당분간 가능한 연락과 만남 빈도를 정했다.", { stress: -3, relationship: 3 }, 1],
    ["서운함을 듣고 내가 바꿀 수 있는 한 가지를 정한다", "작은 행동으로 신뢰를 보인다", "상대의 이야기를 듣고 연락 시간을 먼저 지키기로 했다. 작은 약속부터 이어가기로 했다.", { focus: 1, relationship: 4 }, 1],
  ]),
);


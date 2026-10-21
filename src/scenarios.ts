import type { Background, LifeEvent } from "./game";

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
  ],
};

